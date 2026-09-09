[CmdletBinding()]
param(
    [string]$Arch = "75;80;86;89",
    [int]$Jobs = 8,
    [string]$Tag = "ollama-spark:latest",
    [switch]$Help
)

if ($Help) {
    Write-Host @"
Usage: .\build.ps1 [-Arch <string>] [-Jobs <int>] [-Tag <string>]

Parameters:
  -Arch    CUDA Architectures (default: "75;80;86;89")
           Examples: "89" (RTX 40xx), "86" (RTX 30xx), "80" (A100)
  -Jobs    Parallel build jobs (default: 8)
  -Tag     Docker image tag (default: "ollama-spark:latest")
  -Help    Show this help message
"@
    exit 0
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

Write-Host "=== Building Ollama for Spark-X2.5 ===" -ForegroundColor Cyan
Write-Host "CUDA Architectures : $Arch"
Write-Host "Build Jobs         : $Jobs"
Write-Host "Target Tag         : $Tag"
Write-Host "Context Dir        : $RootDir"
Write-Host "======================================" -ForegroundColor Cyan

$env:DOCKER_BUILDKIT = "1"

docker build `
    --file "$RootDir\Dockerfile" `
    --tag "$Tag" `
    --build-arg "CUDA_ARCHITECTURES=$Arch" `
    --build-arg "BUILD_JOBS=$Jobs" `
    "$RootDir"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nBuild completed successfully! Image tagged as: $Tag" -ForegroundColor Green
    Write-Host "To start container, run: docker compose up -d" -ForegroundColor Yellow
} else {
    Write-Host "`nBuild failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
