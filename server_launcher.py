# -*- coding: utf-8 -*-
"""
서버 + watchdog 올인원 런처
이 파일을 python으로 실행하면:
1. 기존 서버 종료
2. run_server.py 실행 + 크래시 시 자동 재시작
"""
import subprocess, sys, os, time, socket

BASE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable
SERVER = os.path.join(BASE, 'run_server.py')
LOG = os.path.join(BASE, 'server_start.log')

def log(msg):
    import datetime
    line = f'{datetime.datetime.now():%Y-%m-%d %H:%M:%S} | {msg}'
    print(line, flush=True)
    try:
        with open(LOG, 'a', encoding='utf-8') as f:
            f.write(line + '\n')
    except Exception:
        pass

def port_open():
    try:
        s = socket.socket()
        r = s.connect_ex(('localhost', 8080))
        s.close()
        return r == 0
    except Exception:
        return False

def kill_port():
    if port_open():
        subprocess.run(
            'for /f "tokens=5" %a in (\'netstat -ano 2>nul ^| findstr ":8080 " ^| findstr "LISTENING"\') do taskkill /PID %a /F',
            shell=True, capture_output=True, timeout=5
        )
        time.sleep(1)

log('LAUNCHER START')
kill_port()

while True:
    log('SERVER START')
    try:
        result = subprocess.run([PY, '-X', 'utf8', SERVER], cwd=BASE)
        log(f'SERVER STOPPED (code={result.returncode})')
    except Exception as e:
        log(f'SERVER ERROR: {e}')
    time.sleep(2)
    kill_port()
