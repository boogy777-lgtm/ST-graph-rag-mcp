use tracing::info;
use trust_debug::{DebugAdapter, DebugSession};
use trust_runtime::Runtime;

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .with_writer(std::io::stderr)
        .init();

    info!("Starting trust-debug adapter");
    let runtime = Runtime::new();
    let session = DebugSession::new(runtime);
    let mut adapter = DebugAdapter::new(session);
    if let Err(err) = adapter.run_stdio() {
        eprintln!("trust-debug error: {err}");
        std::process::exit(1);
    }
}
