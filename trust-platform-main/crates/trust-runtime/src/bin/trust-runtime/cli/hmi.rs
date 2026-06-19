#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum HmiStyleArg {
    Industrial,
    Classic,
    Mint,
}

impl HmiStyleArg {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Industrial => "industrial",
            Self::Classic => "classic",
            Self::Mint => "mint",
        }
    }
}

#[derive(Debug, Subcommand)]
pub enum HmiAction {
    /// Auto-generate `hmi/` scaffold pages from source metadata.
    Init {
        /// Theme style for generated `_config.toml`.
        #[arg(long, value_enum, default_value_t = HmiStyleArg::Industrial)]
        style: HmiStyleArg,
        /// Allow init to overwrite an existing non-empty `hmi/` directory.
        #[arg(long, action = ArgAction::SetTrue)]
        force: bool,
    },
    /// Merge missing scaffold pages/signals into an existing `hmi/` directory.
    Update {
        /// Theme style used when creating new scaffold files.
        #[arg(long, value_enum, default_value_t = HmiStyleArg::Industrial)]
        style: HmiStyleArg,
    },
    /// Regenerate scaffold-owned files and create a backup snapshot.
    Reset {
        /// Theme style for regenerated scaffold files.
        #[arg(long, value_enum, default_value_t = HmiStyleArg::Industrial)]
        style: HmiStyleArg,
    },
}
