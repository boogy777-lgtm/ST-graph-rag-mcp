use super::*;

pub(super) fn assert_abort_rollout_terminal_conflict(base: &str) {
    let create_abort_payload = json!({
        "api_version": "1.0",
        "actor": "spiffe://trust/default-site/engineer-1",
        "target_runtimes": ["RESOURCE"]
    });
    let create_abort_body = ureq::post(&format!("{base}/api/runtime-cloud/rollouts"))
        .header("Content-Type", "application/json")
        .send(&create_abort_payload.to_string())
        .expect("create abort rollout")
        .body_mut()
        .read_to_string()
        .expect("read abort rollout response");
    let create_abort: Value =
        serde_json::from_str(&create_abort_body).expect("parse abort rollout response");
    let abort_id = create_abort
        .get("rollout")
        .and_then(|value| value.get("rollout_id"))
        .and_then(Value::as_str)
        .expect("abort rollout id")
        .to_string();

    let abort_body = ureq::post(&format!(
        "{base}/api/runtime-cloud/rollouts/{abort_id}/abort"
    ))
    .send("")
    .expect("abort rollout")
    .body_mut()
    .read_to_string()
    .expect("read abort response");
    let abort_response: Value = serde_json::from_str(&abort_body).expect("parse abort response");
    assert_eq!(
        abort_response.get("ok").and_then(Value::as_bool),
        Some(true)
    );
    assert_eq!(
        abort_response.get("action").and_then(Value::as_str),
        Some("aborted")
    );
    assert_eq!(
        abort_response
            .get("rollout")
            .and_then(|value| value.get("state"))
            .and_then(Value::as_str),
        Some("aborted")
    );
    assert_eq!(
        abort_response
            .get("rollout")
            .and_then(|value| value.get("targets"))
            .and_then(Value::as_array)
            .and_then(|targets| targets.first())
            .and_then(|target| target.get("state"))
            .and_then(Value::as_str),
        Some("aborted")
    );

    let mut pause_terminal_response = ureq::post(&format!(
        "{base}/api/runtime-cloud/rollouts/{abort_id}/pause"
    ))
    .config()
    .http_status_as_error(false)
    .build()
    .send("")
    .expect("terminal rollout pause response");
    assert_eq!(
        pause_terminal_response.status().as_u16(),
        409,
        "terminal rollout pause should conflict"
    );
    let pause_terminal_body = pause_terminal_response
        .body_mut()
        .read_to_string()
        .expect("read terminal pause response");
    let pause_terminal: Value =
        serde_json::from_str(&pause_terminal_body).expect("parse terminal pause response");
    assert_eq!(
        pause_terminal.get("denial_code").and_then(Value::as_str),
        Some("conflict"),
        "terminal action denial must be deterministic"
    );
}
