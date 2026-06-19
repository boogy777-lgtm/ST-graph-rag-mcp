@echo off
echo ============================================
echo   NPM Package Build and Publish Script
echo   code-graph-rag-mcp
echo ============================================
echo.

REM Check Node.js version
echo [1/6] Checking Node.js version...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    pause
    exit /b 1
)
echo.

REM Install dependencies
echo [2/6] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)
echo.

REM Run tests
echo [3/6] Running tests...
call npm test
if %errorlevel% neq 0 (
    echo WARNING: Some tests failed. Continue anyway? (Y/N)
    set /p CONTINUE=
    if /i not "%CONTINUE%"=="Y" (
        echo Aborting publish.
        pause
        exit /b 1
    )
)
echo.

REM Build the project
echo [4/6] Building project...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)
echo.

REM Check package before publish
echo [5/6] Checking package contents...
call npm pack --dry-run
echo.

REM Ask for confirmation before publish
echo [6/6] Ready to publish to NPM.
echo.
set /p CONFIRM="Do you want to publish now? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo Publish cancelled. Package is ready in dist/ folder.
    pause
    exit /b 0
)

REM Publish
echo.
echo Publishing to NPM...
call npm publish
if %errorlevel% neq 0 (
    echo ERROR: Publish failed
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Package published successfully!
echo ============================================
pause
