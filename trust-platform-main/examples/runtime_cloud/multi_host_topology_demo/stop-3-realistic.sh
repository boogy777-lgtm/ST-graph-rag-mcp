#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$HOME/trust-cloud-topology-demo}"
runtime_ids=("a-control" "a-gateway" "b-control")

for id in "${runtime_ids[@]}"; do
  pid_file="/tmp/trust-topology-demo-${id}.pid"
  if [[ -f "${pid_file}" ]]; then
    pid="$(cat "${pid_file}")"
    if kill -0 "${pid}" >/dev/null 2>&1; then
      kill "${pid}" >/dev/null 2>&1 || true
      sleep 0.2
      kill -9 "${pid}" >/dev/null 2>&1 || true
      echo "[stop-3] runtime-${id}: stopped pid ${pid}"
    else
      echo "[stop-3] runtime-${id}: no live process for pid ${pid}"
    fi
    rm -f "${pid_file}"
  else
    echo "[stop-3] runtime-${id}: no pid file"
  fi

  project_dir="${ROOT}/runtime-${id}"
  if [[ -n "${project_dir}" ]]; then
    rm -f "${project_dir}/.trust/runtime-cloud/link-transport-state.json" || true
  fi
done

echo "[stop-3] done."
