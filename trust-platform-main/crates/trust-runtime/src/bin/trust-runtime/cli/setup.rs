#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum SetupModeArg {
    Browser,
    Cli,
    Cancel,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum SetupAccessArg {
    Local,
    Remote,
}
