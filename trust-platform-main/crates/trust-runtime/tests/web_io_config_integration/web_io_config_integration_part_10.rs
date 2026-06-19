use super::*;

#[test]
fn runtime_cloud_config_partial_desired_subtree_write_keeps_existing_keys() {
    let project = make_project("runtime-cloud-config-agent-partial-subtree");
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
            "log.level": "debug",
            "watchdog.timeout_ms": 2000
        }
    });
    let _ = ureq::post(&format!("{base}/api/runtime-cloud/config/desired"))
        .header("Content-Type", "application/json")
        .send(&first_payload.to_string())
        .expect("write initial desired subtree");

    let first_reconciled_body = ureq::get(&format!("{base}/api/runtime-cloud/config"))
        .call()
        .expect("reconcile first desired subtree")
        .body_mut()
        .read_to_string()
        .expect("read first reconcile response");
    let first_reconciled: Value =
        serde_json::from_str(&first_reconciled_body).expect("parse first reconcile");
    let second_revision = first_reconciled
        .get("meta")
        .and_then(|value| value.get("desired_revision"))
        .and_then(Value::as_u64)
        .expect("second desired revision");
    let second_etag = first_reconciled
        .get("meta")
        .and_then(|value| value.get("desired_etag"))
        .and_then(Value::as_str)
        .expect("second desired etag")
        .to_string();

    let second_payload = json!({
        "api_version": "1.0",
        "actor": "spiffe://trust/default-site/engineer-1",
        "expected_revision": second_revision,
        "expected_etag": second_etag,
        "desired": {
            "watchdog.enabled": true
        }
    });
    let _ = ureq::post(&format!("{base}/api/runtime-cloud/config/desired"))
        .header("Content-Type", "application/json")
        .send(&second_payload.to_string())
        .expect("write partial desired subtree");

    let final_body = ureq::get(&format!("{base}/api/runtime-cloud/config"))
        .call()
        .expect("load final config state")
        .body_mut()
        .read_to_string()
        .expect("read final config state");
    let final_state: Value = serde_json::from_str(&final_body).expect("parse final config state");
    assert_eq!(
        final_state
            .get("status")
            .and_then(|value| value.get("state"))
            .and_then(Value::as_str),
        Some("in_sync")
    );
    assert_eq!(
        final_state
            .get("desired")
            .and_then(|value| value.get("log.level"))
            .and_then(Value::as_str),
        Some("debug"),
        "partial desired write must preserve previously written key"
    );
    assert_eq!(
        final_state
            .get("desired")
            .and_then(|value| value.get("watchdog.timeout_ms"))
            .and_then(Value::as_u64),
        Some(2000),
        "partial desired write must preserve subtree sibling key"
    );
    assert_eq!(
        final_state
            .get("desired")
            .and_then(|value| value.get("watchdog.enabled"))
            .and_then(Value::as_bool),
        Some(true)
    );
    assert_eq!(
        final_state
            .get("reported")
            .and_then(|value| value.get("watchdog.enabled"))
            .and_then(Value::as_bool),
        Some(true),
        "reported state should converge to merged desired state"
    );

    let _ = std::fs::remove_dir_all(project);
}
