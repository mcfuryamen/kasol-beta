@echo off
echo ===================================
echo CLEANUP SCRIPT - Kasir Gerobak
echo ===================================
echo.

echo [1/4] Creating archive directory...
if not exist "_archive" mkdir "_archive"

echo [2/4] Moving backup files to archive...
if exist "index.html.backup" move "index.html.backup" "_archive\"
if exist "index.html.backup2" move "index.html.backup2" "_archive\"
if exist "js\app.js.broken" move "js\app.js.broken" "_archive\"

echo [3/4] Moving test-subdir to archive...
if exist "test-subdir" move "test-subdir" "_archive\"

echo [4/4] Cleanup complete!
echo.
echo Files moved to _archive directory:
dir "_archive" /b
echo.
echo ===================================
echo Next steps:
echo 1. Review files in _archive before deleting
echo 2. Commit changes to git
echo 3. Proceed with other action items
echo ===================================
pause