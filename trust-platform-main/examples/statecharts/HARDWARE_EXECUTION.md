# StateChart Hardware Execution Guide

This guide explains how to run StateCharts with **real I/O** on EtherCAT or other hardware.

## 🎯 Execution Modes

The StateChart Editor supports two execution modes:

### 🖥️ Simulation Mode (Default)
- **No hardware required**
- Actions are logged to the console
- Perfect for testing state transitions and logic
- No trust-runtime needed

### 🔌 Hardware Mode
- **Requires trust-runtime running**
- Actions execute on real hardware (EtherCAT, GPIO, etc.)
- Uses action mappings to control I/O addresses
- Communicates via control endpoint

---

## 🚀 Quick Start: Simulation Mode

1. **Open any `.statechart.json` file** in VS Code
2. Press **F5** to launch Extension Development Host
3. In the new window, open the StateChart file (Ctrl+O)
4. In the right panel:
   - Select **🖥️ Simulation** mode *(default)*
   - Click **▶️ Start Simulation**
5. Click **START** event, then **TICK** repeatedly
6. Watch the active state change (green highlight!)
7. Actions logged in **Developer Tools Console** (Help → Toggle Developer Tools)

**Example Console Output (Simulation Mode):**
```
🖥️  [SIM] Executing action: turnOn_DO0
🖥️  [SIM] Executing action: turnOff_DO0
Transitioned from LED_0 to LED_1 via TICK
```

---

## ⚡ Hardware Mode Setup

### Prerequisites

1. **StateChart backend** project (trust-runtime + hardware drivers)
2. **Hardware connected** (EtherCAT EK1100 + EL2008, GPIO, etc.)
3. **Control endpoint** running at `/tmp/trust-debug.sock`

### Step 1: Start the Backend

The backend project is located at `../hardware_8do/` and provides:
- Minimal ST program (just defines I/O variables)
- EtherCAT or GPIO driver configuration
- Control endpoint for VS Code communication

```bash
cd examples/hardware_8do
sudo ./start.sh
```

**Expected output:**
```
✅ Build complete
🚀 Starting runtime...
   Control endpoint: /tmp/trust-debug.sock
✅ Control endpoint ready: /tmp/trust-debug.sock (rw-rw----)
✅ Backend is running!
```

See `../hardware_8do/README.md` for hardware configuration details.

### Step 2: VS Code Configuration (Optional)

The editor automatically uses `/tmp/trust-debug.sock` by default. You only need to configure if using a different endpoint:

```json
{
  "trust-lsp.runtime.controlEndpoint": "unix:///tmp/trust-debug.sock"
}
```

**For TCP (remote runtime):**
```json
{
  "trust-lsp.runtime.controlEndpoint": "tcp://192.168.1.100:9000",
  "trust-lsp.runtime.controlAuthToken": "your-secret-token"
}
```

### Step 3: Ensure Action Mappings

Your `.statechart.json` must have `actionMappings` defined:

```json
{
  "id": "ethercat_demo",
  "initial": "Init",
  "states": {
    "Init": {
      "on": { "START": "LED_0" }
    },
    "LED_0": {
      "entry": ["turnOn_DO0"],
      "exit": ["turnOff_DO0"],
      "on": { "TICK": "LED_1" }
    },
    "LED_1": {
      "entry": ["turnOn_DO1"],
      "exit": ["turnOff_DO1"],
      "on": { "TICK": "LED_0" }
    }
  },
  "actionMappings": {
    "turnOn_DO0": {
      "action": "WRITE_OUTPUT",
      "address": "%QX0.0",
      "value": true
    },
    "turnOff_DO0": {
      "action": "WRITE_OUTPUT",
      "address": "%QX0.0",
      "value": false
    },
    "turnOn_DO1": {
      "action": "WRITE_OUTPUT",
      "address": "%QX0.1",
      "value": true
    },
    "turnOff_DO1": {
      "action": "WRITE_OUTPUT",
      "address": "%QX0.1",
      "value": false
    }
  }
}
```

### Step 4: Run in Hardware Mode

1. Open the `.statechart.json` file
2. In StateChart Editor:
   - Select **🔌 Hardware** mode
   - Click **▶️ Start Hardware**
3. You should see: `✅ Connected to trust-runtime: unix:///tmp/trust-debug.sock`
4. Click **START**, then **TICK**
5. **Watch your LEDs light up!** 💡

