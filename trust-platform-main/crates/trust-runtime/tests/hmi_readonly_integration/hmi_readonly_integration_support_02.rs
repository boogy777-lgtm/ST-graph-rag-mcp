use super::*;

pub(super) fn post_control(
    base: &str,
    request_type: &str,
    params: Option<serde_json::Value>,
) -> serde_json::Value {
    let mut payload = json!({
        "id": 1u64,
        "type": request_type,
    });
    if let Some(params) = params {
        payload["params"] = params;
    }
    let mut response = ureq::post(&format!("{base}/api/control"))
        .header("Content-Type", "application/json")
        .send(&payload.to_string())
        .expect("post control request");
    let body = response
        .body_mut()
        .read_to_string()
        .expect("read control response body");
    serde_json::from_str(&body).expect("parse control response body")
}

pub(super) fn websocket_url(base: &str) -> String {
    let authority = base.strip_prefix("http://").unwrap_or(base);
    format!("ws://{authority}/ws/hmi")
}

pub(super) fn wait_for_ws_event<S>(
    socket: &mut tungstenite::WebSocket<S>,
    expected_type: &str,
    timeout: Duration,
) -> serde_json::Value
where
    S: Read + Write,
{
    let deadline = Instant::now() + timeout;
    loop {
        let message = match socket.read() {
            Ok(message) => message,
            Err(tungstenite::Error::Io(err))
                if matches!(err.kind(), ErrorKind::TimedOut | ErrorKind::WouldBlock) =>
            {
                if Instant::now() >= deadline {
                    break;
                }
                continue;
            }
            Err(err) => panic!("read websocket message: {err}"),
        };
        if !message.is_text() {
            if Instant::now() >= deadline {
                break;
            }
            continue;
        }
        let payload: serde_json::Value = serde_json::from_str(
            message
                .into_text()
                .expect("websocket text payload")
                .as_str(),
        )
        .expect("parse websocket payload");
        if payload
            .get("type")
            .and_then(|value| value.as_str())
            .is_some_and(|value| value == expected_type)
        {
            return payload;
        }
        if Instant::now() >= deadline {
            break;
        }
    }
    panic!("timed out waiting for websocket event type {expected_type}");
}

pub(super) fn configure_ws_read_timeout(
    socket: &mut tungstenite::WebSocket<tungstenite::stream::MaybeTlsStream<TcpStream>>,
) {
    if let tungstenite::stream::MaybeTlsStream::Plain(stream) = socket.get_mut() {
        stream
            .set_read_timeout(Some(Duration::from_millis(200)))
            .expect("set websocket read timeout");
    }
}

pub(super) fn percentile_ms(samples: &[u128], percentile: usize) -> u128 {
    assert!(!samples.is_empty(), "samples must not be empty");
    assert!(percentile <= 100, "percentile must be <= 100");
    let mut sorted = samples.to_vec();
    sorted.sort_unstable();
    let rank = ((sorted.len() - 1) * percentile) / 100;
    sorted[rank]
}

pub(super) fn hmi_fixture_source() -> &'static str {
    r#"
TYPE MODE : (OFF, AUTO); END_TYPE

PROGRAM Main
VAR
    run : BOOL := TRUE;
    // @hmi(min=0, max=100)
    speed : REAL := 42.5;
    mode : MODE := MODE#AUTO;
    name : STRING := 'pump';
END_VAR
END_PROGRAM
"#
}

pub(super) fn build_hmi_script_bundle(js_path: &Path) -> PathBuf {
    let root = js_path.parent().expect("hmi.js parent");
    let modules_root = root.join("modules");
    let mut bundled = String::new();
    for module_path in HMI_MODULE_PATHS {
        let relative = module_path.trim_start_matches('/');
        let module_file = root.join(relative.strip_prefix("hmi/").unwrap_or(relative));
        let content = resolve_module_with_parts(&module_file, &modules_root)
            .unwrap_or_else(|| panic!("read {}", module_file.display()));
        bundled.push_str(content.as_str());
        bundled.push('\n');
    }
    bundled.push_str(resolve_hmi_app_source(js_path, root).as_str());

    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    let bundle_path = std::env::temp_dir().join(format!("trust-hmi-script-bundle-{unique}.js"));
    fs::write(&bundle_path, bundled).expect("write hmi script bundle");
    bundle_path
}

