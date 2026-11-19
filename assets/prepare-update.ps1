# Used by the installer and uninstaller. Operates only on the selected install
# directory. No AppData, credentials, other installs or unrelated apps are touched.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$InstallDirectory,
    [string]$PayloadDirectory = "",
    [string]$PayloadManifest = ""
)
$ErrorActionPreference = 'Stop'
$appName = 'Acessa Workspace.exe'

function Get-AppProcesses {
    @(Get-CimInstance -ClassName Win32_Process -Filter "Name = 'Acessa Workspace.exe'" | Where-Object {
        $_.ExecutablePath -and [string]::Equals(
            [IO.Path]::GetFullPath($_.ExecutablePath), $script:appPath,
            [StringComparison]::OrdinalIgnoreCase
        )
    })
}

# Programas auxiliares (suporte remoto, motor do telefone, IA local) que o app abre e que continuam rodando
# depois que ele fecha. Se ficarem abertos, travam a pasta: o desinstalador remove a versao antiga e a nova nao
# consegue gravar os arquivos. Sao encerrados SOMENTE quando o executavel esta dentro desta pasta de instalacao.
function Get-HelperProcesses {
    @(Get-CimInstance -ClassName Win32_Process | Where-Object {
        $_.ProcessId -ne $PID -and $_.ExecutablePath -and
        [IO.Path]::GetFullPath($_.ExecutablePath).StartsWith($script:installPrefix, [StringComparison]::OrdinalIgnoreCase) -and
        -not [string]::Equals([IO.Path]::GetFullPath($_.ExecutablePath), $script:appPath, [StringComparison]::OrdinalIgnoreCase)
    })
}

function Assert-UnlockedFile([string]$Path) {
    if ([IO.File]::Exists($Path)) {
        $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        $stream.Dispose()
    }
}

try {
    $installPath = [IO.Path]::GetFullPath($InstallDirectory).TrimEnd('\')
    if ($installPath.Length -lt 4 -or $installPath -eq [IO.Path]::GetPathRoot($installPath).TrimEnd('\')) {
        throw 'Escolha uma pasta exclusiva para o Acessa Workspace.'
    }
    $script:appPath = [IO.Path]::Combine($installPath, $appName)
    $script:installPrefix = $installPath + '\'
    [IO.Directory]::CreateDirectory($installPath) | Out-Null

    # Fail before changing any installed file when the destination is not writable.
    $probe = [IO.Path]::Combine($installPath, '.acessa-write-' + [Guid]::NewGuid().ToString('N'))
    $stream = [IO.File]::Open($probe, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    $stream.Dispose()
    [IO.File]::Delete($probe)

    if ((Get-AppProcesses).Count -gt 0) {
        Write-Output 'Encerrando o Acessa Workspace para liberar os arquivos...'
        # Supported by 0.2.2+. Older releases are handled below, by exact exe path.
        $helper = Start-Process -FilePath $appPath -ArgumentList '--quit-for-update' -WorkingDirectory $installPath -PassThru
        $deadline = [DateTime]::UtcNow.AddSeconds(4)
        while ((Get-AppProcesses).Count -gt 0 -and [DateTime]::UtcNow -lt $deadline) {
            Start-Sleep -Milliseconds 250
        }
        foreach ($item in (Get-AppProcesses)) {
            $process = Get-Process -Id $item.ProcessId -ErrorAction SilentlyContinue
            if ($process) { $null = $process.CloseMainWindow() }
        }
        Start-Sleep -Milliseconds 400
        # Required for releases whose close button only hides the app in the tray.
        # Never use taskkill /IM, a wildcard path, or kill a different installation.
        foreach ($item in (Get-AppProcesses)) {
            Stop-Process -Id $item.ProcessId -Force -ErrorAction Stop
        }
        $deadline = [DateTime]::UtcNow.AddSeconds(5)
        while ((Get-AppProcesses).Count -gt 0 -and [DateTime]::UtcNow -lt $deadline) {
            Start-Sleep -Milliseconds 250
        }
        if ((Get-AppProcesses).Count -gt 0) { throw 'Nao foi possivel encerrar esta instalacao do aplicativo.' }
    }

    # Encerra os auxiliares que ficaram rodando de dentro da pasta (ex.: resources\remote\rustdesk.exe).
    foreach ($item in (Get-HelperProcesses)) {
        Stop-Process -Id $item.ProcessId -Force -ErrorAction SilentlyContinue
    }
    $deadline = [DateTime]::UtcNow.AddSeconds(5)
    while ((Get-HelperProcesses).Count -gt 0 -and [DateTime]::UtcNow -lt $deadline) {
        Start-Sleep -Milliseconds 250
    }

    # Test every payload file that will be replaced before the installer copies
    # anything, so an elevated process/lock cannot leave a partly updated app.
    if ($PayloadManifest) {
        $files = @(Get-Content -Raw -LiteralPath $PayloadManifest | ConvertFrom-Json)
        foreach ($relative in $files) {
            $targetPath = [IO.Path]::GetFullPath([IO.Path]::Combine($installPath, [string]$relative))
            if (-not $targetPath.StartsWith($installPath + '\', [StringComparison]::OrdinalIgnoreCase)) {
                throw 'Caminho invalido no inventario da instalacao.'
            }
            Assert-UnlockedFile $targetPath
        }
    } elseif ($PayloadDirectory) {
        $payload = [IO.Path]::GetFullPath($PayloadDirectory).TrimEnd('\')
        if (-not [IO.Directory]::Exists($payload)) { throw 'Pacote de instalacao indisponivel.' }
        foreach ($file in (Get-ChildItem -LiteralPath $payload -Recurse -File)) {
            $relative = $file.FullName.Substring($payload.Length + 1)
            Assert-UnlockedFile ([IO.Path]::Combine($installPath, $relative))
        }
    } else {
        Assert-UnlockedFile $appPath
        Assert-UnlockedFile ([IO.Path]::Combine($installPath, 'resources\app.asar'))
    }
    Assert-UnlockedFile ([IO.Path]::Combine($installPath, 'Uninstall.exe'))
    Write-Output 'Aplicativo encerrado. Pasta liberada para gravacao.'
    exit 0
} catch {
    Write-Output ('Nao foi possivel liberar a pasta: ' + $_.Exception.Message)
    exit 10
}
