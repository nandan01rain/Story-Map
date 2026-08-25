@echo off
REM Starts the PWA's local server and opens the app.
REM
REM The installed app (Chrome/Edge -> Install) points at http://localhost:8080, so something
REM has to be serving that port before the icon works. This does both: starts the server if
REM it is not already up, then opens the app.
REM
REM To have it run at login: press Win+R, type  shell:startup  , and put a SHORTCUT to this
REM file in the folder that opens. Delete the shortcut to undo it -- nothing is installed and
REM nothing is registered.

cd /d "%~dp0.."

REM Already serving? Then just open it. Two servers on one port is an error, not a spare.
netstat -ano | findstr /r /c:"TCP.*:8080 .*LISTENING" >nul
if %errorlevel%==0 (
  echo StoryMap is already served on port 8080.
) else (
  echo Starting StoryMap on http://localhost:8080 ...
  start "StoryMap server" /min cmd /c python -m http.server 8080
  REM Give it a breath before the browser asks for the page.
  timeout /t 2 /nobreak >nul
)

start "" "http://localhost:8080/index.html"
