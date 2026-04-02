#!/usr/bin/env bash
# ============================================================================
# build_desktop.sh  –  Build the AI Job Assistant as a standalone desktop app
# ============================================================================
#
# Prerequisites:
#   • Python 3.11+ with pip
#   • Node.js 18+ with npm
#   • (optional) Wine – only needed if cross-compiling for Windows from Linux
#
# Usage:
#   chmod +x build_desktop.sh
#   ./build_desktop.sh
#
# The final output will be in frontend/release/
# ============================================================================

set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================"
echo "  AI Job Assistant – Desktop Build"
echo "========================================"
echo ""

# ------------------------------------------------------------------
# Step 1: Build the Python backend with PyInstaller
# ------------------------------------------------------------------
echo "[1/4] Setting up Python virtual environment..."
cd "$ROOT_DIR/backend"

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install -q -r requirements.txt
pip install -q pyinstaller

echo "[2/4] Building backend with PyInstaller..."
pyinstaller ai-job-backend.spec --clean -y

# Move the output to a well-known location that electron-builder can find
BACKEND_DIST="$ROOT_DIR/backend-dist"
rm -rf "$BACKEND_DIST"
cp -r dist/ai-job-backend "$BACKEND_DIST/"

echo "  → Backend compiled to $BACKEND_DIST"
deactivate

# ------------------------------------------------------------------
# Step 2: Install frontend dependencies (including Electron)
# ------------------------------------------------------------------
echo "[3/4] Installing frontend dependencies..."
cd "$ROOT_DIR/frontend"
npm install

# ------------------------------------------------------------------
# Step 3: Build the Electron application
# ------------------------------------------------------------------
echo "[4/4] Building Electron desktop app..."

# On Linux, this will produce an AppImage.
# To cross-compile for Windows, you need Wine installed and can run:
#   npx electron-builder --win --config
npm run electron:build

echo ""
echo "========================================"
echo "  Build complete!"
echo "========================================"
echo ""
echo "Output files are in: $ROOT_DIR/frontend/release/"
ls -lh "$ROOT_DIR/frontend/release/" 2>/dev/null || echo "(no output yet)"
