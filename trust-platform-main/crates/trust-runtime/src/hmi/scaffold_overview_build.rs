fn build_tiered_overview_sections(points: Vec<ScaffoldPoint>) -> ScaffoldOverviewResult {
    if points.is_empty() {
        return ScaffoldOverviewResult {
            sections: Vec::new(),
            equipment_groups: Vec::new(),
        };
    }

    let mut hero: Vec<ScaffoldPoint> = Vec::new();
    let mut status: Vec<ScaffoldPoint> = Vec::new();
    let mut module_groups: IndexMap<String, Vec<ScaffoldPoint>> = IndexMap::new();
    let mut detail: Vec<ScaffoldPoint> = Vec::new();

    for point in points {
        match classify_overview_category(&point) {
            ScaffoldOverviewCategory::Kpi | ScaffoldOverviewCategory::Inventory => {
                if point.type_bucket == ScaffoldTypeBucket::Numeric && hero.len() < 3 {
                    hero.push(point);
                } else {
                    detail.push(point);
                }
            }
            ScaffoldOverviewCategory::SafetyAlarm | ScaffoldOverviewCategory::CommandMode => {
                status.push(point);
            }
            ScaffoldOverviewCategory::Deviation | ScaffoldOverviewCategory::Diagnostic => {
                detail.push(point);
            }
        }
    }

    // Detect equipment instance groups from the detail bucket.
    // Points whose raw_name shares an instance prefix (e.g. "pump1_speed",
    // "pump1_pressure") get promoted to module blocks when ≥2 variables share
    // the same prefix.
    let mut remaining_detail = Vec::new();
    for point in detail {
        if let Some(prefix) = infer_instance_prefix(&point.raw_name) {
            module_groups.entry(prefix).or_default().push(point);
        } else {
            remaining_detail.push(point);
        }
    }

    // Only keep groups with 2+ variables as module blocks; demote singletons
    // back to detail.
    let mut equipment_strip_widgets: Vec<ScaffoldPoint> = Vec::new();
    let mut equipment_detail_groups: Vec<ScaffoldEquipmentGroup> = Vec::new();
    for (prefix, group) in module_groups {
        if group.len() >= 2 {
            let title = infer_label(&prefix);
            let detail_page_id = format!("equipment-{}", prefix.replace('_', "-"));
            // Pick a representative widget for the equipment strip:
            // prefer a boolean (running/on-off), else first numeric.
            let rep_idx = group
                .iter()
                .position(|p| p.type_bucket == ScaffoldTypeBucket::Bool)
                .unwrap_or(0);
            let mut rep = group[rep_idx].clone();
            rep.widget = "module".to_string();
            rep.label = title.clone();
            equipment_strip_widgets.push(rep);
            equipment_detail_groups.push(ScaffoldEquipmentGroup {
                prefix: prefix.clone(),
                title,
                detail_page_id,
                widgets: group,
            });
        } else {
            remaining_detail.extend(group);
        }
    }

    let mut sections = Vec::new();

    // Equipment strip comes FIRST (module tier)
    if !equipment_strip_widgets.is_empty() {
        sections.push(ScaffoldSection {
            title: "Equipment".to_string(),
            span: 12,
            tier: Some("module".to_string()),
            widgets: equipment_strip_widgets,
        });
    }

    if !hero.is_empty() {
        sections.push(ScaffoldSection {
            title: "Key Metrics".to_string(),
            span: 12,
            tier: Some("hero".to_string()),
            widgets: hero,
        });
    }

    if !status.is_empty() {
        sections.push(ScaffoldSection {
            title: "Status".to_string(),
            span: 12,
            tier: Some("status".to_string()),
            widgets: status,
        });
    }

    if !remaining_detail.is_empty() {
        sections.push(ScaffoldSection {
            title: "Details".to_string(),
            span: 12,
            tier: Some("detail".to_string()),
            widgets: remaining_detail,
        });
    }

    ScaffoldOverviewResult {
        sections,
        equipment_groups: equipment_detail_groups,
    }
}

