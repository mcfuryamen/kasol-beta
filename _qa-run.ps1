$ErrorActionPreference = 'Stop'
$cd = "C:\Users\Admin\Documents\kasol\kaki5"
$tests = @('test-data-actions.js','test-html-refs.js','test-imports.js','test-modules.js','test-shim.js','test-css-drift.js','test-db-migrations.js','test-dynamic-imports.js')
$total = 0; $passed = 0; $failed = 0
foreach ($t in $tests) {
    $path = Join-Path $cd $t
    if (-not (Test-Path $path)) {
        Write-Host "[SKIP] $t"
        continue
    }
    $total++
    Write-Host "=== $t ==="
    node $path
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[PASS] $t"
        $passed++
    } else {
        Write-Host "[FAIL] $t (EXIT=$LASTEXITCODE)"
        $failed++
    }
}
Write-Host ""
Write-Host "=== RESULT: $passed/$total passed, $failed failed ==="
