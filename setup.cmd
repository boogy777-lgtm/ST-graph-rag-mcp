@echo off
chcp 65001 >nul
:: ============================================================================
:: ST-Graph-RAG-MCP Setup Launcher
:: ============================================================================

echo 🚀 Starting Setup Installer...

:: 1. Check if Bun is installed
where bun >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Bun is not installed!
    echo Please install Bun first: https://bun.sh/
    echo Open PowerShell and run: powershell -c "irm bun.sh/install.ps1 | iex"
    pause
    exit /b 1
)

:: 2. Check if Git is installed
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Git is not installed!
    echo Please install Git for Windows: https://git-scm.com/download/win
    pause
    exit /b 1
)

:: 3. Run the actual setup script using Bun
echo ✅ Dependencies found. Launching Bun...
echo.
bun run setup

if %ERRORLEVEL% neq 0 (
    echo.
    echo ❌ Setup failed. See error messages above.
    pause
    exit /b 1
)

echo.
echo 🎉 All done! You can close this window.
pause
