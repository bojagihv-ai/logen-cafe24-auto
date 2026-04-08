Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

sBatFile  = "C:\Users\kua\Desktop\projects\kuaai\kuaai-main\로젠카페24_실행.bat"
sDesktop  = WshShell.SpecialFolders("Desktop")
sLinkPath = sDesktop & "\로젠카페24 실행.lnk"
sIcon     = "C:\Users\kua\Desktop\projects\kuaai\kuaai-main\logen_icon.ico"

Set oLink = WshShell.CreateShortcut(sLinkPath)
oLink.TargetPath       = sBatFile
oLink.WorkingDirectory = "C:\Users\kua\Desktop\projects\kuaai\kuaai-main"
oLink.Description      = "로젠 x 카페24 송장 매니저"
oLink.WindowStyle      = 7  ' 7=최소화 (bat창 안보이게)

If fso.FileExists(sIcon) Then
    oLink.IconLocation = sIcon & ", 0"
End If

oLink.Save

WScript.Echo "바로가기 업데이트 완료: " & sLinkPath
