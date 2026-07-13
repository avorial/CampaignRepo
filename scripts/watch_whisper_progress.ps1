param(
    [int]$BatchPid = 43280,
    [string]$SourceDir = "C:\Users\patricthomas\Music\iTunes\iTunes Media\Podcasts\Attackers of Opportunity",
    [string]$StdoutLog = "",
    [int]$RefreshSeconds = 5
)

$ErrorActionPreference = "SilentlyContinue"

$OutputDir = Join-Path $SourceDir "Transcripts"
if (-not $StdoutLog) {
    $latestStdoutLog = Get-ChildItem -Path $OutputDir -Filter "whisper-stdout*.log" -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    $StdoutLog = if ($latestStdoutLog) { $latestStdoutLog.FullName } else { Join-Path $OutputDir "whisper-stdout.log" }
}
$audioExtensions = @(".mp3", ".m4a", ".wav", ".flac", ".ogg", ".aac", ".wma", ".mp4", ".m4b")

function Format-TimeSpanSeconds([double]$Seconds) {
    if ($Seconds -lt 0 -or [double]::IsNaN($Seconds)) {
        return "--:--"
    }

    $span = [TimeSpan]::FromSeconds($Seconds)
    if ($span.TotalHours -ge 1) {
        return "{0:h\:mm\:ss}" -f $span
    }

    return "{0:mm\:ss}" -f $span
}

function Get-WhisperChildProcess {
    Get-CimInstance Win32_Process |
        Where-Object { $_.ParentProcessId -eq $BatchPid -and $_.Name -match "whisper|python" } |
        Select-Object -First 1
}

function Get-QuotedArgument([string]$CommandLine) {
    $matches = [regex]::Matches($CommandLine, '"([^"]+)"')
    foreach ($match in $matches) {
        $value = $match.Groups[1].Value
        if ($value -match "\.($($audioExtensions.ForEach({ $_.TrimStart('.') }) -join '|'))$") {
            return $value
        }
    }

    return $null
}

function Get-AudioDuration([string]$Path) {
    $raw = & ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $Path 2>$null
    $duration = 0.0
    if ([double]::TryParse($raw, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$duration)) {
        return $duration
    }

    return 0.0
}

function Get-LatestTranscriptSecond {
    if (-not (Test-Path -Path $StdoutLog)) {
        return 0.0
    }

    $lines = Get-Content -Path $StdoutLog -Tail 200
    for ($i = $lines.Count - 1; $i -ge 0; $i--) {
        if ($lines[$i] -match '^\[(?:(\d+):)?(\d{2}):(\d{2}(?:\.\d+)?)\s+-->') {
            $hours = if ($Matches[1]) { [int]$Matches[1] } else { 0 }
            $minutes = [int]$Matches[2]
            $seconds = [double]::Parse($Matches[3], [Globalization.CultureInfo]::InvariantCulture)
            return ($hours * 3600) + ($minutes * 60) + $seconds
        }
    }

    return 0.0
}

while ($true) {
    $audioFiles = Get-ChildItem -Path $SourceDir -File |
        Where-Object { $audioExtensions -contains $_.Extension.ToLowerInvariant() }
    $doneCount = (Get-ChildItem -Path $OutputDir -Filter "*.txt" -File).Count
    $totalCount = $audioFiles.Count
    $batchProcess = Get-Process -Id $BatchPid
    $child = Get-WhisperChildProcess

    Clear-Host
    Write-Host "Whisper Progress" -ForegroundColor Cyan
    Write-Host "Batch PID: $BatchPid"
    Write-Host "Completed transcripts: $doneCount / $totalCount"
    Write-Progress -Id 1 -Activity "All episodes" -Status "$doneCount of $totalCount complete" -PercentComplete (($doneCount / [Math]::Max($totalCount, 1)) * 100)

    if (-not $batchProcess) {
        Write-Host ""
        Write-Host "Batch process is not running." -ForegroundColor Yellow
        break
    }

    if ($child) {
        $currentPath = Get-QuotedArgument $child.CommandLine
        if ($currentPath) {
            $duration = Get-AudioDuration $currentPath
            $latest = Get-LatestTranscriptSecond
            $percent = if ($duration -gt 0) { [Math]::Min(100, ($latest / $duration) * 100) } else { 0 }
            $remaining = if ($duration -gt 0) { $duration - $latest } else { -1 }

            Write-Host ""
            Write-Host "Current file:" -ForegroundColor Yellow
            Write-Host "  $(Split-Path -Leaf $currentPath)"
            Write-Host "  $(Format-TimeSpanSeconds $latest) / $(Format-TimeSpanSeconds $duration) ($([Math]::Round($percent, 1))%)"
            Write-Host "  Remaining in current file: $(Format-TimeSpanSeconds $remaining)"
            Write-Progress -Id 2 -Activity "Current episode" -Status "$(Split-Path -Leaf $currentPath)" -PercentComplete $percent
        } else {
            Write-Host ""
            Write-Host "Whisper is running, but I could not parse the current audio path." -ForegroundColor Yellow
        }
    } else {
        Write-Host ""
        Write-Host "Waiting for the next Whisper child process..." -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "Refreshes every $RefreshSeconds seconds. Press Ctrl+C to close this watcher."
    Start-Sleep -Seconds $RefreshSeconds
}
