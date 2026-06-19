fn build_simulation_plan(
    bundle: Option<&RuntimeBundle>,
    simulation: bool,
    time_scale: u32,
) -> anyhow::Result<SimulationPlan> {
    if time_scale == 0 {
        anyhow::bail!("--time-scale must be >= 1");
    }

    let mut simulation_config = bundle
        .and_then(|bundle| bundle.simulation.clone())
        .unwrap_or_default();
    if simulation || time_scale > 1 {
        simulation_config.enabled = true;
    }
    if time_scale > 1 {
        simulation_config.time_scale = time_scale;
    }
    if simulation_config.time_scale == 0 {
        anyhow::bail!("simulation.time_scale must be >= 1");
    }

    let enabled = simulation_config.enabled;
    let time_scale = simulation_config.time_scale.max(1);
    let warning = simulation_warning_message(enabled, time_scale).unwrap_or_default();
    let controller = enabled.then(|| trust_runtime::simulation::SimulationController::new(simulation_config));

    Ok(SimulationPlan {
        enabled,
        time_scale,
        warning,
        controller,
    })
}
