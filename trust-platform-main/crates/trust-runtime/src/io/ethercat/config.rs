impl EthercatConfig {
    pub fn from_params(value: &toml::Value) -> Result<Self, RuntimeError> {
        let parsed: EthercatToml = value
            .clone()
            .try_into()
            .map_err(|err| RuntimeError::InvalidConfig(format!("io.params: {err}").into()))?;

        let adapter = parsed
            .adapter
            .unwrap_or_else(|| "mock".to_string())
            .trim()
            .to_string();
        if adapter.is_empty() {
            return Err(RuntimeError::InvalidConfig(
                "io.params.adapter must not be empty".into(),
            ));
        }

        let timeout = StdDuration::from_millis(parsed.timeout_ms.unwrap_or(250).max(1));
        let cycle_warn = StdDuration::from_millis(parsed.cycle_warn_ms.unwrap_or(5).max(1));
        let on_error = parsed
            .on_error
            .as_deref()
            .map(IoDriverErrorPolicy::parse)
            .transpose()?
            .unwrap_or(IoDriverErrorPolicy::Fault);

        let modules = parse_modules(parsed.modules)?;
        let (expected_input_bytes, expected_output_bytes) = expected_image_sizes(&modules);
        let mock_inputs = parse_mock_inputs(parsed.mock_inputs)?;

        Ok(Self {
            adapter: SmolStr::new(adapter),
            timeout,
            cycle_warn,
            on_error,
            modules,
            expected_input_bytes,
            expected_output_bytes,
            mock_inputs,
            mock_latency: StdDuration::from_millis(parsed.mock_latency_ms.unwrap_or(0)),
            mock_fail_read: parsed.mock_fail_read.unwrap_or(false),
            mock_fail_write: parsed.mock_fail_write.unwrap_or(false),
        })
    }
}

fn parse_modules(
    modules: Option<Vec<EthercatModuleToml>>,
) -> Result<Vec<EthercatModuleConfig>, RuntimeError> {
    let modules = modules.unwrap_or_else(default_modules);
    if modules.is_empty() {
        return Err(RuntimeError::InvalidConfig(
            "io.params.modules must contain at least one module".into(),
        ));
    }
    let mut normalized = modules
        .into_iter()
        .enumerate()
        .map(|(idx, module)| {
            let model = module.model.trim().to_ascii_uppercase();
            if model.is_empty() {
                return Err(RuntimeError::InvalidConfig(
                    format!("io.params.modules[{idx}].model must not be empty").into(),
                ));
            }
            let kind = module_kind(&model).ok_or_else(|| {
                RuntimeError::InvalidConfig(
                    format!(
                        "io.params.modules[{idx}].model '{model}' is unsupported in ethercat v1"
                    )
                    .into(),
                )
            })?;
            let slot = module.slot.unwrap_or(idx as u16);
            let channels = module
                .channels
                .unwrap_or_else(|| default_channels_for_kind(kind))
                .max(1);
            if matches!(kind, EthercatModuleKind::Coupler) && channels != 1 {
                return Err(RuntimeError::InvalidConfig(
                    format!(
                        "io.params.modules[{idx}] coupler '{}' must use channels = 1",
                        model
                    )
                    .into(),
                ));
            }
            Ok(EthercatModuleConfig {
                model: SmolStr::new(model),
                slot,
                channels,
            })
        })
        .collect::<Result<Vec<_>, _>>()?;
    normalized.sort_by_key(|module| module.slot);
    Ok(normalized)
}

fn expected_image_sizes(modules: &[EthercatModuleConfig]) -> (usize, usize) {
    let (input_bits, output_bits) = modules.iter().fold((0usize, 0usize), |acc, module| {
        let (input, output) = module_io_bits(module);
        (acc.0.saturating_add(input), acc.1.saturating_add(output))
    });
    (input_bits.div_ceil(8), output_bits.div_ceil(8))
}

fn module_io_bits(module: &EthercatModuleConfig) -> (usize, usize) {
    match module_kind(module.model.as_str()) {
        Some(EthercatModuleKind::Coupler) | None => (0, 0),
        Some(EthercatModuleKind::DigitalInput) => (module.channels as usize, 0),
        Some(EthercatModuleKind::DigitalOutput) => (0, module.channels as usize),
    }
}

fn parse_mock_inputs(inputs: Option<Vec<String>>) -> Result<Vec<Vec<u8>>, RuntimeError> {
    let Some(inputs) = inputs else {
        return Ok(Vec::new());
    };
    inputs
        .into_iter()
        .enumerate()
        .map(|(idx, text)| {
            parse_hex_bytes(&text).map_err(|err| {
                RuntimeError::InvalidConfig(
                    format!("io.params.mock_inputs[{idx}] invalid hex payload: {err}").into(),
                )
            })
        })
        .collect()
}

fn parse_hex_bytes(text: &str) -> Result<Vec<u8>, &'static str> {
    let compact = text
        .chars()
        .filter(|ch| !ch.is_whitespace())
        .collect::<String>();
    if compact.is_empty() {
        return Ok(Vec::new());
    }
    if compact.len() % 2 != 0 {
        return Err("expected even number of hex characters");
    }
    let mut bytes = Vec::with_capacity(compact.len() / 2);
    for idx in (0..compact.len()).step_by(2) {
        let value =
            u8::from_str_radix(&compact[idx..idx + 2], 16).map_err(|_| "invalid hex digit")?;
        bytes.push(value);
    }
    Ok(bytes)
}

fn module_kind(model: &str) -> Option<EthercatModuleKind> {
    if model.eq_ignore_ascii_case("EK1100") {
        return Some(EthercatModuleKind::Coupler);
    }
    if model.starts_with("EL1") {
        return Some(EthercatModuleKind::DigitalInput);
    }
    if model.starts_with("EL2") {
        return Some(EthercatModuleKind::DigitalOutput);
    }
    None
}

fn default_channels_for_kind(kind: EthercatModuleKind) -> u16 {
    match kind {
        EthercatModuleKind::Coupler => 1,
        EthercatModuleKind::DigitalInput | EthercatModuleKind::DigitalOutput => 8,
    }
}

fn default_modules() -> Vec<EthercatModuleToml> {
    vec![
        EthercatModuleToml {
            model: "EK1100".to_string(),
            slot: Some(0),
            channels: Some(1),
        },
        EthercatModuleToml {
            model: "EL1008".to_string(),
            slot: Some(1),
            channels: Some(8),
        },
        EthercatModuleToml {
            model: "EL2008".to_string(),
            slot: Some(2),
            channels: Some(8),
        },
    ]
}
