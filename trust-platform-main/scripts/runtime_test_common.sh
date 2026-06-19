#!/usr/bin/env bash

resolve_runtime_binary() {
  local configured="${1:-trust-runtime}"
  local runtime_path=""
  if [[ "$configured" == */* ]]; then
    if [ -x "$configured" ]; then
      runtime_path="$configured"
    fi
  else
    if command -v "$configured" >/dev/null 2>&1; then
      runtime_path="$(command -v "$configured")"
    fi
  fi

  if [ -z "$runtime_path" ] && [ -x "./target/debug/trust-runtime" ]; then
    runtime_path="./target/debug/trust-runtime"
  fi

  if [ -z "$runtime_path" ] && command -v cargo >/dev/null 2>&1; then
    echo "Building trust-runtime binary..." >&2
    cargo build -p trust-runtime --bin trust-runtime >/dev/null
    if [ -x "./target/debug/trust-runtime" ]; then
      runtime_path="./target/debug/trust-runtime"
    fi
  fi

  if [ -z "$runtime_path" ]; then
    echo "trust-runtime binary not found. Set ST_RUNTIME or build ./target/debug/trust-runtime." >&2
    return 1
  fi

  printf '%s\n' "$runtime_path"
}

prepare_project_sources_link() {
  local project="$1"
  if [ -d "$project/src" ]; then
    return 0
  fi
  if [ -d "$project/sources" ]; then
    ln -s "sources" "$project/src"
    printf '%s\n' "$project/src"
    return 0
  fi
  echo "invalid project folder '$project': missing src/ directory" >&2
  return 1
}

cleanup_project_sources_link() {
  local src_link="$1"
  if [ -n "$src_link" ] && [ -L "$src_link" ]; then
    rm -f "$src_link"
  fi
}
