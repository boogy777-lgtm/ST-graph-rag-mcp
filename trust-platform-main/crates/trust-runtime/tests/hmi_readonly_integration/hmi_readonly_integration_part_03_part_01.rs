use super::*;

#[test]
fn hmi_standalone_export_bundle_validates_offline_bootstrap_with_embedded_schema() {
    let state = hmi_control_state(hmi_fixture_source());
    let base = start_test_server(state);

    let export = ureq::get(&format!("{base}/hmi/export.json"))
        .call()
        .expect("get /hmi/export.json")
        .body_mut()
        .read_to_string()
        .expect("read export body");
    let root = temp_dir("export-offline-run");
    let export_path = root.join("trust-hmi-export.json");
    write_file(&export_path, export.as_str());

    let script = include_str!("../fixtures/hmi_export_offline_bundle_validation.js");

    let output = Command::new("node")
        .arg("-e")
        .arg(script)
        .env("HMI_EXPORT_BUNDLE_PATH", &export_path)
        .output()
        .expect("run node standalone bootstrap validation");
    assert!(
        output.status.success(),
        "standalone bootstrap validation failed: status={:?}, stdout={}, stderr={}",
        output.status.code(),
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr),
    );

    fs::remove_dir_all(root).ok();
}
