# Adds or removes one directory in the machine PATH without expanding the other
# entries (%SystemRoot% stays as it is) and without any length limit.
# Usage: path.ps1 add|remove <dir>
param([Parameter(Mandatory)][ValidateSet('add', 'remove')][string]$Action, [Parameter(Mandatory)][string]$Dir)
$ErrorActionPreference = 'Stop'
$key = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SYSTEM\CurrentControlSet\Control\Session Manager\Environment', $true)
try {
  $old = [string]$key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
  $parts = @($old -split ';' | Where-Object { $_ -ne '' })
  $same = { param($p) $p.TrimEnd('\') -ieq $Dir.TrimEnd('\') }
  if ($Action -eq 'add') {
    if (@($parts | Where-Object { & $same $_ }).Count -gt 0) { exit 0 }
    $parts += $Dir
  } else {
    $parts = @($parts | Where-Object { -not (& $same $_) })
  }
  $new = $parts -join ';'
  if ($new -ne $old) { $key.SetValue('Path', $new, [Microsoft.Win32.RegistryValueKind]::ExpandString) }
} finally { $key.Close() }
