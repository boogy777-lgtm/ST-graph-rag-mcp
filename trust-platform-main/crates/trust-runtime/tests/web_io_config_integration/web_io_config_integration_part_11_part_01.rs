use super::*;

#[path = "web_io_config_integration_part_11_abort_helpers.rs"]
mod web_io_config_integration_part_11_abort_helpers;

use web_io_config_integration_part_11_abort_helpers::assert_abort_rollout_terminal_conflict;

#[test]
fn runtime_cloud_rollout_state_machine_covers_happy_failed_and_aborted_paths() {
    let project = make_project("runtime-cloud-rollout-state-machine");
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

    let desired_ok_payload = json!({
        "api_version": "1.0",
        "actor": "spiffe://trust/default-site/engineer-1",
        "expected_revision": initial_revision,
        "expected_etag": initial_etag,
        "desired": {
            "log.level": "debug"
        }
    });
    let _ = ureq::post(&format!("{base}/api/runtime-cloud/config/desired"))
        .header("Content-Type", "application/json")
        .send(&desired_ok_payload.to_string())
        .expect("write valid desired");
    let _ = ureq::get(&format!("{base}/api/runtime-cloud/config"))
        .call()
        .expect("reconcile valid desired");

    let create_happy_payload = json!({
        "api_version": "1.0",
        "actor": "spiffe://trust/default-site/engineer-1",
        "target_runtimes": ["RESOURCE"],
        "desired_revision": 1
    });
    let create_happy_body = ureq::post(&format!("{base}/api/runtime-cloud/rollouts"))
        .header("Content-Type", "application/json")
        .send(&create_happy_payload.to_string())
        .expect("create happy rollout")
        .body_mut()
        .read_to_string()
        .expect("read happy rollout response");
    let create_happy: Value =
        serde_json::from_str(&create_happy_body).expect("parse happy rollout response");
    let happy_id = create_happy
        .get("rollout")
        .and_then(|value| value.get("rollout_id"))
        .and_then(Value::as_str)
        .expect("happy rollout id")
        .to_string();

    let mut happy_rollout = Value::Null;
    for _ in 0..12 {
        let list_body = ureq::get(&format!("{base}/api/runtime-cloud/rollouts"))
            .call()
            .expect("list rollouts")
            .body_mut()
            .read_to_string()
            .expect("read rollouts");
        let list: Value = serde_json::from_str(&list_body).expect("parse rollouts");
        if let Some(found) = list
            .get("items")
            .and_then(Value::as_array)
            .and_then(|items| {
                items.iter().find(|item| {
                    item.get("rollout_id").and_then(Value::as_str) == Some(happy_id.as_str())
                })
            })
        {
            happy_rollout = found.clone();
            if happy_rollout.get("state").and_then(Value::as_str) == Some("completed") {
                break;
            }
        }
    }
    assert_eq!(
        happy_rollout.get("state").and_then(Value::as_str),
        Some("completed"),
        "happy rollout must complete through all state transitions"
    );
    assert_eq!(
        happy_rollout
            .get("targets")
            .and_then(Value::as_array)
            .and_then(|targets| targets.first())
            .and_then(|target| target.get("state"))
            .and_then(Value::as_str),
        Some("verified"),
        "target state should progress to verified before completion"
    );
    assert!(
        happy_rollout
            .get("targets")
            .and_then(Value::as_array)
            .and_then(|targets| targets.first())
            .and_then(|target| target.get("verification"))
            .and_then(Value::as_str)
            .map(|text| text.contains("reported_revision="))
            .unwrap_or(false),
        "verified target should include deterministic verification note"
    );

    let latest_body = ureq::get(&format!("{base}/api/runtime-cloud/config"))
        .call()
        .expect("load latest runtime cloud config")
        .body_mut()
        .read_to_string()
        .expect("read latest runtime cloud config");
    let latest: Value = serde_json::from_str(&latest_body).expect("parse latest config");
    let latest_revision = latest
        .get("meta")
        .and_then(|value| value.get("desired_revision"))
        .and_then(Value::as_u64)
        .expect("latest desired revision");
    let latest_etag = latest
        .get("meta")
        .and_then(|value| value.get("desired_etag"))
        .and_then(Value::as_str)
        .expect("latest desired etag")
        .to_string();

    let desired_bad_payload = json!({
        "api_version": "1.0",
        "actor": "spiffe://trust/default-site/engineer-1",
        "expected_revision": latest_revision,
        "expected_etag": latest_etag,
        "desired": {
            "unknown.setting": true
        }
    });
    let desired_bad_body = ureq::post(&format!("{base}/api/runtime-cloud/config/desired"))
        .header("Content-Type", "application/json")
        .send(&desired_bad_payload.to_string())
        .expect("write invalid desired")
        .body_mut()
        .read_to_string()
        .expect("read invalid desired response");
    let desired_bad: Value =
        serde_json::from_str(&desired_bad_body).expect("parse invalid desired response");
    let bad_revision = desired_bad
        .get("meta")
        .and_then(|value| value.get("desired_revision"))
        .and_then(Value::as_u64)
        .expect("invalid desired revision");

    let create_failed_payload = json!({
        "api_version": "1.0",
        "actor": "spiffe://trust/default-site/engineer-1",
        "target_runtimes": ["RESOURCE"],
        "desired_revision": bad_revision
    });
    let create_failed_body = ureq::post(&format!("{base}/api/runtime-cloud/rollouts"))
        .header("Content-Type", "application/json")
        .send(&create_failed_payload.to_string())
        .expect("create failed rollout")
        .body_mut()
        .read_to_string()
        .expect("read failed rollout response");
    let create_failed: Value =
        serde_json::from_str(&create_failed_body).expect("parse failed rollout response");
    let failed_id = create_failed
        .get("rollout")
        .and_then(|value| value.get("rollout_id"))
        .and_then(Value::as_str)
        .expect("failed rollout id")
        .to_string();

    let mut failed_rollout = Value::Null;
    for _ in 0..10 {
        let list_body = ureq::get(&format!("{base}/api/runtime-cloud/rollouts"))
            .call()
            .expect("list rollouts for failed path")
            .body_mut()
            .read_to_string()
            .expect("read rollouts for failed path");
        let list: Value = serde_json::from_str(&list_body).expect("parse rollouts for failed path");
        if let Some(found) = list
            .get("items")
            .and_then(Value::as_array)
            .and_then(|items| {
                items.iter().find(|item| {
                    item.get("rollout_id").and_then(Value::as_str) == Some(failed_id.as_str())
                })
            })
        {
            failed_rollout = found.clone();
            if failed_rollout.get("state").and_then(Value::as_str) == Some("failed") {
                break;
            }
        }
    }
    assert_eq!(
        failed_rollout.get("state").and_then(Value::as_str),
        Some("failed"),
        "rollout should fail when config reconcile enters error state"
    );
    assert_eq!(
        failed_rollout
            .get("targets")
            .and_then(Value::as_array)
            .and_then(|targets| targets.first())
            .and_then(|target| target.get("state"))
            .and_then(Value::as_str),
        Some("failed")
    );
    assert!(
        failed_rollout
            .get("targets")
            .and_then(Value::as_array)
            .and_then(|targets| targets.first())
            .and_then(|target| target.get("error"))
            .and_then(Value::as_str)
            .map(|text| text.contains("unknown config key"))
            .unwrap_or(false),
        "failed target should carry deterministic apply error"
    );

    assert_abort_rollout_terminal_conflict(&base);

    let _ = std::fs::remove_dir_all(project);
}
