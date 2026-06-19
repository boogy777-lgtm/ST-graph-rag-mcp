#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum TestOutput {
    Human,
    Junit,
    Tap,
    Json,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum DocsFormat {
    Markdown,
    Html,
    Both,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum BenchOutputFormat {
    Table,
    Json,
}
