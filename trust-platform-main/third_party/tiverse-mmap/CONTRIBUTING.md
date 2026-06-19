# Contributing to mmap-rs

Thank you for your interest in contributing to mmap-rs! We welcome contributions from everyone.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/TIVerse/mmap-rs.git`
3. Create a feature branch: `git checkout -b feature/my-feature`
4. Make your changes
5. Run tests: `cargo test --all-features`
6. Run clippy: `cargo clippy --all-features -- -D warnings`
7. Run rustfmt: `cargo fmt --all`
8. Commit your changes: `git commit -m "feat: add my feature"`
9. Push to your fork: `git push origin feature/my-feature`
10. Open a pull request

## Code Style

- Follow Rust API Guidelines
- Run `rustfmt` on all code
- Ensure `clippy` passes with no warnings
- Write tests for new functionality
- Document all public APIs with examples

## Commit Messages

We follow conventional commits:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `test:` - Test additions or changes
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `ci:` - CI/CD changes

## Safety Guidelines

- All `unsafe` code must be isolated in platform modules
- Every `unsafe` block requires a SAFETY comment explaining soundness
- Public API must be 100% safe Rust
- Add tests for safety invariants

## Testing

- Write unit tests for all new functionality
- Add integration tests for real-world scenarios
- Include platform-specific tests where needed
- Run `cargo miri test` on nightly for memory safety validation

## Documentation

Every public API must include:

- Summary description
- `# Examples` section with runnable code
- `# Safety` section (if applicable)
- `# Errors` section
- `# Platform-specific behavior` section (if applicable)

## Pull Request Process

1. Ensure all tests pass
2. Update documentation
3. Add changelog entry
4. Request review
5. Address review feedback
6. Maintainer will merge when approved

## Code Review

- Be respectful and constructive
- Focus on code quality and correctness
- Ask questions if unclear
- Suggest alternatives when appropriate

## License

By contributing, you agree that your contributions will be licensed under both MIT and Apache-2.0 licenses.