fn resolve_hmi_app_source(js_path: &Path, root: &Path) -> String {
    let app = fs::read_to_string(js_path).expect("read hmi.js");
    if !app.contains("Source moved into chunk files") {
        return app;
    }
    let mut bundled = String::new();
    for chunk_path in HMI_APP_CHUNK_PATHS {
        let source_path = root.join(chunk_path);
        let chunk_source = fs::read_to_string(&source_path)
            .unwrap_or_else(|_| panic!("read {}", source_path.display()));
        bundled.push_str(chunk_source.as_str());
        bundled.push('\n');
    }
    bundled
}

fn resolve_module_with_parts(module_file: &Path, modules_root: &Path) -> Option<String> {
    let file_name = module_file.file_name()?.to_str()?;
    let mut source = fs::read_to_string(module_file).ok()?;
    if file_name.contains("-part-") {
        return Some(source);
    }

    let stem = file_name.strip_suffix(".js")?;
    let prefix = format!("{stem}-part-");
    let mut parts: Vec<(String, String)> = fs::read_dir(modules_root)
        .ok()?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let entry_name = entry.file_name().to_string_lossy().to_string();
            if !entry_name.starts_with(&prefix) || !entry_name.ends_with(".js") {
                return None;
            }
            fs::read_to_string(entry.path())
                .ok()
                .map(|content| (entry_name, content))
        })
        .collect();

    parts.sort_by(|(left_name, _), (right_name, _)| {
        module_part_sort_key(stem, left_name)
            .cmp(&module_part_sort_key(stem, right_name))
            .then_with(|| left_name.cmp(right_name))
    });

    for (_, part_source) in parts {
        source.push('\n');
        source.push_str(&part_source);
    }
    Some(source)
}

fn module_part_sort_key(stem: &str, file_name: &str) -> Vec<u32> {
    let trimmed = file_name.strip_suffix(".js").unwrap_or(file_name);
    let suffix = trimmed.strip_prefix(stem).unwrap_or(trimmed);
    let mut key = Vec::new();
    for segment in suffix.split("-part-").skip(1) {
        let digits: String = segment
            .chars()
            .take_while(|ch| ch.is_ascii_digit())
            .collect();
        key.push(digits.parse::<u32>().unwrap_or(u32::MAX));
    }
    if key.is_empty() {
        key.push(u32::MAX);
    }
    key
}

pub(super) fn run_node_hmi_script(js_path: &Path, script: &str, context: &str) {
    let bundle_path = build_hmi_script_bundle(js_path);
    let output = Command::new("node")
        .arg("-e")
        .arg(script)
        .env("HMI_JS_PATH", &bundle_path)
        .output()
        .expect("run node script");
    fs::remove_file(bundle_path).ok();
    assert!(
        output.status.success(),
        "node script failed ({context}): status={:?}, stdout={}, stderr={}",
        output.status.code(),
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}

pub(super) const HMI_APP_CHUNK_PATHS: [&str; 3] = [
    "chunks/hmi-js/hmi-01.js",
    "chunks/hmi-js/hmi-02.js",
    "chunks/hmi-js/hmi-03.js",
];

pub(super) const HMI_MODULE_PATHS: [&str; 10] = [
    "/hmi/modules/hmi-model-descriptor.js",
    "/hmi/modules/hmi-model-layout.js",
    "/hmi/modules/hmi-model-navigation.js",
    "/hmi/modules/hmi-model.js",
    "/hmi/modules/hmi-renderers.js",
    "/hmi/modules/hmi-widgets.js",
    "/hmi/modules/hmi-trends-alarms.js",
    "/hmi/modules/hmi-process-view.js",
    "/hmi/modules/hmi-transport.js",
    "/hmi/modules/hmi-pages.js",
];