**Example Console Output (Hardware Mode):**
```
✅ Connected to trust-runtime via Unix socket: /tmp/trust-debug.sock
🎯 StateMachine initialized in hardware mode
🔌 [HW] turnOn_DO0 → WRITE true to %QX0.0
✅ Wrote true to %QX0.0
🔌 [HW] turnOff_DO0 → WRITE false to %QX0.0
✅ Wrote false to %QX0.0
Transitioned from LED_0 to LED_1 via TICK
```

---

## 📋 Action Mapping Reference

### WRITE_OUTPUT - Digital Output
```json
"turnOn_LED": {
  "action": "WRITE_OUTPUT",
  "address": "%QX0.0",
  "value": true
}
```
Writes a boolean value to a digital output address.

### WRITE_VARIABLE - Memory Variable
```json
"setSpeed": {
  "action": "WRITE_VARIABLE",
  "variable": "motorSpeed",
  "value": 1500
}
```
Sets a PLC variable value (requires trust-runtime variable support).

### SET_MULTIPLE - Batch Write
```json
"resetAll": {
  "action": "SET_MULTIPLE",
  "targets": [
    { "address": "%QX0.0", "value": false },
    { "address": "%QX0.1", "value": false },
    { "address": "%QX0.2", "value": false }
  ]
}
```
Writes multiple outputs atomically.

### LOG - Console Output
```json
"logStatus": {
  "action": "LOG",
  "message": "Motor started successfully"
}
```
Logs a message (works in both modes).

---

## 🔧 Troubleshooting

### ❌ "Failed to connect to trust-runtime"

**Problem:** Editor can't reach the control endpoint.

**Solutions:**
1. Verify trust-runtime is running: `ps aux | grep trust-runtime`
2. Check endpoint path: `ls -la /tmp/trust-debug.sock`
3. For TCP, verify port: `netstat -tuln | grep 9000`
4. Check firewall rules for TCP connections

### ❌ "No actionMappings defined"

**Problem:** StateChart has no `actionMappings` section.

**Solution:** Add action mappings to your JSON file (see examples above).

### ❌ Actions logged but hardware doesn't respond

**Problem:** Runtime connected but I/O not working.

**Solutions:**
1. Check your `io.toml` driver configuration
2. Verify hardware connections (EtherCAT bus, GPIO pins)
3. Check address mappings match your hardware layout
4. View trust-runtime logs for I/O errors

### ⚠️ "No mapping found for action"

**Problem:** State references an action not in `actionMappings`.

**Solution:** Ensure all actions in `entry`/`exit` arrays have corresponding mappings.

---

## 📊 EtherCAT Example

See the complete working examples:
- [ethercat-snake-simple.statechart.json](ethercat-snake-simple.statechart.json) - 3 LEDs, best for learning
- [ethercat-snake-bidirectional.statechart.json](ethercat-snake-bidirectional.statechart.json) - Full 8 LEDs Knight Rider
- [ETHERCAT_SNAKE_README.md](ETHERCAT_SNAKE_README.md) - Full hardware setup guide

---

## 🎓 Best Practices

### 1. Start with Simulation
Always test your state machine logic in simulation mode first before connecting to hardware.

### 2. Use Descriptive Action Names
```json
"entry": ["turnOn_ConveyorMotor", "enableSafetyLight"]
```
Better than: `"entry": ["action1", "action2"]`

### 3. Group Related Actions
```json
"entry": ["stopAllMotors", "resetCounters", "enableEstop"]
```

### 4. Document Hardware Addresses
Add comments to your action mappings (VS Code supports JSON5):
```json
{
  "turnOn_DO0": {
    "action": "WRITE_OUTPUT",
    "address": "%QX0.0",  // EL2008 Channel 0 - Conveyor Motor
    "value": true
  }
}
```

### 5. Test Edge Cases
- Rapid state transitions (click TICK quickly)
- Unexpected events in wrong states
- Guard conditions blocking transitions

---

## 🔮 Future Enhancements

Coming soon:
- [ ] Variable read/write support
- [ ] Analog I/O support (%IW, %QW)
- [ ] Guard condition evaluation with runtime values
- [ ] Breakpoints and step execution
- [ ] State history recording and replay
- [ ] WebSocket real-time updates

---

## 📚 Related Documentation

- [StateChart Examples README](README.md) - All available examples
- [EtherCAT Snake Guide](ETHERCAT_SNAKE_README.md) - Hardware setup details
- [IEC 61131-3 Addressing](https://en.wikipedia.org/wiki/IEC_61131-3#Addressing) - Address format reference

---

**Happy StateMachine Coding!** 🎉
