use super::*;

pub(super) fn load_hmi_runtime_script_bundle(base: &str) -> String {
    let mut app_js = ureq::get(&format!("{base}/hmi/app.js"))
        .call()
        .expect("get /hmi/app.js")
        .body_mut()
        .read_to_string()
        .expect("read /hmi/app.js body");
    for module_path in HMI_MODULE_PATHS {
        let module_js = ureq::get(&format!("{base}{module_path}"))
            .call()
            .unwrap_or_else(|_| panic!("get {module_path}"))
            .body_mut()
            .read_to_string()
            .unwrap_or_else(|_| panic!("read {module_path} body"));
        app_js.push('\n');
        app_js.push_str(module_js.as_str());
    }
    app_js
}

pub(super) fn extract_svg_ids(svg: &str) -> BTreeSet<String> {
    svg.split("id=\"")
        .skip(1)
        .filter_map(|tail| tail.split('"').next())
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .map(ToString::to_string)
        .collect()
}

pub(super) fn extract_quoted_values_from_lines(text: &str, prefix: &str) -> Vec<String> {
    text.lines()
        .filter_map(|line| {
            let line = line.trim();
            if !line.starts_with(prefix) {
                return None;
            }
            let mut parts = line.splitn(2, '"');
            let _ = parts.next();
            let tail = parts.next()?;
            let value = tail.split('"').next()?.trim();
            if value.is_empty() {
                None
            } else {
                Some(value.to_string())
            }
        })
        .collect()
}
