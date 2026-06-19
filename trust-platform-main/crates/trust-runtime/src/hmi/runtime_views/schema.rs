pub fn build_schema(
    resource_name: &str,
    metadata: &RuntimeMetadata,
    snapshot: Option<&DebugSnapshot>,
    read_only: bool,
    customization: Option<&HmiCustomization>,
) -> HmiSchemaResult {
    let mut points = collect_points(resource_name, metadata, snapshot, read_only);

    if let Some(customization) = customization {
        for (idx, point) in points.iter_mut().enumerate() {
            point.order = idx as i32;
            if let Some(annotation) = customization.annotation_overrides.get(point.path.as_str()) {
                apply_widget_override(point, annotation);
            }
            if let Some(file_override) = customization.widget_overrides.get(point.path.as_str()) {
                apply_widget_override(point, file_override);
            }
            normalize_point(point);
        }
    }
    let (pages, page_order) = resolve_pages(&mut points, customization);
    let theme = resolve_theme(customization.map(|value| &value.theme));
    let responsive = resolve_responsive(customization.map(|value| &value.responsive));
    let export = resolve_export(customization.map(|value| &value.export));

    points.sort_by(|left, right| {
        let left_page = page_order
            .get(left.page.as_str())
            .copied()
            .unwrap_or(i32::MAX / 2);
        let right_page = page_order
            .get(right.page.as_str())
            .copied()
            .unwrap_or(i32::MAX / 2);
        left_page
            .cmp(&right_page)
            .then_with(|| left.group.cmp(&right.group))
            .then_with(|| left.order.cmp(&right.order))
            .then_with(|| left.id.cmp(&right.id))
    });

    let widgets = points
        .into_iter()
        .map(|point| HmiWidgetSchema {
            id: point.id,
            path: point.path,
            label: point.label,
            data_type: point.data_type,
            access: point.access,
            writable: point.writable,
            widget: point.widget,
            source: point.source,
            page: point.page,
            group: point.group,
            order: point.order,
            zones: point.zones,
            on_color: point.on_color,
            off_color: point.off_color,
            section_title: point.section_title,
            widget_span: point.widget_span,
            alarm_deadband: point.alarm_deadband,
            inferred_interface: point.inferred_interface,
            detail_page: point.detail_page,
            unit: point.unit,
            min: point.min,
            max: point.max,
        })
        .collect::<Vec<_>>();

    HmiSchemaResult {
        version: HMI_SCHEMA_VERSION,
        schema_revision: 0,
        mode: if read_only { "read_only" } else { "read_write" },
        read_only,
        resource: resource_name.to_string(),
        generated_at_ms: now_unix_ms(),
        descriptor_error: None,
        theme,
        responsive,
        export,
        pages,
        widgets,
    }
}
