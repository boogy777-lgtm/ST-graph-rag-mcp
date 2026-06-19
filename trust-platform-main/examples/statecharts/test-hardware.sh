#!/bin/bash
# Quick test script for StateChart hardware mode

set -e

echo "🔧 StateChart Hardware Mode Test"
echo "================================"
echo ""

# Check if trust-runtime is running
echo "1. Checking if trust-runtime is running..."
if pgrep -x "trust-runtime" > /dev/null; then
    echo "   ✅ trust-runtime is running"
    
    # Check for Unix socket
    if [ -e "/tmp/trust-debug.sock" ]; then
        echo "   ✅ Control socket found: /tmp/trust-debug.sock"
    else
        echo "   ⚠️  Control socket not found at /tmp/trust-debug.sock"
        echo "      Runtime might be using TCP endpoint"
    fi
else
    echo "   ❌ trust-runtime is NOT running"
    echo ""
    echo "To start trust-runtime with a project:"
    echo "  cd /path/to/your/trust/project"
    echo "  trust-runtime run --console"
    echo ""
    echo "Or for testing without a project (simulation):"
    echo "  trust-runtime run --simulation"
    exit 1
fi

echo ""
echo "2. Checking VS Code extension..."
VSCODE_DIR="$(cd "$(dirname "$0")/../../editors/vscode" && pwd)"
if [ -f "$VSCODE_DIR/out/extension.js" ]; then
    echo "   ✅ Extension compiled"
else
    echo "   ⚠️  Extension not compiled"
    echo "      Run: cd $VSCODE_DIR && npm run compile"
fi

echo ""
echo "3. Ready to test hardware mode!"
echo ""
echo "📋 Next steps:"
echo "   1. Press F5 in VS Code to launch Extension Development Host"
echo "   2. Open any .statechart.json file"
echo "   3. Select '🔌 Hardware' mode in the execution panel"
echo "   4. Click '▶️ Start Hardware'"
echo "   5. If connected, you'll see: ✅ Connected to trust-runtime"
echo ""
echo "🎯 Test files:"
echo "   - $(dirname "$0")/ethercat-snake-simple.statechart.json (3 LEDs)"
echo "   - $(dirname "$0")/ethercat-snake-bidirectional.statechart.json (8 LEDs)"
echo ""
echo "📚 Full guide: $(dirname "$0")/HARDWARE_EXECUTION.md"
echo ""
