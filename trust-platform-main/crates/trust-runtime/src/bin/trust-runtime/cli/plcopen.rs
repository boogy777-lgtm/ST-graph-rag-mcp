#[derive(Debug, Subcommand)]
pub enum PlcopenAction {
    /// Print supported PLCopen profile and ST-complete contract.
    Profile {
        /// Print machine-readable JSON.
        #[arg(long, action = ArgAction::SetTrue)]
        json: bool,
    },
    /// Export project sources to PLCopen XML.
    Export {
        /// Project folder directory (defaults to auto-detect or current directory).
        #[arg(long = "project", alias = "bundle")]
        project: Option<PathBuf>,
        /// Output XML file path (defaults to <project>/interop/plcopen.xml).
        #[arg(long = "output")]
        output: Option<PathBuf>,
        /// Target vendor adapter profile (`generic`, `ab`, `siemens`, `schneider`).
        #[arg(long = "target", value_enum, default_value_t = PlcopenExportTargetArg::Generic)]
        target: PlcopenExportTargetArg,
        /// Print machine-readable JSON report.
        #[arg(long, action = ArgAction::SetTrue)]
        json: bool,
    },
    /// Import PLCopen XML into project sources.
    Import {
        /// Input PLCopen XML file.
        #[arg(long = "input")]
        input: PathBuf,
        /// Project folder directory (defaults to auto-detect or current directory).
        #[arg(long = "project", alias = "bundle")]
        project: Option<PathBuf>,
        /// Print machine-readable JSON report.
        #[arg(long, action = ArgAction::SetTrue)]
        json: bool,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum PlcopenExportTargetArg {
    Generic,
    #[value(
        alias = "allen-bradley",
        alias = "rockwell",
        alias = "rockwell-studio5000"
    )]
    Ab,
    #[value(alias = "siemens-tia")]
    Siemens,
    #[value(alias = "schneider-ecostruxure", alias = "ecostruxure")]
    Schneider,
}
