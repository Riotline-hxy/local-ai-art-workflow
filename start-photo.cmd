@echo off
cd /d "%~dp0"
echo Open http://localhost:3000 after the Ready message.
echo Press Ctrl+C in this window to stop.
call npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
pause
