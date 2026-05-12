#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Remove sensitive files from Git history using git filter-repo.

.DESCRIPTION
    This script removes the following files from ALL Git history:
    - VPS setup.md          (contains SMTP password in plain text)
    - frontend/.env          (contains API URLs, tracked by accident)
    - backend/tridjaya.db    (SQLite database, may contain user data)

.PREREQUISITES
    1. Install git-filter-repo:
       pip install git-filter-repo
       OR download from https://github.com/newren/git-filter-repo

    2. Ensure you have a BACKUP of the repo before running this.

    3. After running, you MUST force-push to all remotes:
       git push --force --all
       git push --force --tags

    4. All collaborators must re-clone the repo after force-push.

.NOTES
    This is a DESTRUCTIVE operation. It rewrites Git history.
    Run from the repo root directory.
#>

$ErrorActionPreference = "Stop"

Write-Host "=== Git History Cleanup ===" -ForegroundColor Cyan
Write-Host ""

# Check if git-filter-repo is available
$filterRepo = Get-Command "git-filter-repo" -ErrorAction SilentlyContinue
if (-not $filterRepo) {
    Write-Host "ERROR: git-filter-repo is not installed." -ForegroundColor Red
    Write-Host "Install it with: pip install git-filter-repo" -ForegroundColor Yellow
    Write-Host "Or download from: https://github.com/newren/git-filter-repo" -ForegroundColor Yellow
    exit 1
}

# Files to purge from history
$filesToPurge = @(
    "VPS setup.md",
    "frontend/.env",
    "backend/tridjaya.db"
)

Write-Host "The following files will be PERMANENTLY removed from ALL Git history:" -ForegroundColor Yellow
foreach ($f in $filesToPurge) {
    Write-Host "  - $f" -ForegroundColor Red
}
Write-Host ""
Write-Host "This is IRREVERSIBLE. Make sure you have a backup." -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "Type 'YES' to proceed"
if ($confirm -ne "YES") {
    Write-Host "Aborted." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Running git filter-repo..." -ForegroundColor Cyan

# Build the --path arguments
$pathArgs = $filesToPurge | ForEach-Object { "--path"; $_ }

# Run git filter-repo with --invert-paths to remove these files
git filter-repo --invert-paths @pathArgs --force

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Verify the files are gone:  git log --all -- 'VPS setup.md'" -ForegroundColor White
Write-Host "  2. Force push to remote:       git push --force --all" -ForegroundColor White
Write-Host "  3. Force push tags:            git push --force --tags" -ForegroundColor White
Write-Host "  4. All collaborators must re-clone the repository." -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT: Change the SMTP password immediately!" -ForegroundColor Red
