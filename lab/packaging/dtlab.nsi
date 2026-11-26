; Windows installer for dtlab: Program Files\dtlab, system PATH, Apps & features entry.
; Build: makensis -DVERSION=1.2.3 -DBINARY=/path/dtlab-windows-amd64.exe -DPATHSCRIPT=path.ps1 -DOUT=/path/setup.exe dtlab.nsi
Unicode true
!include "x64.nsh"
!include "LogicLib.nsh"

!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\dtlab"

Name "dtlab ${VERSION}"
OutFile "${OUT}"
InstallDir "$PROGRAMFILES64\dtlab"
RequestExecutionLevel admin
SetCompressor /SOLID lzma
ShowInstDetails show
ShowUninstDetails show

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "dtlab needs 64-bit Windows."
    Abort
  ${EndIf}
  SetRegView 64
FunctionEnd

Section "dtlab"
  SetOutPath "$INSTDIR"
  File "/oname=dtlab.exe" "${BINARY}"
  WriteUninstaller "$INSTDIR\uninstall.exe"
  File "/oname=path.ps1" "${PATHSCRIPT}"
  ; PowerShell edits PATH through the registry API: no NSIS string limit, and
  ; the other entries stay unexpanded.
  nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\path.ps1" add "$INSTDIR"'
  Pop $0
  ${If} $0 != 0
    DetailPrint "Could not add $INSTDIR to PATH (exit $0); run $INSTDIR\dtlab.exe directly."
  ${EndIf}
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
  WriteRegStr HKLM "${UNINSTKEY}" "DisplayName" "dtlab"
  WriteRegStr HKLM "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "${UNINSTKEY}" "Publisher" "damn.academy"
  WriteRegStr HKLM "${UNINSTKEY}" "URLInfoAbout" "https://damn.academy"
  WriteRegStr HKLM "${UNINSTKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${UNINSTKEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegDWORD HKLM "${UNINSTKEY}" "NoModify" 1
  WriteRegDWORD HKLM "${UNINSTKEY}" "NoRepair" 1
SectionEnd

Function un.onInit
  SetRegView 64
FunctionEnd

Section "Uninstall"
  nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\path.ps1" remove "$INSTDIR"'
  Pop $0
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
  Delete "$INSTDIR\dtlab.exe"
  Delete "$INSTDIR\path.ps1"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKLM "${UNINSTKEY}"
SectionEnd
