use super::*;

#[test]
fn runtime_cloud_preflight_rejects_cross_origin_post() {
    let project = make_project("runtime-cloud-preflight-cross-origin");
    let state = control_state(source_fixture());
    let base = start_test_server(state, project.clone());

    let payload = json!({
        "api_version": "1.0",
        "request_id": "req-preflight-cross-origin-1",
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
        .header("Content-Type", "application/json")
        .header("Origin", "http://evil.example")
        .config()
        .http_status_as_error(false)
        .build()
        .send(&payload.to_string())
        .expect("cross-origin post response");
    assert_eq!(
        response.status().as_u16(),
        403,
        "cross-origin post must be rejected"
    );
    let body = response
        .body_mut()
        .read_to_string()
        .expect("read cross-origin rejection body");
    let response: Value =
        serde_json::from_str(&body).expect("parse runtime cloud cross-origin rejection");
    assert_eq!(
        response.get("denial_code").and_then(Value::as_str),
        Some("permission_denied")
    );

    let _ = std::fs::remove_dir_all(project);
}

#[test]
fn runtime_cloud_preflight_rejects_oversized_json_body() {
    let project = make_project("runtime-cloud-preflight-body-limit");
    let state = control_state(source_fixture());
    let base = start_test_server(state, project.clone());

    let oversized_note = "x".repeat(1_100_000);
    let payload = json!({
        "api_version": "1.0",
        "request_id": "req-preflight-body-limit-1",
        "connected_via": "RESOURCE",
        "target_runtimes": ["missing-runtime"],
        "actor": "spiffe://trust/default-site/operator-1",
        "action_type": "cfg_apply",
        "dry_run": true,
        "payload": {
            "params": { "note": oversized_note }
        }
    });
    let mut response = ureq::post(&format!("{base}/api/runtime-cloud/actions/preflight"))
        .header("Content-Type", "application/json")
        .config()
        .http_status_as_error(false)
        .build()
        .send(&payload.to_string())
        .expect("oversized preflight body response");
    assert_eq!(
        response.status().as_u16(),
        413,
        "oversized preflight body must be rejected"
    );
    let body = response
        .body_mut()
        .read_to_string()
        .expect("read oversized body rejection");
    let response: Value =
        serde_json::from_str(&body).expect("parse runtime cloud oversized body rejection");
    assert_eq!(
        response.get("denial_code").and_then(Value::as_str),
        Some("contract_violation")
    );

    let _ = std::fs::remove_dir_all(project);
}

#[test]
fn runtime_cloud_dispatch_unreachable_target_does_not_fallback_to_local_apply() {
    let project = make_project("runtime-cloud-dispatch-unreachable-no-fallback");
    let state = control_state(source_fixture());
    let base = start_test_server(state, project.clone());

    let payload = json!({
        "api_version": "1.0",
        "request_id": "req-dispatch-unreachable-1",
        "connected_via": "RESOURCE",
        "target_runtimes": ["missing-runtime"],
        "actor": "spiffe://trust/default-site/operator-1",
        "action_type": "cfg_apply",
        "dry_run": false,
        "payload": {
            "params": { "log.level": "debug" }
        }
    });
    let body = ureq::post(&format!("{base}/api/runtime-cloud/actions/dispatch"))
        .header("Content-Type", "application/json")
        .send(&payload.to_string())
        .expect("runtime cloud dispatch response")
        .body_mut()
        .read_to_string()
        .expect("read runtime cloud dispatch body");
    let response: Value = serde_json::from_str(&body).expect("parse runtime cloud dispatch");
    assert_eq!(
        response.get("ok").and_then(Value::as_bool),
        Some(false),
        "dispatch must fail when target is unreachable"
    );
    assert_eq!(
        response
            .get("results")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|item| item.get("denial_code"))
            .and_then(Value::as_str),
        Some("target_unreachable")
    );

    let config_body = ureq::post(&format!("{base}/api/control"))
        .header("Content-Type", "application/json")
        .send(r#"{"id":21,"type":"config.get"}"#)
        .expect("query local config")
        .body_mut()
        .read_to_string()
        .expect("read local config response");
    let config: Value = serde_json::from_str(&config_body).expect("parse config.get");
    assert_eq!(
        config
            .get("result")
            .and_then(|value| value.get("log.level"))
            .and_then(Value::as_str),
        Some("info"),
        "local runtime config must stay unchanged when remote dispatch target is unreachable"
    );

    let _ = std::fs::remove_dir_all(project);
}

#[test]
fn runtime_cloud_dispatch_cancels_fanout_when_query_budget_is_exhausted() {
    let project = make_project("runtime-cloud-dispatch-query-cancel-budget");
    let state = control_state(source_fixture());
    let base = start_test_server(state, project.clone());

    let payload = json!({
        "api_version": "1.0",
        "request_id": "req-dispatch-budget-cancel-1",
        "connected_via": "RESOURCE",
        "target_runtimes": ["RESOURCE"],
        "actor": "spiffe://trust/default-site/operator-1",
        "action_type": "cfg_apply",
        "query_budget_ms": 0,
        "dry_run": false,
        "payload": {
            "params": { "log.level": "debug" }
        }
    });
    let body = ureq::post(&format!("{base}/api/runtime-cloud/actions/dispatch"))
        .header("Content-Type", "application/json")
        .send(&payload.to_string())
        .expect("runtime cloud dispatch budget response")
        .body_mut()
        .read_to_string()
        .expect("read runtime cloud dispatch budget body");
    let response: Value = serde_json::from_str(&body).expect("parse runtime cloud budget dispatch");
    assert_eq!(response.get("ok").and_then(Value::as_bool), Some(false));
    assert_eq!(
        response
            .get("results")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|item| item.get("denial_code"))
            .and_then(Value::as_str),
        Some("timeout")
    );

    let config_body = ureq::post(&format!("{base}/api/control"))
        .header("Content-Type", "application/json")
        .send(r#"{"id":22,"type":"config.get"}"#)
        .expect("query local config after budget cancel")
        .body_mut()
        .read_to_string()
        .expect("read local config after budget cancel");
    let config: Value =
        serde_json::from_str(&config_body).expect("parse local config after budget");
    assert_eq!(
        config
            .get("result")
            .and_then(|value| value.get("log.level"))
            .and_then(Value::as_str),
        Some("info"),
        "query-budget cancellation must prevent local apply dispatch"
    );

    let _ = std::fs::remove_dir_all(project);
}
