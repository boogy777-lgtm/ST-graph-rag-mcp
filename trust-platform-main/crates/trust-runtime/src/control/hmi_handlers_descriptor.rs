pub(super) fn handle_hmi_descriptor_get(id: u64, state: &ControlState) -> ControlResponse {
    let descriptor = hmi_descriptor_snapshot(state);
    if let Some(dir) = descriptor.customization.dir_descriptor().cloned() {
        return ControlResponse::ok(
            id,
            serde_json::to_value(dir).expect("serialize hmi.descriptor.get"),
        );
    }

    let metadata = match state.metadata.lock() {
        Ok(guard) => guard,
        Err(_) => return ControlResponse::error(id, "metadata unavailable".into()),
    };
    let snapshot = load_runtime_snapshot(state);
    let schema = crate::hmi::build_schema(
        state.resource_name.as_str(),
        &metadata,
        snapshot.as_ref(),
        true,
        Some(&descriptor.customization),
    );
    let inferred = descriptor_from_schema(&schema);
    ControlResponse::ok(
        id,
        serde_json::to_value(inferred).expect("serialize inferred hmi descriptor"),
    )
}

pub(super) fn handle_hmi_descriptor_update(
    id: u64,
    params: Option<serde_json::Value>,
    state: &ControlState,
) -> ControlResponse {
    let params = match params {
        Some(value) => match serde_json::from_value::<HmiDescriptorUpdateParams>(value) {
            Ok(parsed) => parsed,
            Err(err) => return ControlResponse::error(id, format!("invalid params: {err}")),
        },
        None => return ControlResponse::error(id, "missing params".into()),
    };
    let project_root = match state.project_root.as_ref() {
        Some(path) => path,
        None => {
            return ControlResponse::error(
                id,
                "hmi.descriptor.update requires a project bundle".into(),
            )
        }
    };

    let metadata = match state.metadata.lock() {
        Ok(guard) => guard,
        Err(_) => return ControlResponse::error(id, "metadata unavailable".into()),
    };
    let snapshot = load_runtime_snapshot(state);
    let diagnostics = crate::hmi::validate_hmi_bindings(
        state.resource_name.as_str(),
        &metadata,
        snapshot.as_ref(),
        &params.descriptor,
    );
    if !diagnostics.is_empty() {
        return ControlResponse::error(
            id,
            format!(
                "descriptor validation failed ({} issue(s), first: {} [{}])",
                diagnostics.len(),
                diagnostics[0].message,
                diagnostics[0].code
            ),
        );
    }
    drop(metadata);

    let files = match crate::hmi::write_hmi_dir_descriptor(project_root, &params.descriptor) {
        Ok(files) => files,
        Err(err) => {
            return ControlResponse::error(id, format!("descriptor write failed: {err}"));
        }
    };
    let revision = match reload_hmi_descriptor_state(state) {
        Ok(revision) => revision,
        Err(err) => return ControlResponse::error(id, format!("descriptor reload failed: {err}")),
    };
    ControlResponse::ok(
        id,
        json!({
            "status": "updated",
            "schema_revision": revision,
            "files": files,
        }),
    )
}

pub(super) fn handle_hmi_scaffold_reset(
    id: u64,
    params: Option<serde_json::Value>,
    state: &ControlState,
) -> ControlResponse {
    let params = match params {
        Some(value) => match serde_json::from_value::<HmiScaffoldResetParams>(value) {
            Ok(parsed) => parsed,
            Err(err) => return ControlResponse::error(id, format!("invalid params: {err}")),
        },
        None => HmiScaffoldResetParams::default(),
    };
    let project_root = match state.project_root.as_ref() {
        Some(path) => path,
        None => {
            return ControlResponse::error(
                id,
                "hmi.scaffold.reset requires a project bundle".into(),
            )
        }
    };

    let mode = match params
        .mode
        .as_deref()
        .map(|value| value.trim().to_ascii_lowercase())
    {
        Some(mode) if mode == "update" => crate::hmi::HmiScaffoldMode::Update,
        Some(mode) if mode == "reset" || mode.is_empty() => crate::hmi::HmiScaffoldMode::Reset,
        Some(mode) => {
            return ControlResponse::error(
                id,
                format!("invalid scaffold mode '{mode}' (expected update|reset)"),
            )
        }
        None => crate::hmi::HmiScaffoldMode::Reset,
    };
    let style = params
        .style
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| {
            hmi_descriptor_snapshot(state)
                .customization
                .dir_descriptor()
                .and_then(|descriptor| descriptor.config.theme.style.clone())
        })
        .unwrap_or_else(|| "industrial".to_string());

    let metadata = match state.metadata.lock() {
        Ok(guard) => guard,
        Err(_) => return ControlResponse::error(id, "metadata unavailable".into()),
    };
    let snapshot = load_runtime_snapshot(state);
    let source_refs = state
        .sources
        .files()
        .iter()
        .map(|file| crate::hmi::HmiSourceRef {
            path: file.path.as_path(),
            text: file.text.as_str(),
        })
        .collect::<Vec<_>>();
    let summary = match crate::hmi::scaffold_hmi_dir_with_sources_mode(
        project_root,
        &metadata,
        snapshot.as_ref(),
        &source_refs,
        style.as_str(),
        mode,
        false,
    ) {
        Ok(summary) => summary,
        Err(err) => {
            return ControlResponse::error(id, format!("failed to reset scaffold: {err}"));
        }
    };
    drop(metadata);

    let revision = match reload_hmi_descriptor_state(state) {
        Ok(revision) => revision,
        Err(err) => return ControlResponse::error(id, format!("descriptor reload failed: {err}")),
    };

    ControlResponse::ok(
        id,
        json!({
            "status": "updated",
            "mode": mode.as_str(),
            "style": summary.style,
            "schema_revision": revision,
            "files": summary.files,
        }),
    )
}

