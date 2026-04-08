# -*- coding: utf-8 -*-
"""
logen_get_token.py
로젠 JWT 토큰 자동 획득 스크립트 (Playwright)
- 최초 실행: 브라우저 창이 열리면 로그인 -> 쿠키 자동 저장
- 이후 실행: 저장된 쿠키로 자동 로그인
- 로그인 후 JWT 를 localhost:8080/store-logen-token 에 전송

사용법:
    python logen_get_token.py
"""
import sys, json, time, os, urllib.request, urllib.error
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

SERVER    = 'http://localhost:8080'
LOGEN_URL = 'https://logis.ilogen.com'
MAIN_URL  = 'https://logis.ilogen.com/common/html/main.html'
PAGE_ID   = 'lrm01f0050'

# 환경변수 또는 lc_config.json에서 로젠 자격증명 로드
def _load_logen_creds():
    user_id = '33253401'
    user_pw = os.environ.get('LOGEN_PASSWORD', '')
    try:
        cfg_path = Path(__file__).parent / 'lc_config.json'
        with open(cfg_path, 'r', encoding='utf-8') as f:
            cfg = json.load(f)
        logen_cfg = cfg.get('logen', {})
        if logen_cfg.get('userId'):
            user_id = logen_cfg['userId']
        if not user_pw and logen_cfg.get('password'):
            user_pw = logen_cfg['password']
    except Exception:
        pass
    return user_id, user_pw

USER_ID, USER_PW = _load_logen_creds()

# Playwright 전용 세션 저장 경로 (쿠키 유지)
DATA_DIR  = Path(__file__).parent / '.playwright_logen'


def push_token(token: str, emp_id: str = '') -> bool:
    """JWT 를 run_server.py 에 저장"""
    try:
        body = json.dumps(
            {'token': token, 'pageId': PAGE_ID, 'userInfo': '', 'empId': emp_id},
            ensure_ascii=False
        ).encode('utf-8')
        req = urllib.request.Request(
            SERVER + '/store-logen-token', data=body,
            headers={'Content-Type': 'application/json'}, method='POST'
        )
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read()).get('ok', False)
    except urllib.error.URLError:
        print('  [경고] localhost:8080 서버가 꺼져 있습니다. run_server.py 를 먼저 실행하세요.')
        return False
    except Exception as e:
        print(f'  [오류] 서버 전송 실패: {e}')
        return False


def get_jwt(page) -> str:
    try:
        t = page.evaluate('document.body.id || ""')
        if t and len(t) > 20 and t != 'null':
            return t
    except Exception:
        pass
    return ''


def wait_for_jwt(page, timeout_sec=120) -> str:
    """로그인 완료 대기 (최대 timeout_sec 초)"""
    print(f'  브라우저 창에서 로그인하세요. (최대 {timeout_sec}초 대기)')
    end = time.time() + timeout_sec
    while time.time() < end:
        if get_jwt(page):
            return get_jwt(page)
        time.sleep(1)
    return ''


def do_login_click(page):
    """아이디/비밀번호 자동입력 + 로그인 버튼 클릭"""
    # 아이디 입력
    try:
        id_sel = 'input[type="text"], input[name*="id"], input[placeholder*="id"], input[placeholder*="ID"]'
        id_box = page.locator(id_sel).first
        id_box.wait_for(timeout=4000)
        id_box.fill(USER_ID)
        print('  아이디 입력 완료')
    except PWTimeout:
        pass  # 이미 입력된 경우

    # 비밀번호 입력 (환경변수 LOGEN_PASSWORD 설정 시)
    if USER_PW:
        try:
            pw_box = page.locator('input[type="password"]').first
            pw_box.wait_for(timeout=3000)
            pw_box.fill(USER_PW)
            print('  비밀번호 입력 완료')
        except PWTimeout:
            pass

    # 로그인 버튼 클릭
    try:
        btn = page.locator('button:has-text("로그인"), a:has-text("로그인"), input[type="submit"]').first
        btn.wait_for(timeout=3000)
        btn.click()
        print('  로그인 버튼 클릭 완료')
        page.wait_for_timeout(3000)
    except PWTimeout:
        pass


def run(headless=False):
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as pw:
        print('  Playwright 브라우저 시작...')
        launch_args = ['--disable-blink-features=AutomationControlled']
        if not headless:
            launch_args.append('--start-maximized')
        ctx = pw.chromium.launch_persistent_context(
            user_data_dir=str(DATA_DIR),
            headless=headless,
            args=launch_args,
            no_viewport=True if not headless else None,
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()

        # ---- 1. logis.ilogen.com 접속 ----
        print('  logis.ilogen.com 접속 중...')
        try:
            page.goto(LOGEN_URL, wait_until='domcontentloaded', timeout=20000)
            page.wait_for_timeout(2000)
        except Exception as e:
            print(f'  [오류] 접속 실패: {e}')
            ctx.close()
            return False

        # ---- 2. 이미 로그인된 상태 확인 ----
        token = get_jwt(page)

        # ---- 3. 로그인 필요하면 자동 클릭 ----
        if not token:
            do_login_click(page)
            token = get_jwt(page)

        # ---- 4. main.html 직접 이동 시도 ----
        if not token:
            try:
                page.goto(MAIN_URL, wait_until='domcontentloaded', timeout=15000)
                page.wait_for_timeout(2000)
                token = get_jwt(page)
            except Exception:
                pass

        # ---- 5. 수동 로그인 대기 (headless 아닐 때만) ----
        if not token and not headless:
            token = wait_for_jwt(page, timeout_sec=120)

        ctx.close()

    if token:
        print(f'  JWT 획득 성공 (len={len(token)})')
        ok = push_token(token)
        if ok:
            print('  서버에 토큰 저장 완료')
        return True
    else:
        print('  JWT 획득 실패')
        return False


if __name__ == '__main__':
    headless_mode = '--headless' in sys.argv
    if headless_mode:
        print('\n  [로젠 토큰 자동 갱신 - 백그라운드]')
    else:
        print('\n  [로젠 토큰 획득 시작]')
    ok = run(headless=headless_mode)
    print()
    sys.exit(0 if ok else 1)
