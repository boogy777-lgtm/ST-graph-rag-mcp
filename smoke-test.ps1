$ErrorActionPreference = "Stop"
Set-Location D:\ST-graph-rag-mcp

# Start the binary in the background; pipe stdin from $null to keep it alive but quiet
$proc = Start-Process -FilePath "D:\ST-graph-rag-mcp\bin\st-graph-rag-mcp.exe" `
  -RedirectStandardError "stderr.log" -RedirectStandardOutput "stdout.log" `
  -PassThru -NoNewWindow

Start-Sleep -Seconds 4

Write-Host "--- process status ---"
Get-Process -Id $proc.Id -ErrorAction SilentlyContinue | Select-Object Id, ProcessName | Format-Table

# Try the port file
if (Test-Path .code-graph-rag/ui.port) {
    $portFile = Get-Content .code-graph-rag/ui.port -Raw
    Write-Host "--- ui.port contents ---"
    Write-Host $portFile

    try {
        $pf = $portFile | ConvertFrom-Json
        $port = $pf.port
        Write-Host "--- /healthz ---"
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:${port}/healthz" -UseBasicParsing -TimeoutSec 3
        Write-Host $resp.Content
        Write-Host "--- / (first 600 chars) ---"
        $html = Invoke-WebRequest -Uri "http://127.0.0.1:${port}/" -UseBasicParsing -TimeoutSec 3
        Write-Host $html.Content.Substring(0, [Math]::Min(600, $html.Content.Length))
        Write-Host "--- /assets/ (CSS exists?) ---"
        $css = Invoke-WebRequest -Uri "http://127.0.0.1:${port}/assets/" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
        Write-Host "Status: $($css.StatusCode)"
    } catch {
        Write-Host "HTTP probe failed: $_"
    }
} else {
    Write-Host "No ui.port file"
}

Write-Host "--- stderr (first 30 lines) ---"
if (Test-Path stderr.log) {
    Get-Content stderr.log -TotalCount 30
}

Write-Host "--- stopping binary ---"
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Write-Host "Done."
