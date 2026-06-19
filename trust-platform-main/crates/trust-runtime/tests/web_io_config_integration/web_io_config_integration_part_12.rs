use super::*;

#[test]
fn runtime_cloud_config_agent_recovers_pending_state_after_restart() {
    let project = make_project("runtime-cloud-config-agent-restart-recovery");

    let state_first = control_state(source_fixture());
    let base_first = start_test_server(state_first, project.clone());
    let initial_body = ureq::get(&format!("{base_first}/api/runtime-cloud/config"))
        .call()
        .expect("load initial runtime cloud config")
        .body_mut()
        .read_to_string()
        .expect("read initial runtime cloud config");
    let initial: Value =
        serde_json::from_str(&initial_body).expect("parse initial runtime cloud config");
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

    let desired_payload = json!({
        "api_version": "1.0",
        "actor": "spiffe://trust/default-site/engineer-1",
        "expected_revision": initial_revision,
        "expected_etag": initial_etag,
        "desired": {
            "log.level": "debug"
        }
    });
    let first_write_body = ureq::post(&format!("{base_first}/api/runtime-cloud/config/desired"))
        .header("Content-Type", "application/json")
        .send(&desired_payload.to_string())
        .expect("write pending desired config")
        .body_mut()
        .read_to_string()
        .expect("read pending desired response");
    let first_write: Value =
        serde_json::from_str(&first_write_body).expect("parse pending desired response");
    assert_eq!(first_write.get("ok").and_then(Value::as_bool), Some(true));
    assert_eq!(
        first_write
            .get("status")
            .and_then(|value| value.get("state"))
            .and_then(Value::as_str),
        Some("pending"),
        "first runtime should persist pending state before restart"
    );

    let state_second = control_state(source_fixture());
    let base_second = start_test_server(state_second, project.clone());
    let recovered_body = ureq::get(&format!("{base_second}/api/runtime-cloud/config"))
        .call()
        .expect("load recovered runtime cloud config")
        .body_mut()
        .read_to_string()
        .expect("read recovered runtime cloud config");
    let recovered: Value =
        serde_json::from_str(&recovered_body).expect("parse recovered runtime cloud config");
    assert_eq!(
        recovered
            .get("status")
            .and_then(|value| value.get("state"))
            .and_then(Value::as_str),
        Some("in_sync"),
        "restarted runtime should reconcile persisted pending desired state"
    );
    assert_eq!(
        recovered
            .get("meta")
            .and_then(|value| value.get("desired_revision"))
            .and_then(Value::as_u64),
        Some(1)
    );
    assert_eq!(
        recovered
            .get("meta")
            .and_then(|value| value.get("reported_revision"))
            .and_then(Value::as_u64),
        Some(1)
    );
    assert_eq!(
        recovered
            .get("desired")
            .and_then(|value| value.get("log.level"))
            .and_then(Value::as_str),
        Some("debug")
    );

    let config_body = ureq::post(&format!("{base_second}/api/control"))
        .header("Content-Type", "application/json")
        .send(r#"{"id":101,"type":"config.get"}"#)
        .expect("query control config after restart")
        .body_mut()
        .read_to_string()
        .expect("read control config after restart");
    let config: Value = serde_json::from_str(&config_body).expect("parse control config");
    assert_eq!(
        config
            .get("result")
            .and_then(|value| value.get("log.level"))
            .and_then(Value::as_str),
        Some("debug"),
        "reconciled persisted desired state must be applied after restart"
    );

    let _ = std::fs::remove_dir_all(project);
}

#[test]
fn runtime_cloud_state_requires_secure_profile_transport_in_plant_mode() {
    let project = make_project("runtime-cloud-state-plant-profile");
    let state = control_state(source_fixture());
    let base = start_test_server_with_options_and_profile(
        state,
        project.clone(),
        None,
        None,
        WebAuthMode::Local,
        RuntimeCloudProfile::Plant,
    );

    let mut response = ureq::get(&format!("{base}/api/runtime-cloud/state"))
        .config()
        .http_status_as_error(false)
        .build()
        .call()
        .expect("plant profile runtime cloud state response");
    assert_eq!(
        response.status().as_u16(),
        503,
        "plant profile should reject local/no-tls runtime cloud state access"
    );
    let body = response
        .body_mut()
        .read_to_string()
        .expect("read runtime cloud plant rejection response");
    let payload: Value = serde_json::from_str(&body).expect("parse runtime cloud plant rejection");
    assert_eq!(
        payload.get("denial_code").and_then(Value::as_str),
        Some("not_configured")
    );
    assert!(
        payload
            .get("error")
            .and_then(Value::as_str)
            .map(|value| value.contains("runtime.web.auth='token'"))
            .unwrap_or(false),
        "expected profile denial to explain token auth requirement, got: {payload:?}"
    );

    let _ = std::fs::remove_dir_all(project);
}

#[test]
fn runtime_cloud_preflight_returns_deterministic_unreachable_denial() {
    let project = make_project("runtime-cloud-preflight");
    let state = control_state(source_fixture());
    let base = start_test_server(state, project.clone());

    let payload = json!({
        "api_version": "1.0",
        "request_id": "req-preflight-1",
        "connected_via": "RESOURCE",
        "target_runtimes": ["missing-runtime"],
        "actor": "spiffe://trust/default-site/operator-1",
        "action_type": "cfg_apply",
        "dry_run": true,
        "payload": {
            "params": { "log.level": "debug" }
        }
    });
    let body = ureq::post(&format!("{base}/api/runtime-cloud/actions/preflight"))
        .header("Content-Type", "application/json")
        .send(&payload.to_string())
        .expect("runtime cloud preflight response")
        .body_mut()
        .read_to_string()
        .expect("read runtime cloud preflight body");
    let response: Value = serde_json::from_str(&body).expect("parse runtime cloud preflight");

    assert_eq!(
        response.get("allowed").and_then(Value::as_bool),
        Some(false),
        "unreachable target must fail preflight"
    );
    assert_eq!(
        response.get("denial_code").and_then(Value::as_str),
        Some("target_unreachable")
    );
    assert_eq!(
        response
            .get("decisions")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|item| item.get("denial_code"))
            .and_then(Value::as_str),
        Some("target_unreachable")
    );

    let _ = std::fs::remove_dir_all(project);
}

#[test]
fn runtime_cloud_preflight_rejects_non_json_content_type() {
    let project = make_project("runtime-cloud-preflight-content-type");
    let state = control_state(source_fixture());
    let base = start_test_server(state, project.clone());

    let payload = json!({
        "api_version": "1.0",
        "request_id": "req-preflight-content-type-1",
        "connected_via": "RESOURCE",
        "target_runtimes": ["missing-runtime"],
        "actor": "spiffe://trust/default-site/operator-1",
        "action_type": "cfg_apply",
        "dry_run": true,
        "payload": {
            "params": { "log.level": "debug" }
        }
    });
    let mut response = ureq::post(&format!("{base}/api/runtime-cloud/actions/preflight"))
        .header("Content-Type", "text/plain")
        .config()
        .http_status_as_error(false)
        .build()
        .send(&payload.to_string())
        .expect("non-json content type response");
    assert_eq!(
        response.status().as_u16(),
        415,
        "non-json content type must be rejected"
    );
    let body = response
        .body_mut()
        .read_to_string()
        .expect("read content-type rejection body");
    let response: Value =
        serde_json::from_str(&body).expect("parse runtime cloud content-type rejection");
    assert_eq!(
        response.get("denial_code").and_then(Value::as_str),
        Some("contract_violation")
    );

    let _ = std::fs::remove_dir_all(project);
}
