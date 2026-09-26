$ErrorActionPreference = 'Stop'
$betaRepo = "C:\Users\Admin\Documents\GitHub\kasol-beta"
Write-Host "Reset beta working tree..."
git -C $betaRepo reset --hard HEAD
git -C $betaRepo clean -fd
Write-Host "Fetch our commit..."
git -C $betaRepo fetch "C:\Users\Admin\Documents\kasol" main
Write-Host "Push..."
git -C $betaRepo push "C:\Users\Admin\Documents\kasol" +main:refs/heads/main
Write-Host "Done. Verifying..."
git -C $betaRepo rev-parse HEAD
