Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

sDir    = "C:\Users\kua\Desktop\projects\kuaai\kuaai-main"
sPython = "C:\Users\kua\AppData\Local\Programs\Python\Python311\python.exe"
sLog    = sDir & "\server_start.log"

If Not fso.FileExists(sPython) Then
    Set oExec = WshShell.Exec("cmd /c where python")
    sPython = Trim(oExec.StdOut.ReadLine())
End If

WshShell.CurrentDirectory = sDir

Do
    Set f = fso.OpenTextFile(sLog, 8, True)
    f.WriteLine Now & " | START"
    f.Close

    WshShell.Run """" & sPython & """ -X utf8 run_server.py", 0, True

    Set f = fso.OpenTextFile(sLog, 8, True)
    f.WriteLine Now & " | STOPPED"
    f.Close

    WScript.Sleep 2000
Loop
