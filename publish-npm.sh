#!/bin/bash
echo "============================================"
echo "  NPM Package Build and Publish Script"
echo "  code-graph-rag-mcp"
echo "============================================"
echo ""

# Check Node.js version
echo "[1/6] Checking Node.js version..."
node --version
if [ $? -ne 0 ]; then
    echo "ERROR: Node.js is not installed or not in PATH"
    exit 1
fi
echo ""

# Install dependencies
echo "[2/6] Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: npm install failed"
    exit 1
fi
echo ""

# Run tests
echo "[3/6] Running tests..."
npm test
if [ $? -ne 0 ]; then
    echo "WARNING: Some tests failed. Continue anyway? (y/n)"
    read -r CONTINUE
    if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
        echo "Aborting publish."
        exit 1
    fi
fi
echo ""

# Build the project
echo "[4/6] Building project..."
npm run build
if [ $? -ne 0 ]; then
    echo "ERROR: Build failed"
    exit 1
fi
echo ""

# Check package before publish
echo "[5/6] Checking package contents..."
npm pack --dry-run
echo ""

# Ask for confirmation before publish
echo "[6/6] Ready to publish to NPM."
echo ""
read -p "Do you want to publish now? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Publish cancelled. Package is ready in dist/ folder."
    exit 0
fi

# Publish
echo ""
echo "Publishing to NPM..."
npm publish
if [ $? -ne 0 ]; then
    echo "ERROR: Publish failed"
    exit 1
fi

echo ""
echo "============================================"
echo "  Package published successfully!"
echo "============================================"
