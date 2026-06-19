# Runtime Cloud Topology Demo Pack (5 runtimes, mixed connections + protocols)

This demo pack gives a complete local Runtime Cloud topology scenario:

- 5 runtimes (`runtime-a`..`runtime-e`)
- explicit runtime mesh links (`runtime.mesh.connect`, non-empty on all nodes)
- mixed I/O communication (`mqtt`, `modbus-tcp`, `ethercat`, `simulated`, `loopback`)
- TOML/API-driven operational topology (no manual topology JSON overlay path)
- TOML-defined link transport preferences on `runtime-a` (`realtime` + `zenoh`)
- TOML-defined host grouping (`runtime.discovery.host_group`) for multi-host layout on localhost

The pack is intended for local UI/demo testing.

## 1) Start the full demo (auto-bootstrap)

```bash
cd examples/runtime_cloud/multi_host_topology_demo
./start-5.sh ~/trust-cloud-topology-demo
```

`start-5.sh` auto-runs `bootstrap.sh` if projects are missing/incomplete.
It also clears stale runtime-cloud local state on each run by default, so the canvas stays TOML/API-driven.

Force a full refresh of demo files:

```bash
TRUST_TOPOLOGY_DEMO_REFRESH=1 ./start-5.sh ~/trust-cloud-topology-demo
```

Optional config validation before start:

```bash
TRUST_TOPOLOGY_DEMO_VALIDATE=1 ./start-5.sh ~/trust-cloud-topology-demo
```

## 2) Stop all 5 runtimes

```bash
./stop-5.sh ~/trust-cloud-topology-demo
```

Optional legacy link-transport JSON seed (off by default):

```bash
TRUST_TOPOLOGY_DEMO_SEED_LINK_JSON=1 ./start-5.sh ~/trust-cloud-topology-demo
```

## Runtime Mesh Pattern

- `runtime-a -> runtime-b, runtime-d, runtime-e`
- `runtime-b -> runtime-a, runtime-c`
- `runtime-c -> runtime-b, runtime-d`
- `runtime-d -> runtime-a, runtime-c, runtime-e`
- `runtime-e -> runtime-a, runtime-d`

## Seeded Topology/Comms Data

- Operational topology is derived from `runtime-*.toml` + `io-*.toml` via runtime APIs.
- Runtime cards and adapter/device cards are rendered from runtime-cloud state + I/O config APIs.
- `runtime-a.toml` defines link transport preferences in `[runtime.cloud.links]`:
  - `runtime-a -> runtime-b` = `realtime`
  - `runtime-a -> runtime-c` = `zenoh`
  - `runtime-a -> runtime-d` = `zenoh`
  - `runtime-a -> runtime-e` = `zenoh`
- Runtime TOML files define host groups in `runtime.discovery.host_group`:
  - `runtime-a`, `runtime-b` -> `hq-vm-cluster`
  - `runtime-c`, `runtime-d` -> `line-b-ipc`
  - `runtime-e` -> `remote-site`
- I/O configs intentionally mix local and remote endpoints to show host-attached
  and deterministic external-host endpoint behavior (no free-floating operational endpoints).

## Dashboard URLs

- `runtime-a`: <http://127.0.0.1:19081/>
- `runtime-b`: <http://127.0.0.1:19082/>
- `runtime-c`: <http://127.0.0.1:19083/>
- `runtime-d`: <http://127.0.0.1:19084/>
- `runtime-e`: <http://127.0.0.1:19085/>

## Realistic 3-runtime baseline (2 + 1)

This is the recommended realistic topology baseline:

- Cell A Edge IPC (`runtime.discovery.host_group = "cell-a-edge-ipc"`):
  - `runtime-a-control` (strict realtime I/O)
  - `runtime-a-gateway` (non-realtime comms)
- Cell B Edge IPC (`runtime.discovery.host_group = "cell-b-edge-ipc"`):
  - `runtime-b-control` (strict realtime I/O)

Start it:

```bash
./start-3-realistic.sh ~/trust-cloud-topology-demo
```

`start-3-realistic.sh` also clears stale runtime-cloud local state by default.

Stop it:

```bash
./stop-3-realistic.sh ~/trust-cloud-topology-demo
```

Dashboards:

- `http://127.0.0.1:19181/` (`runtime-a-control`)
- `http://127.0.0.1:19182/` (`runtime-a-gateway`)
- `http://127.0.0.1:19183/` (`runtime-b-control`)

Notes:

- No manual topology JSON is used.
- Host separation is driven by `runtime.discovery.host_group` in TOML.
- Realtime overlay is driven by `[runtime.cloud.links].transports` in TOML.
