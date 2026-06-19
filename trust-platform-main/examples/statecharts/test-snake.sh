#!/bin/bash

# Script para probar el StateChart EtherCAT Snake en VS Code
# Este script facilita la apertura y prueba del ejemplo

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VSCODE_DIR="$PROJECT_ROOT/editors/vscode"

echo "🐍 EtherCAT Snake StateChart - Quick Test"
echo "=========================================="
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "$VSCODE_DIR/package.json" ]; then
    echo "❌ Error: No se encuentra editors/vscode/package.json"
    echo "   Asegúrate de estar en el directorio trust-platform"
    exit 1
fi

# Verificar que la extensión está compilada
if [ ! -f "$VSCODE_DIR/media/stateChartWebview.js" ]; then
    echo "⚠️  La extensión no está compilada"
    echo "   Compilando ahora..."
    cd "$VSCODE_DIR"
    npm install
    npm run compile
fi

echo "✅ Extensión compilada"
echo ""
echo "📖 Instrucciones:"
echo ""
echo "1. Se abrirá VS Code en editors/vscode"
echo "2. Presiona F5 para iniciar Extension Development Host"
echo "3. En la ventana de desarrollo:"
echo "   - Presiona Ctrl+O"
echo "   - Navega a: examples/statecharts/ethercat-snake-bidirectional.statechart.json"
echo "   - Presiona Enter"
echo ""
echo "4. En el panel derecho verás:"
echo "   - Execution Panel (arriba)"
echo "   - Properties Panel (abajo)"
echo ""
echo "5. Para ejecutar el snake:"
echo "   a) Click en ▶️ Run"
echo "   b) Click en botón 'START' (aparecerá en Available Events)"
echo "   c) Click repetidamente en 'TICK' para ver el efecto"
echo ""
echo "6. Para ver los logs:"
echo "   - Help > Toggle Developer Tools"
echo "   - Tab 'Console'"
echo ""
echo "🎯 Efecto esperado:"
echo "   - Los estados se iluminarán secuencialmente en el diagrama"
echo "   - Verás: Forward_0 → Forward_1 → ... → Forward_7 → Backward_6 → ..."
echo ""
echo "Presiona Enter para abrir VS Code..."
read

cd "$VSCODE_DIR"
code .

echo ""
echo "✨ ¡Listo! Ahora presiona F5 en VS Code"
echo ""
echo "📝 Archivos de ejemplo disponibles:"
echo "   - ethercat-snake.statechart.json (17 estados, secuencial)"
echo "   - ethercat-snake-bidirectional.statechart.json (15 estados, bidireccional) ⭐"
echo ""
echo "📚 Documentación completa:"
echo "   examples/statecharts/ETHERCAT_SNAKE_README.md"
