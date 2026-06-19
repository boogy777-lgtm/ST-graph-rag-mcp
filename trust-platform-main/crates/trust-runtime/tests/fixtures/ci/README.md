# CI Fixtures

This folder contains fixture projects for CI/CD contract tests:

- `green/`: all commands pass (`build --ci`, `validate --ci`, `test --ci`).
- `broken/`: build and validate pass; test fails with a deterministic assertion.

Fixture note:

- `runtime.control.endpoint` intentionally uses `tcp://127.0.0.1:0` so the fixture
  validates on Linux/macOS/Windows. Unix domain socket endpoints are not available
  on Windows in `ControlEndpoint::parse`.
