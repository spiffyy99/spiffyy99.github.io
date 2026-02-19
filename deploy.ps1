# Deployment script for GitHub Pages - Music Project
# This script builds the music app from /music folder and deploys output to /music folder

$projectName = "music"
$sourceFolder = "music"
$deployFolder = "music"

Write-Host "=== Deploying $projectName Project ===" -ForegroundColor Cyan
Write-Host ""

# Build from music folder
Write-Host "Building from $sourceFolder folder..." -ForegroundColor Green
Push-Location $sourceFolder

Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: npm install failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host "Building React app..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location

Write-Host ""
Write-Host "Copying build output to /$deployFolder folder..." -ForegroundColor Green

# Create a temp folder to store source files
$tempSourceFolder = "music-source-backup"
if (Test-Path $tempSourceFolder) {
    Remove-Item -Recurse -Force $tempSourceFolder
}

# Backup source files (everything except build, node_modules)
Write-Host "Backing up source files..." -ForegroundColor Yellow
Get-ChildItem -Path $sourceFolder -Exclude "build","node_modules" | Copy-Item -Destination $tempSourceFolder -Recurse -Force

# Clear music folder (except .git if it exists)
Get-ChildItem -Path $sourceFolder -Exclude ".git" | Remove-Item -Recurse -Force

# Copy built files to music folder root
Copy-Item -Path "$sourceFolder\build\*" -Destination "$sourceFolder\" -Recurse -Force

# Remove build folder
Remove-Item -Path "$sourceFolder\build" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "⚠ Source files backed up to $tempSourceFolder/" -ForegroundColor Yellow
Write-Host "  Restore them if you need to make changes:" -ForegroundColor Yellow
Write-Host "  Copy $tempSourceFolder/* back to music/ before editing" -ForegroundColor Yellow

Write-Host ""
Write-Host "✓ Deployment files ready in /$deployFolder folder!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Commit and push the /$deployFolder folder to your repository" -ForegroundColor Yellow
Write-Host "2. In GitHub repository settings, set Pages source to '/ (root)'" -ForegroundColor Yellow
Write-Host "3. Your app will be available at: https://spiffyy99.github.io/$deployFolder/" -ForegroundColor Yellow
Write-Host ""
Write-Host "Tip: Use .\deploy-all.ps1 to deploy all projects at once" -ForegroundColor Cyan
