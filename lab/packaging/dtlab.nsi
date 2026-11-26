; Windows installer for dtlab: Program Files\dtlab, system PATH, Apps & features entry.
; Build: makensis -DVERSION=1.2.3 -DBINARY=/path/dtlab-windows-amd64.exe -DOUT=/path/setup.exe dtlab.nsi
Unicode true
!include "x64.nsh"
!include "LogicLib.nsh"
!include "WordFunc.nsh"

!define ENVKEY "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"
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
  ; Append to the system PATH only when it is not there yet. A PATH longer than
  ; NSIS can read safely is left untouched: writing a truncated value would break it.
  ReadRegStr $0 HKLM "${ENVKEY}" "Path"
  StrLen $1 $0
  ${If} $1 >= ${NSIS_MAX_STRLEN}
    DetailPrint "PATH is too long to edit safely; run $INSTDIR\dtlab.exe directly or add $INSTDIR to PATH yourself."
  ${Else}
    ${WordFind} "$0" "$INSTDIR" "E+1{" $2
    ${If} ${Errors}
      ${If} $0 == ""
        WriteRegExpandStr HKLM "${ENVKEY}" "Path" "$INSTDIR"
      ${Else}
        WriteRegExpandStr HKLM "${ENVKEY}" "Path" "$0;$INSTDIR"
      ${EndIf}
      SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
    ${EndIf}
  ${EndIf}
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
  ReadRegStr $0 HKLM "${ENVKEY}" "Path"
  StrLen $1 $0
  ${If} $1 < ${NSIS_MAX_STRLEN}
    ${un.WordReplace} "$0" ";$INSTDIR" "" "+" $2
    ${un.WordReplace} "$2" "$INSTDIR;" "" "+" $2
    ${If} $2 == "$INSTDIR"
      StrCpy $2 ""
    ${EndIf}
    ${If} $2 != $0
      WriteRegExpandStr HKLM "${ENVKEY}" "Path" "$2"
      SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
    ${EndIf}
  ${EndIf}
  Delete "$INSTDIR\dtlab.exe"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKLM "${UNINSTKEY}"
SectionEnd
