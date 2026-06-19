struct LoadedRuntime {
    bundle: Option<RuntimeBundle>,
    runtime: Runtime,
    sources: SourceRegistry,
    ide_shell_mode: bool,
}

struct SimulationPlan {
    enabled: bool,
    time_scale: u32,
    warning: String,
    controller: Option<trust_runtime::simulation::SimulationController>,
}
