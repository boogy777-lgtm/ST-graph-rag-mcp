# SFC Parallel Branches Examples

This directory contains example SFC (Sequential Function Chart) programs demonstrating parallel branch execution according to IEC 61131-3 standard.

## Examples

### 1. Simple Parallel Example (`sfc_simple_parallel.sfc`)

**Description**: Basic example with 2 parallel tasks that execute concurrently.

**Structure**:
```
Start
  │
  ↓ (ready)
⫸ SPLIT ⫸
  │     │
  │     │
TaskA  TaskB
  │     │
  ↓ 1s  ↓ 2s
⫷ JOIN ⫷
  │
  ↓
 End
```

**How it works**:
1. **Start** step sets `ready := TRUE`
2. **Parallel Split** activates both TaskA and TaskB simultaneously
3. **TaskA** executes for 1 second
4. **TaskB** executes for 2 seconds (longer)
5. **Parallel Join** waits for BOTH tasks to complete
6. **End** step executes only after both branches finish

**Test scenario**: TaskB takes longer (2s vs 1s), so the join will wait for TaskB to complete before continuing.

---

### 2. Parallel Process Example (`sfc_parallel_branches_example.sfc`)

**Description**: Industrial process with 3 concurrent operations (Heat, Mix, Polish).

**Structure**:
```
Init
  │
  ↓ (system_ready)
Prepare
  │
  ↓ (materials_ready)
⫸ SPLIT ⫸
  │   │   │
  │   │   │
Heat Mix Polish
  │   │   │
  ↓ 2s 3s 1.5s
⫷ JOIN ⫷
  │
  ↓
Finish
```

**How it works**:
1. **Init** → **Prepare**: System initialization and material preparation
2. **Parallel Split**: Launches 3 concurrent processes:
   - **Heat**: 2 seconds (temperature control)
   - **Mix**: 3 seconds (mixing ingredients) - longest operation
   - **Polish**: 1.5 seconds (surface polishing)
3. **Parallel Join**: Waits for all 3 branches to complete
4. **Finish**: Final step executes after synchronization

**Test scenario**: Mix takes longest (3s), so join waits for Mix to complete even though Heat (2s) and Polish (1.5s) finish earlier.

---

## How to Use

### 1. Open in VS Code

1. Open VS Code with the Trust Platform extension installed
2. Navigate to `examples/` folder
3. Click on `sfc_simple_parallel.sfc` or `sfc_parallel_branches_example.sfc`
4. The SFC visual editor will open

### 2. Visual Elements

**Nodes**:
- **Steps**: Rectangles (Init, Prepare, TaskA, TaskB, etc.)
- **Parallel Split (⫸)**: Horizontal double-line bar with arrow pointing down/outward
- **Parallel Join (⫷)**: Horizontal double-line bar with arrow pointing inward/down

**Connections**:
- **Transitions**: Arrows between nodes with conditions (e.g., `T#2s`, `ready`)

### 3. Execute Runtime

**Simulation Mode** (recommended for testing):
1. Click on **Runtime** tab in right panel
2. Select **Mode: Local (Simulation)**
3. Click **▶️ Start** button
4. Watch the visual execution:
   - Active steps turn **green**
   - Parallel splits activate multiple branches **simultaneously**
   - Parallel joins highlight when waiting for branches

**Hardware Mode** (requires trust-runtime):
1. Select **Mode: Remote (Hardware)**
2. Configure runtime endpoint
3. Click **▶️ Start**

### 4. Debug Features

**Breakpoints**:
- **Double-click** any step to toggle breakpoint (🔴 red indicator)
- Execution will pause when reaching that step

**Step-by-Step**:
- Click **⏸️ Pause** to pause execution
- Click **⏭️ Step** to execute one cycle at a time
- Click **▶️ Resume** to continue

**Observe**:
- **Active Steps** panel shows currently executing steps
- During parallel execution, you'll see **multiple steps active** simultaneously

### 5. View Generated Code

**Code Panel**:
1. Click **📗 Show Code** button in toolbar
2. View real-time generated Structured Text (ST) code
3. Code includes parallel branch logic:
   - Split: Activates all branches at once
   - Join: Tracks completion with flags, continues only when all complete

**Example generated code for join**:
```st
// Parallel join tracking
IF NOT TaskA_active AND NOT Join_TaskA_completed THEN
  Join_TaskA_completed := TRUE;
END_IF;

IF Join_TaskA_completed AND Join_TaskB_completed THEN
  End_active := TRUE;
  Join_TaskA_completed := FALSE;  // Reset
  Join_TaskB_completed := FALSE;
END_IF;
```

---

## Expected Behavior

### Simple Parallel Example

| Time | Active Steps | Notes |
|------|--------------|-------|
| 0s   | Start | Initial step |
| 0.1s | TaskA, TaskB | Split activates both branches |
| 1s   | TaskB | TaskA completes (1s timer expired) |
| 2s   | (waiting) | TaskB completes, join synchronizes |
| 2.1s | End | Both branches complete, join releases |

### Parallel Process Example

| Time | Active Steps | Notes |
|------|--------------|-------|
| 0s   | Init | System initialization |
| 0.1s | Prepare | Materials preparation |
| 0.2s | Heat, Mix, Polish | Split activates 3 branches |
| 1.5s | Heat, Mix | Polish completes first |
| 2s   | Mix | Heat completes |
| 3s   | (waiting) | Mix completes (longest), join synchronizes |
| 3.1s | Finish | All branches complete |

---

## Key Concepts

### Parallel Split (Divergence)
- **Symbol**: ⫸ (horizontal double line)
- **Behavior**: Activates **ALL** connected branches **simultaneously**
- **IEC 61131-3**: Represents concurrent execution

### Parallel Join (Convergence)
- **Symbol**: ⫷ (horizontal double line)
- **Behavior**: Waits for **ALL** branches to complete before continuing
- **IEC 61131-3**: Synchronization point (AND logic)

### Contrast with Alternative Branches
- **Alternative** (not in these examples): Only ONE branch executes (OR logic)
- **Parallel**: ALL branches execute concurrently (AND logic)

---

## Troubleshooting

**Issue**: Execution doesn't continue after parallel steps
- **Cause**: Join is waiting for all branches to complete
- **Solution**: Check that all transition conditions from parallel steps will eventually become TRUE

**Issue**: Parallel nodes not visible
- **Cause**: Using old file format without parallelSplits/parallelJoins
- **Solution**: Use provided example files or add parallel nodes with toolbar buttons

**Issue**: Generated code has errors
- **Cause**: Parallel split/join not properly connected
- **Solution**: Ensure each split has transitions to ALL branch steps, and ALL branches have transitions to the join

---

## Creating Your Own Parallel SFC

1. **Add Steps**: Click **➕ Add Step**
2. **Add Parallel Split**: Click **⫸ Parallel Split**
3. **Add Branch Steps**: Create multiple steps for concurrent execution
4. **Connect Split to Branches**: Draw transitions from split to each branch step
5. **Add Parallel Join**: Click **⫷ Parallel Join**
6. **Connect Branches to Join**: Draw transitions from each branch to join
7. **Add Next Step**: Create step after join
8. **Connect Join to Next**: Draw transition from join to next step
9. **Set Conditions**: Edit transition conditions (timers, variables, etc.)
10. **Test**: Run in simulation mode

---

## Additional Resources

- IEC 61131-3 Standard Documentation
- Trust Platform SFC Editor Documentation
- Examples directory for more use cases
