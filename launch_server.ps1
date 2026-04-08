# 로젠카페24 서버 시작 런처
# 이 파일을 shortcut target으로 직접 사용

$dir = "C:\Users\kua\Desktop\projects\kuaai\kuaai-main"
$py  = "C:\Users\kua\AppData\Local\Programs\Python\Python311\python.exe"
$launcher = "$dir\server_launcher.py"

# 1. 기존 wscript 종료
Stop-Process -Name wscript -Force -ErrorAction SilentlyContinue

# 2. 기존 포트 8080 종료
$conns = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
foreach ($conn in $conns) {
    if ($conn.OwningProcess -gt 4) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Seconds 2

# 3. Python launcher 시작 (독립 프로세스)
Start-Process -FilePath $py -ArgumentList "-X utf8 `"$launcher`"" -WorkingDirectory $dir -WindowStyle Minimized

# 4. 서버 뜰 때까지 대기 (최대 15초)
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:8080/" -UseBasicParsing -TimeoutSec 2
        break
    } catch { }
}

# 5. 브라우저 열기
Start-Process "http://localhost:8080/"
