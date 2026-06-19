use super::*;

#[test]
fn runtime_cloud_topology_devices_get_route_removed_returns_404() {
    let project = make_project("runtime-cloud-topology-devices-get-removed");
    let pairing_path = project.join("pairings.json");
    let (pairing, engineer_token) = create_pairing_token(pairing_path, AccessRole::Engineer);
    let state = control_state_named(source_fixture(), "runtime-a");
    let base = start_test_server_with_options(
        state,
        project.clone(),
        None,
        Some(pairing),
        WebAuthMode::Token,
    );

    let mut response = ureq::get(&format!("{base}/api/runtime-cloud/topology/devices"))
        .config()
        .http_status_as_error(false)
        .build()
        .header("X-Trust-Token", engineer_token.as_str())
        .call()
        .expect("topology devices get response");
    assert_eq!(response.status().as_u16(), 404);
    let response_body = response
        .body_mut()
        .read_to_string()
        .expect("read topology devices get body");
    assert_eq!(response_body, "not found");

    let _ = std::fs::remove_dir_all(project);
}

#[test]
fn runtime_cloud_topology_devices_post_route_removed_returns_404() {
    let project = make_project("runtime-cloud-topology-devices-post-removed");
    let pairing_path = project.join("pairings.json");
    let (pairing, engineer_token) = create_pairing_token(pairing_path, AccessRole::Engineer);
    let state = control_state_named(source_fixture(), "runtime-a");
    let base = start_test_server_with_options(
        state,
        project.clone(),
        None,
        Some(pairing),
        WebAuthMode::Token,
    );

    let payload = json!({
        "api_version": "1.0",
        "actor": "local://engineer",
        "devices": []
    });
    let mut response = ureq::post(&format!("{base}/api/runtime-cloud/topology/devices"))
        .config()
        .http_status_as_error(false)
        .build()
        .header("Content-Type", "application/json")
        .header("X-Trust-Token", engineer_token.as_str())
        .send(&payload.to_string())
        .expect("topology devices post response");
    assert_eq!(response.status().as_u16(), 404);
    let response_body = response
        .body_mut()
        .read_to_string()
        .expect("read topology devices post body");
    assert_eq!(response_body, "not found");

    let _ = std::fs::remove_dir_all(project);
}
