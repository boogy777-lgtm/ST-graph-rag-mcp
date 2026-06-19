use super::*;

#[test]
fn runtime_cloud_ha_replay_guard_deduplicates_and_rejects_stale_seq() {
    let project = make_project("runtime-cloud-ha-replay-guard");
    let (audit_tx, audit_rx) = std::sync::mpsc::channel::<ControlAuditEvent>();
    let state = control_state_named_with_audit(source_fixture(), "runtime-a", Some(audit_tx));
    let base = start_test_server(state, project.clone());

    let first_payload = json!({
        "api_version": "1.0",
        "request_id": "req-ha-replay-1",
        "connected_via": "runtime-a",
        "target_runtimes": ["runtime-a"],
        "actor": "spiffe://trust/default-site/operator-1",
        "action_type": "cmd_invoke",
        "dry_run": false,
        "payload": {
            "command": "status",
            "ha": {
                "profile": "dual_host",
                "group_id": "line-4-ha",
                "active_namespace": true,
                "command_seq": 7,
                "targets": {
                    "runtime-a": {
                        "role": "active",
                        "lease_consistent_authority": true,
                        "lease_available": true,
                        "lease_owner_runtime_id": "runtime-a",
                        "fencing_token": "fence-a",
                        "fence_valid": true
                    }
                }
            }
        }
    });
    let first_body = ureq::post(&format!("{base}/api/runtime-cloud/actions/dispatch"))
        .header("Content-Type", "application/json")
        .send(&first_payload.to_string())
        .expect("first runtime cloud HA replay dispatch response")
        .body_mut()
        .read_to_string()
        .expect("read first runtime cloud HA replay dispatch body");
    let first_response: Value =
        serde_json::from_str(&first_body).expect("parse first runtime cloud HA replay dispatch");
    assert_eq!(
        first_response.get("ok").and_then(Value::as_bool),
        Some(true)
    );
    let first_audit_id = first_response
        .get("results")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .and_then(|item| item.get("audit_id"))
        .and_then(Value::as_str)
        .expect("first dispatch audit_id")
        .to_string();

    let second_body = ureq::post(&format!("{base}/api/runtime-cloud/actions/dispatch"))
        .header("Content-Type", "application/json")
        .send(&first_payload.to_string())
        .expect("second runtime cloud HA replay dispatch response")
        .body_mut()
        .read_to_string()
        .expect("read second runtime cloud HA replay dispatch body");
    let second_response: Value =
        serde_json::from_str(&second_body).expect("parse second runtime cloud HA replay dispatch");
    assert_eq!(
        second_response.get("ok").and_then(Value::as_bool),
        Some(true)
    );
    assert_eq!(
        second_response
            .get("results")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|item| item.get("audit_id"))
            .and_then(Value::as_str),
        Some(first_audit_id.as_str()),
        "duplicate request_id must deduplicate to same audit linkage"
    );

    let observed = recv_audit_event(&audit_rx);
    assert_eq!(observed.correlation_id.as_deref(), Some("req-ha-replay-1"));
    assert!(
        audit_rx.recv_timeout(Duration::from_millis(250)).is_err(),
        "deduplicated command replay should not emit a second control audit event"
    );

    let stale_payload = json!({
        "api_version": "1.0",
        "request_id": "req-ha-replay-stale",
        "connected_via": "runtime-a",
        "target_runtimes": ["runtime-a"],
        "actor": "spiffe://trust/default-site/operator-1",
        "action_type": "cmd_invoke",
        "dry_run": false,
        "payload": {
            "command": "status",
            "ha": {
                "profile": "dual_host",
                "group_id": "line-4-ha",
                "active_namespace": true,
                "command_seq": 6,
                "targets": {
                    "runtime-a": {
                        "role": "active",
                        "lease_consistent_authority": true,
                        "lease_available": true,
                        "lease_owner_runtime_id": "runtime-a",
                        "fencing_token": "fence-a",
                        "fence_valid": true
                    }
                }
            }
        }
    });
    let stale_body = ureq::post(&format!("{base}/api/runtime-cloud/actions/dispatch"))
        .header("Content-Type", "application/json")
        .send(&stale_payload.to_string())
        .expect("stale runtime cloud HA replay dispatch response")
        .body_mut()
        .read_to_string()
        .expect("read stale runtime cloud HA replay dispatch body");
    let stale_response: Value =
        serde_json::from_str(&stale_body).expect("parse stale runtime cloud HA replay dispatch");
    assert_eq!(
        stale_response.get("ok").and_then(Value::as_bool),
        Some(false)
    );
    assert_eq!(
        stale_response
            .get("results")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|item| item.get("denial_code"))
            .and_then(Value::as_str),
        Some("conflict")
    );

    let _ = std::fs::remove_dir_all(project);
}
