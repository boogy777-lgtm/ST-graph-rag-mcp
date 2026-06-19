//! Generate a runtime bundle bytecode image from sources.

use clap::Parser;
use std::path::PathBuf;

use trust_runtime::bundle_builder::build_program_stbc;

#[derive(Debug, Parser)]
#[command(
    name = "trust-bundle-gen",
    about = "Generate program.stbc for a runtime bundle"
)]
struct Args {
    /// Runtime bundle directory.
    #[arg(long, value_name = "DIR")]
    bundle: PathBuf,
}

fn main() -> anyhow::Result<()> {
    let args = Args::parse();
    let report = build_program_stbc(&args.bundle, None)?;
    println!("Wrote {}", report.program_path.display());
    Ok(())
}
