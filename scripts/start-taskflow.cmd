@echo off
rem Starts TaskFlow in production mode and appends its output to logs\taskflow.log.
rem Used by the Windows Task Scheduler entry described in docs\LAN-SETUP.md.
rem Run "npm run build" first whenever the client code changes.

cd /d "%~dp0.."
if not exist logs mkdir logs
echo. >> logs\taskflow.log
echo ===== Starting TaskFlow %date% %time% ===== >> logs\taskflow.log
call npm start >> logs\taskflow.log 2>&1
