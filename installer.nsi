; ───────────────────────────────────────────────────────────────────────────
;  Tizfon — Windows installer (built with native makensis on Linux, no wine)
;  Packages the electron-builder win-unpacked payload into a proper per-user
;  setup .exe: Start-menu + desktop shortcuts, uninstaller, Add/Remove Programs.
; ───────────────────────────────────────────────────────────────────────────

Unicode true
SetCompressor /SOLID lzma
SetCompressorDictSize 64

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

; ── Product metadata ─────────────────────────────────────────────────────────
!define PRODUCT        "Tizfon"
!define COMPANY        "Tizfon"
!define VERSION        "1.0.1"
!define EXE            "Tizfon.exe"
; Paths are RELATIVE to where makensis is invoked (the repo root) so the same
; script builds on the Linux box and in the Windows CI runner. Override with
; -DSRCDIR=… / -DICON=… if needed.
!ifndef SRCDIR
  !define SRCDIR       "dist/win-unpacked"
!endif
!ifndef ICON
  !define ICON         "build/icon.ico"
!endif
!define UNINST_KEY     "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT}"
!define ESTSIZE_KB     275120

Name "${PRODUCT}"
OutFile "dist/Tizfon-Setup-${VERSION}.exe"
BrandingText "${PRODUCT} ${VERSION}"

; Per-user install → no UAC elevation, no admin needed.
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\${PRODUCT}"
InstallDirRegKey HKCU "Software\${PRODUCT}" "InstallDir"

; ── Installer version info (shown in the exe's Properties) ───────────────────
VIProductVersion "1.0.1.0"
VIAddVersionKey  "ProductName"     "${PRODUCT}"
VIAddVersionKey  "CompanyName"     "${COMPANY}"
VIAddVersionKey  "FileDescription" "${PRODUCT} Setup"
VIAddVersionKey  "FileVersion"     "${VERSION}"
VIAddVersionKey  "ProductVersion"  "${VERSION}"
VIAddVersionKey  "LegalCopyright"  "© ${COMPANY}"

; ── UI ───────────────────────────────────────────────────────────────────────
!define MUI_ICON   "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Tizfon now"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; ── Install ──────────────────────────────────────────────────────────────────
Section "Install"
  SetShellVarContext current

  ; If Tizfon is running (it lives in the tray), close it so files aren't locked.
  nsExec::Exec 'taskkill /F /IM ${EXE}'
  Pop $0

  SetOutPath "$INSTDIR"
  ; Bundle the entire electron payload.
  File /r "${SRCDIR}/*"

  ; Shortcuts.
  CreateShortCut "$DESKTOP\${PRODUCT}.lnk"  "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
  CreateDirectory "$SMPROGRAMS\${PRODUCT}"
  CreateShortCut "$SMPROGRAMS\${PRODUCT}\${PRODUCT}.lnk"        "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
  CreateShortCut "$SMPROGRAMS\${PRODUCT}\Uninstall ${PRODUCT}.lnk" "$INSTDIR\Uninstall.exe"

  ; Uninstaller.
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Remember install dir + register in Add/Remove Programs (per-user → HKCU).
  WriteRegStr HKCU "Software\${PRODUCT}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName"     "${PRODUCT}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion"  "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher"       "${COMPANY}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon"     "$INSTDIR\${EXE}"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" "$INSTDIR\Uninstall.exe /S"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" ${ESTSIZE_KB}

  ; When the auto-updater runs us silently (/S), relaunch the app so the update
  ; is seamless. (Interactive installs use the Finish-page "Launch Tizfon" option.)
  ${If} ${Silent}
    Exec '"$INSTDIR\${EXE}"'
  ${EndIf}
SectionEnd

; ── Uninstall ────────────────────────────────────────────────────────────────
Section "Uninstall"
  SetShellVarContext current

  nsExec::Exec 'taskkill /F /IM ${EXE}'
  Pop $0

  Delete "$DESKTOP\${PRODUCT}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT}\${PRODUCT}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT}\Uninstall ${PRODUCT}.lnk"
  RMDir  "$SMPROGRAMS\${PRODUCT}"

  RMDir /r "$INSTDIR"

  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "Software\${PRODUCT}"
SectionEnd
