use super::*;

#[test]
fn io_config_endpoint_round_trips_multi_driver_payload() {
    let project = make_project("multidriver");
    let state = control_state(source_fixture());
    let base = start_test_server(state, project.clone());

    let payload = json!({
        "drivers": [
            {
                "name": "modbus-tcp",
                "params": {
                    "address": "127.0.0.1:502",
                    "unit_id": 1,
                    "input_start": 0,
                    "output_start": 0
                }
            },
            {
                "name": "mqtt",
                "params": {
                    "broker": "127.0.0.1:1883",
                    "topic_in": "trust/io/in",
                    "topic_out": "trust/io/out",
                    "reconnect_ms": 250
                }
            }
        ],
        "safe_state": [
            {
                "address": "%QX0.0",
                "value": "FALSE"
            }
        ],
        "use_system_io": false
    });

    let save_response = ureq::post(&format!("{base}/api/io/config"))
        .header("Content-Type", "application/json")
        .send(&payload.to_string())
        .expect("save io config")
        .body_mut()
        .read_to_string()
        .expect("read save response");
    assert!(
        save_response.contains("I/O config saved"),
        "expected save confirmation, got: {save_response}"
    );

    let io_toml = std::fs::read_to_string(project.join("io.toml")).expect("read io.toml");
    assert!(
        io_toml.contains("drivers"),
        "expected multi-driver array in io.toml, got:\n{io_toml}"
    );
    assert!(
        io_toml.contains("modbus-tcp"),
        "expected modbus-tcp entry in io.toml, got:\n{io_toml}"
    );
    assert!(
        io_toml.contains("mqtt"),
        "expected mqtt entry in io.toml, got:\n{io_toml}"
    );

    let get_body = ureq::get(&format!("{base}/api/io/config"))
        .call()
        .expect("load io config")
        .body_mut()
        .read_to_string()
        .expect("read io config body");
    let loaded: Value = serde_json::from_str(&get_body).expect("parse io config json");
    assert_eq!(
        loaded.get("source").and_then(Value::as_str),
        Some("project")
    );
    assert_eq!(
        loaded.get("use_system_io").and_then(Value::as_bool),
        Some(false)
    );
    let drivers = loaded
        .get("drivers")
        .and_then(Value::as_array)
        .expect("drivers array");
    assert_eq!(drivers.len(), 2, "expected two configured drivers");
    assert_eq!(
        drivers
            .first()
            .and_then(|entry| entry.get("name"))
            .and_then(Value::as_str),
        Some("modbus-tcp")
    );
    assert_eq!(
        drivers
            .get(1)
            .and_then(|entry| entry.get("name"))
            .and_then(Value::as_str),
        Some("mqtt")
    );
    assert_eq!(
        loaded.get("driver").and_then(Value::as_str),
        Some("modbus-tcp")
    );
    assert_eq!(
        loaded
            .get("safe_state")
            .and_then(Value::as_array)
            .map(Vec::len),
        Some(1)
    );

    let _ = std::fs::remove_dir_all(project);
}

#[test]
fn io_config_endpoint_rejects_invalid_driver_params_shape() {
    let project = make_project("invalid");
    let state = control_state(source_fixture());
    let base = start_test_server(state, project.clone());

    let payload = json!({
        "drivers": [
            {
                "name": "mqtt",
                "params": ["not", "an", "object"]
            }
        ],
        "use_system_io": false
    });

    let response = ureq::post(&format!("{base}/api/io/config"))
        .header("Content-Type", "application/json")
        .send(&payload.to_string())
        .expect("post invalid io config")
        .body_mut()
        .read_to_string()
        .expect("read error body");
    assert!(
        response.contains("error:"),
        "expected error response for invalid payload, got: {response}"
    );
    assert!(
        response.contains("params must be a table/object"),
        "expected params shape validation error, got: {response}"
    );
    assert!(
        !project.join("io.toml").exists(),
        "invalid payload must not write io.toml"
    );

    let _ = std::fs::remove_dir_all(project);
}

#[test]
fn runtime_cloud_state_endpoint_exposes_context_and_topology_contract() {
    let project = make_project("runtime-cloud-state");
    let state = control_state(source_fixture());
    let base = start_test_server(state, project.clone());

    let body = ureq::get(&format!("{base}/api/runtime-cloud/state"))
        .call()
        .expect("load runtime cloud state")
        .body_mut()
        .read_to_string()
        .expect("read runtime cloud state body");
    let payload: Value = serde_json::from_str(&body).expect("parse runtime cloud json");

    assert_eq!(
        payload.get("api_version").and_then(Value::as_str),
        Some("1.0")
    );
    assert_eq!(
        payload
            .get("context")
            .and_then(|value| value.get("connected_via"))
            .and_then(Value::as_str),
        Some("RESOURCE")
    );
    assert_eq!(
        payload
            .get("context")
            .and_then(|value| value.get("mode"))
            .and_then(Value::as_str),
        Some("edit")
    );

    let nodes = payload
        .get("topology")
        .and_then(|value| value.get("nodes"))
        .and_then(Value::as_array)
        .expect("topology.nodes");
    assert!(
        !nodes.is_empty(),
        "expected at least local runtime node in topology"
    );
    assert!(
        nodes
            .iter()
            .any(|node| node.get("runtime_id").and_then(Value::as_str) == Some("RESOURCE")),
        "expected local runtime node in topology, got: {nodes:?}"
    );

    let _ = std::fs::remove_dir_all(project);
}
