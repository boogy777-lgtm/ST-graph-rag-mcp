fn execute_case(case: &CaseDefinition) -> anyhow::Result<CaseArtifact> {
    let sources = load_case_sources(case)?;
    match case.manifest.kind {
        CaseKind::Runtime => execute_runtime_case(case, &sources),
        CaseKind::CompileError => execute_compile_error_case(case, &sources),
    }
}

fn load_case_sources(case: &CaseDefinition) -> anyhow::Result<Vec<String>> {
    let mut sources = Vec::with_capacity(case.manifest.sources.len());
    for file in &case.manifest.sources {
        let path = case.dir.join(file);
        let text = fs::read_to_string(&path)
            .with_context(|| format!("read case source '{}'", path.display()))?;
        sources.push(text);
    }
    Ok(sources)
}

fn execute_runtime_case(case: &CaseDefinition, sources: &[String]) -> anyhow::Result<CaseArtifact> {
    let cycles = case.manifest.cycles;
    if cycles == 0 {
        bail!("runtime case '{}' must declare cycles > 0", case.id);
    }
    validate_series_lengths(case, cycles)?;

    let source_refs = sources.iter().map(String::as_str).collect::<Vec<_>>();
    let mut harness =
        TestHarness::from_sources(&source_refs).map_err(|err| anyhow!(err.to_string()))?;

    let mut trace = Vec::with_capacity(cycles as usize);
    for cycle_idx in 0..(cycles as usize) {
        let cycle_number = u32::try_from(cycle_idx + 1).unwrap_or(u32::MAX);
        for restart in case
            .manifest
            .restarts
            .iter()
            .filter(|entry| entry.before_cycle == cycle_number)
        {
            let mode = parse_restart_mode(&restart.mode)?;
            harness
                .restart(mode)
                .map_err(|err| anyhow!("restart before cycle {cycle_number} failed: {err}"))?;
        }

        if !case.manifest.advance_ms.is_empty() {
            let advance = case.manifest.advance_ms[cycle_idx];
            harness.advance_time(Duration::from_millis(advance));
        }

        for (name, series) in &case.manifest.input_series {
            let raw = &series[cycle_idx];
            if should_skip_step_value(raw) {
                continue;
            }
            let value = parse_typed_value(raw)
                .with_context(|| format!("parse input series value for '{name}'"))?;
            harness.set_input(name, value);
        }

        for (address, series) in &case.manifest.direct_input_series {
            let raw = &series[cycle_idx];
            if should_skip_step_value(raw) {
                continue;
            }
            let value = parse_typed_value(raw)
                .with_context(|| format!("parse direct input value for '{address}'"))?;
            harness
                .set_direct_input(address, value)
                .with_context(|| format!("set direct input '{address}'"))?;
        }

        let cycle_result = harness.cycle();
        let mut globals = BTreeMap::new();
        for name in &case.manifest.watch_globals {
            let value = harness
                .get_output(name)
                .ok_or_else(|| anyhow!("watch global '{name}' is missing"))?;
            globals.insert(name.clone(), encode_value(&value));
        }

        let mut direct = BTreeMap::new();
        for address in &case.manifest.watch_direct {
            let value = harness
                .get_direct_output(address)
                .with_context(|| format!("read direct output '{address}'"))?;
            direct.insert(address.clone(), encode_value(&value));
        }

        let errors = cycle_result
            .errors
            .iter()
            .map(std::string::ToString::to_string)
            .collect::<Vec<_>>();

        trace.push(json!({
            "cycle": cycle_result.cycle_number,
            "runtime_time_nanos": cycle_result.elapsed_time.as_nanos(),
            "globals": globals,
            "direct": direct,
            "errors": errors
        }));
    }

    Ok(CaseArtifact {
        payload: json!({
            "version": 1,
            "case_id": case.id,
            "category": case.category,
            "kind": "runtime",
            "description": case.manifest.description,
            "cycles": cycles,
            "trace": trace
        }),
        cycles: Some(u64::from(cycles)),
    })
}

fn execute_compile_error_case(
    case: &CaseDefinition,
    sources: &[String],
) -> anyhow::Result<CaseArtifact> {
    let source_refs = sources.iter().map(String::as_str).collect::<Vec<_>>();
    let compile_result = TestHarness::from_sources(&source_refs);
    let (compiled, error) = match compile_result {
        Ok(_) => (true, None),
        Err(err) => (false, Some(err.to_string())),
    };
    Ok(CaseArtifact {
        payload: json!({
            "version": 1,
            "case_id": case.id,
            "category": case.category,
            "kind": "compile_error",
            "description": case.manifest.description,
            "compiled": compiled,
            "error": error
        }),
        cycles: None,
    })
}
