@echo off
setlocal
if exist "%USERPROFILE%\.cargo\bin\cargo.exe" set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
where cargo >nul 2>&1
if errorlevel 1 (
    echo Required tool is missing: cargo
    exit /b 1
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo Required tool is missing: npm.cmd
    exit /b 1
)
pushd "%~dp0"
if errorlevel 1 exit /b 1
if not exist node_modules (
    call npm.cmd ci
    if errorlevel 1 (
        popd
        exit /b 1
    )
)
call npm.cmd run tauri -- dev
set "devExit=%ERRORLEVEL%"
popd
exit /b %devExit%
