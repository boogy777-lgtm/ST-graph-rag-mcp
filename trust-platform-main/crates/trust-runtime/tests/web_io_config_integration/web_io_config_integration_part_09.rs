use super::*;

#[test]
fn runtime_cloud_config_reconcile_surfaces_error_state_for_invalid_desired_payload() {
    let project = make_project("runtime-cloud-config-agent-error");
    let state = control_state(source_fixture());
    let base = start_test_server(state, project.clone());

    let initial_body = ureq::get(&format!("{base}/api/runtime-cloud/config"))
        .call()
        .expect("load runtime cloud config")
        .body_mut()
        .read_to_string()
        .expect("read runtime cloud config");
    let initial: Value = serde_json::from_str(&initial_body).expect("parse initial config");
    let expected_revision = initial
        .get("meta")
        .and_then(|value| value.get("desired_revision"))
        .and_then(Value::as_u64)
        .expect("desired revision");
    let expected_etag = initial
        .get("meta")
        .and_then(|value| value.get("desired_etag"))
        .and_then(Value::as_str)
        .expect("desired etag")
        .to_string();

    let payload = json!({
        "api_version": "1.0",
        "actor": "spiffe://trust/default-site/engineer-1",
        "expected_revision": expected_revision,
        "expected_etag": expected_etag,
        "desired": {
            "unknown.setting": "x"
        }
    });
    let _ = ureq::post(&format!("{base}/api/runtime-cloud/config/desired"))
        .header("Content-Type", "application/json")
        .send(&payload.to_string())
        .expect("write invalid desired config");

    let reconciled_body = ureq::get(&format!("{base}/api/runtime-cloud/config"))
        .call()
        .expect("load reconciled error state")
        .body_mut()
        .read_to_string()
        .expect("read reconciled error body");
    let reconciled: Value = serde_json::from_str(&reconciled_body).expect("parse reconciled error");
    assert_eq!(
        reconciled
            .get("status")
            .and_then(|value| value.get("state"))
            .and_then(Value::as_str),
        Some("error")
    );
    assert!(
        reconciled
            .get("status")
            .and_then(|value| value.get("errors"))
            .and_then(Value::as_array)
            .is_some_and(|errors| !errors.is_empty()),
        "error status should include apply diagnostics"
    );
    assert_eq!(
        reconciled
            .get("meta")
            .and_then(|value| value.get("reported_revision"))
            .and_then(Value::as_u64),
        Some(0),
        "reported revision must remain last-known-good when apply fails"
    );

    let _ = std::fs::remove_dir_all(project);
}

#[test]
fn runtime_cloud_config_conflict_rebase_retry_applies_latest_desired() {
    let project = make_project("runtime-cloud-config-agent-rebase");
    let state = control_state(source_fixture());
    let base = start_test_server(state, project.clone());

    let initial_body = ureq::get(&format!("{base}/api/runtime-cloud/config"))
        .call()
        .expect("load runtime cloud config")
        .body_mut()
        .read_to_string()
        .expect("read runtime cloud config");
    let initial: Value = serde_json::from_str(&initial_body).expect("parse initial config");
    let initial_revision = initial
        .get("meta")
        .and_then(|value| value.get("desired_revision"))
        .and_then(Value::as_u64)
        .expect("initial desired revision");
    let initial_etag = initial
        .get("meta")
        .and_then(|value| value.get("desired_etag"))
        .and_then(Value::as_str)
        .expect("initial desired etag")
        .to_string();

    let first_payload = json!({
        "api_version": "1.0",
        "actor": "spiffe://trust/default-site/engineer-1",
        "expected_revision": initial_revision,
        "expected_etag": initial_etag,
        "desired": {
            "log.level": "debug"
        }
    });
    let first_body = ureq::post(&format!("{base}/api/runtime-cloud/config/desired"))
        .header("Content-Type", "application/json")
        .send(&first_payload.to_string())
        .expect("write first desired config")
        .body_mut()
        .read_to_string()
        .expect("read first desired response");
    let first_response: Value =
        serde_json::from_str(&first_body).expect("parse first desired response");
    assert_eq!(
        first_response.get("ok").and_then(Value::as_bool),
        Some(true),
        "first desired write should succeed"
    );

    let stale_payload = json!({
        "api_version": "1.0",
        "actor": "spiffe://trust/default-site/engineer-1",
        "expected_revision": initial_revision,
        "expected_etag": first_payload.get("expected_etag").cloned().expect("initial etag value"),
        "desired": {
            "watchdog.enabled": true
        }
    });
    let mut conflict_response = ureq::post(&format!("{base}/api/runtime-cloud/config/desired"))
        .header("Content-Type", "application/json")
        .config()
        .http_status_as_error(false)
        .build()
        .send(&stale_payload.to_string())
        .expect("stale desired write response");
    assert_eq!(
        conflict_response.status().as_u16(),
        409,
        "stale desired write should return 409"
    );
    let conflict_body = conflict_response
        .body_mut()
        .read_to_string()
        .expect("read stale write conflict response");
    let conflict: Value = serde_json::from_str(&conflict_body).expect("parse conflict response");
    assert_eq!(
        conflict.get("denial_code").and_then(Value::as_str),
        Some("revision_conflict")
    );
    assert_eq!(
        conflict
            .get("status")
            .and_then(|value| value.get("required_action"))
            .and_then(Value::as_str),
        Some("rebase_required")
    );

    let rebase_revision = conflict
        .get("meta")
        .and_then(|value| value.get("desired_revision"))
        .and_then(Value::as_u64)
        .expect("rebase desired revision");
    let rebase_etag = conflict
        .get("meta")
        .and_then(|value| value.get("desired_etag"))
        .and_then(Value::as_str)
        .expect("rebase desired etag")
        .to_string();
    let rebase_payload = json!({
        "api_version": "1.0",
        "actor": "spiffe://trust/default-site/engineer-1",
        "expected_revision": rebase_revision,
        "expected_etag": rebase_etag,
        "desired": {
            "watchdog.enabled": true
        }
    });
    let rebase_body = ureq::post(&format!("{base}/api/runtime-cloud/config/desired"))
        .header("Content-Type", "application/json")
        .send(&rebase_payload.to_string())
        .expect("rebase desired write")
        .body_mut()
        .read_to_string()
        .expect("read rebase response");
    let rebase_response: Value = serde_json::from_str(&rebase_body).expect("parse rebase response");
    assert_eq!(
        rebase_response.get("ok").and_then(Value::as_bool),
        Some(true),
        "rebased write should succeed"
    );

    let reconciled_body = ureq::get(&format!("{base}/api/runtime-cloud/config"))
        .call()
        .expect("load rebased config")
        .body_mut()
        .read_to_string()
        .expect("read rebased config response");
    let reconciled: Value = serde_json::from_str(&reconciled_body).expect("parse rebased config");
    assert_eq!(
        reconciled
            .get("status")
            .and_then(|value| value.get("state"))
            .and_then(Value::as_str),
        Some("in_sync")
    );
    assert_eq!(
        reconciled
            .get("desired")
            .and_then(|value| value.get("log.level"))
            .and_then(Value::as_str),
        Some("debug"),
        "rebased desired must preserve previously accepted keys"
    );
    assert_eq!(
        reconciled
            .get("desired")
            .and_then(|value| value.get("watchdog.enabled"))
            .and_then(Value::as_bool),
        Some(true),
        "rebased desired should include newly merged key"
    );

    let _ = std::fs::remove_dir_all(project);
}
