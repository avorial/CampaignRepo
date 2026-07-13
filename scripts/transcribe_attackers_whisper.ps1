param(
    [string]$SourceDir = "C:\Users\patricthomas\Music\iTunes\iTunes Media\Podcasts\Attackers of Opportunity",
    [string]$Model = "small.en",
    [string]$Device = "cuda",
    [string]$OutputFormat = "all"
)

$ErrorActionPreference = "Stop"
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"
[Console]::OutputEncoding = [Text.UTF8Encoding]::new()

$RepoRoot = Split-Path -Parent $PSScriptRoot
$WhisperExe = Join-Path $RepoRoot ".venv-whisper\Scripts\whisper.exe"
$OutputDir = Join-Path $SourceDir "Transcripts"
$LogPath = Join-Path $OutputDir "whisper-batch.log"

if (-not (Test-Path -Path $WhisperExe)) {
    throw "Whisper executable not found at $WhisperExe. Run setup from $RepoRoot first."
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$audioExtensions = @(".mp3", ".m4a", ".wav", ".flac", ".ogg", ".aac", ".wma", ".mp4", ".m4b")
$files = Get-ChildItem -Path $SourceDir -File |
    Where-Object { $audioExtensions -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object Name

"[$(Get-Date -Format s)] Starting Whisper batch. Files: $($files.Count), model: $Model, device: $Device" |
    Tee-Object -FilePath $LogPath -Append

$index = 0
foreach ($file in $files) {
    $index += 1
    $expectedTxt = Join-Path $OutputDir ($file.BaseName + ".txt")

    if (Test-Path -Path $expectedTxt) {
        "[$(Get-Date -Format s)] [$index/$($files.Count)] Skipping existing transcript: $($file.Name)" |
            Tee-Object -FilePath $LogPath -Append
        continue
    }

    "[$(Get-Date -Format s)] [$index/$($files.Count)] Transcribing: $($file.Name)" |
        Tee-Object -FilePath $LogPath -Append

    & $WhisperExe `
        $file.FullName `
        --model $Model `
        --language English `
        --task transcribe `
        --device $Device `
        --output_dir $OutputDir `
        --output_format $OutputFormat

    if ($LASTEXITCODE -ne 0) {
        throw "Whisper failed for $($file.FullName) with exit code $LASTEXITCODE"
    }
}

"[$(Get-Date -Format s)] Whisper batch complete." | Tee-Object -FilePath $LogPath -Append
