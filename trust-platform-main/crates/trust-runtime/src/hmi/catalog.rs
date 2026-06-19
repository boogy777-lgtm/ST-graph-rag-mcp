pub fn collect_hmi_bindings_catalog(
    metadata: &RuntimeMetadata,
    snapshot: Option<&DebugSnapshot>,
    sources: &[HmiSourceRef<'_>],
) -> HmiBindingsCatalog {
    let source_index = collect_source_symbol_index(sources);
    let points = collect_scaffold_points(metadata, snapshot, &source_index);
    let mut programs = BTreeMap::<String, HmiBindingsProgram>::new();
    let mut globals = Vec::new();

    for point in points {
        let program_key = point.program.to_ascii_uppercase();
        let variable = HmiBindingsVariable {
            name: point.raw_name.clone(),
            path: point.path.clone(),
            data_type: point.data_type.clone(),
            qualifier: point.qualifier.qualifier_label().to_string(),
            writable: point.writable,
            inferred_interface: point.inferred_interface,
            unit: point.unit.clone(),
            min: point.min,
            max: point.max,
            enum_values: point.enum_values.clone(),
        };

        if point.program.eq_ignore_ascii_case("global") {
            globals.push(variable);
            continue;
        }

        let entry = programs
            .entry(point.program.clone())
            .or_insert_with(|| HmiBindingsProgram {
                name: point.program.clone(),
                file: source_index.program_files.get(&program_key).cloned(),
                variables: Vec::new(),
            });
        if entry.file.is_none() {
            entry.file = source_index.program_files.get(&program_key).cloned();
        }
        entry.variables.push(variable);
    }

    let mut program_entries = programs.into_values().collect::<Vec<_>>();
    for program in &mut program_entries {
        program.variables.sort_by(|left, right| {
            left.path
                .cmp(&right.path)
                .then_with(|| left.name.cmp(&right.name))
        });
    }
    program_entries.sort_by(|left, right| left.name.cmp(&right.name));

    globals.sort_by(|left, right| {
        left.path
            .cmp(&right.path)
            .then_with(|| left.name.cmp(&right.name))
    });

    HmiBindingsCatalog {
        programs: program_entries,
        globals,
    }
}
