//! Shell completions generator.

use clap::CommandFactory;
use clap_complete::{generate, Shell};

use crate::cli::Cli;

pub fn run_completions(shell: Shell) -> anyhow::Result<()> {
    let mut cmd = Cli::command();
    generate(shell, &mut cmd, "trust-runtime", &mut std::io::stdout());
    Ok(())
}
