# 바로가기 이름도 영문으로 (COM 인코딩 오류 우회)
$sBat = "C:\Users\kua\Desktop\projects\kuaai\kuaai-main\launch.bat"
$sLnk = "$env:USERPROFILE\Desktop\Logen-Cafe24.lnk"
$sIco = "C:\Users\kua\Desktop\projects\kuaai\kuaai-main\logen_icon.ico"

if (Test-Path $sLnk) { Remove-Item $sLnk -Force }

$sh  = New-Object -ComObject WScript.Shell
$lnk = $sh.CreateShortcut($sLnk)
$lnk.TargetPath       = $sBat
$lnk.WorkingDirectory = "C:\Users\kua\Desktop\projects\kuaai\kuaai-main"
$lnk.WindowStyle      = 7
if (Test-Path $sIco) {
    $lnk.IconLocation = "$sIco,0"
}
$lnk.Save()

"OK: $sLnk" | Out-File "C:\Users\kua\Desktop\projects\kuaai\kuaai-main\shortcut_ok.txt" -Encoding UTF8
Write-Host "완료: $sLnk"
