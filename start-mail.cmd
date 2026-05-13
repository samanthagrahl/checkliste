@echo off
cd /d "%~dp0"
echo Start Mail-Server + Webapp ^(Port/SMTP aus .env, Standard 3847^)...
echo.
node server\index.js
if errorlevel 1 pause
