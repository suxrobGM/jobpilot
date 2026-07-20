# JobPilot Terminal installer for Windows.
# Usage: irm https://raw.githubusercontent.com/suxrobGM/jobpilot/main/apps/terminal/install.ps1 | iex

$ErrorActionPreference = "Stop"

$Repo = "suxrobGM/jobpilot"
$Rid = "win-x64"
$BinaryName = "jobpilot.exe"
$InstallDir = if ($env:JOBPILOT_INSTALL_DIR) { $env:JOBPILOT_INSTALL_DIR } else { "$env:USERPROFILE\.jobpilot" }

function Write-Info($Message) {
    Write-Host $Message -ForegroundColor Green
}

function Get-LatestVersion {
    $releases = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases" -Headers @{ "User-Agent" = "jobpilot-installer" }
    $terminalReleases = $releases | Where-Object { $_.tag_name -like "v*" }
    if (-not $terminalReleases) {
        throw "Could not find a release. See https://github.com/$Repo/releases"
    }
    $highest = $terminalReleases |
        ForEach-Object { [PSCustomObject]@{ Tag = $_.tag_name; Version = [Version]($_.tag_name -replace "^v", "") } } |
        Sort-Object Version |
        Select-Object -Last 1
    return $highest.Tag
}

function Install-Terminal {
    $version = Get-LatestVersion
    $tag = $version
    $archive = "jobpilot-terminal-$Rid.zip"
    $url = "https://github.com/$Repo/releases/download/$tag/$archive"

    $tempDir = Join-Path $env:TEMP "jobpilot-install-$(Get-Random)"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    try {
        Write-Info "Downloading JobPilot Terminal $version for $Rid..."
        $archivePath = Join-Path $tempDir $archive
        Invoke-WebRequest -Uri $url -OutFile $archivePath -UseBasicParsing

        Write-Info "Extracting to $InstallDir..."
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
        # Archive holds the binary plus the bundled plugin/ tree; extract it all.
        Expand-Archive -Path $archivePath -DestinationPath $InstallDir -Force

    }
    finally {
        if (Test-Path $tempDir) {
            Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
        }
    }
}

function Add-ToPath {
    $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    $pathArray = $currentPath -split ";"
    if ($InstallDir -notin $pathArray) {
        $newPath = "$InstallDir;" + $currentPath
        [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
        Write-Info "Added $InstallDir to user PATH"
        Write-Info "Restart your terminal or run: `$env:PATH = `"$InstallDir;`$env:PATH`""
    }
}

function Main {
    Write-Info "JobPilot Terminal Installer"
    Write-Info "Installing to $InstallDir..."
    Install-Terminal
    Add-ToPath
    Write-Info ""
    Write-Info "JobPilot Terminal installed successfully!"
    Write-Info "Run: $BinaryName"
}

Main
