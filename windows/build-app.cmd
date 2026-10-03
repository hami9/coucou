@echo off
setlocal
if exist "%USERPROFILE%\.cargo\bin\cargo.exe" set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
pushd "%~dp0"
if errorlevel 1 exit /b 1
if not exist node_modules (
    call npm.cmd ci
    if errorlevel 1 goto failed
)
call npm.cmd run tauri -- build --debug --no-bundle
if errorlevel 1 goto failed
if not exist release mkdir release
copy /y "target\debug\coucou.exe" "release\coucou.exe" >nul
if errorlevel 1 goto failed
copy /y "target\release\coucou-hook.exe" "release\coucou-hook.exe" >nul
if errorlevel 1 goto failed
echo Open release\coucou.exe to run without the development server.
popd
exit /b 0
:failed
popd
exit /b 1
