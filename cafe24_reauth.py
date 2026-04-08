"""
cafe24_reauth.py
카페24 OAuth 자동 재인증 스크립트
- 브라우저(Playwright)로 OAuth URL 접속 → 자동 리다이렉트 → code 추출 → 토큰 교환 → lc_config.json 저장
- 이미 브라우저에 카페24 로그인 세션이 있으면 완전 자동
"""
import asyncio, json, os, sys, datetime, base64, urllib.request, urllib.parse
from pathlib import Path

try:
    from playwright.async_api import async_playwright
except ImportError:
    print('[cafe24_reauth] playwright 미설치. pip install playwright && playwright install chromium')
    sys.exit(1)

BASE_DIR    = Path(__file__).parent
CONFIG_FILE = BASE_DIR / 'lc_config.json'
SESSION_DIR = BASE_DIR / '.playwright_cafe24'

def load_config():
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

def save_config(cfg):
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

def exchange_code(mall_id, client_id, client_secret, code, redirect_uri='https://03030.co.kr/'):
    """code → access_token / refresh_token 교환"""
    creds = base64.b64encode(f'{client_id}:{client_secret}'.encode()).decode()
    data  = urllib.parse.urlencode({
        'grant_type':   'authorization_code',
        'code':         code,
        'redirect_uri': redirect_uri,
    }).encode()
    req = urllib.request.Request(
        f'https://{mall_id}.cafe24api.com/api/v2/oauth/token',
        data=data,
        headers={
            'Authorization': f'Basic {creds}',
            'Content-Type':  'application/x-www-form-urlencoded',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())

async def run():
    cfg     = load_config()
    c24     = cfg.get('cafe24', {})
    mall_id = c24.get('mallId', '')
    cli_id  = c24.get('clientId', '')
    cli_sec = c24.get('clientSecret', '')

    if not mall_id or not cli_id or not cli_sec:
        print('[cafe24_reauth] lc_config.json에 mallId/clientId/clientSecret 없음')
        sys.exit(1)

    redirect_uri = 'https://03030.co.kr/'
    scope = 'mall.read_order,mall.read_shipping,mall.write_shipping,mall.write_order'
    auth_url = (
        f'https://{mall_id}.cafe24api.com/api/v2/oauth/authorize'
        f'?response_type=code&client_id={urllib.parse.quote(cli_id)}'
        f'&state=auto_reauth'
        f'&redirect_uri={urllib.parse.quote(redirect_uri)}'
        f'&scope={urllib.parse.quote(scope)}'
    )

    SESSION_DIR.mkdir(exist_ok=True)
    headless = '--headless' in sys.argv

    async with async_playwright() as p:
        browser = await p.chromium.launch_persistent_context(
            str(SESSION_DIR),
            headless=headless,
            args=['--no-sandbox'],
        )
        page = browser.pages[0] if browser.pages else await browser.new_page()

        print(f'[cafe24_reauth] OAuth URL 접속 중...')
        await page.goto(auth_url, timeout=30000)

        # 이미 로그인된 경우 바로 03030.co.kr 로 리다이렉트됨
        # 아니면 카페24 로그인 페이지가 뜸 → 최대 60초 대기
        try:
            await page.wait_for_url('https://03030.co.kr/*', timeout=60000)
        except Exception:
            # 로그인 페이지가 떴을 수 있음
            cur = page.url
            print(f'[cafe24_reauth] 현재 URL: {cur}')
            if '03030.co.kr' not in cur:
                print('[cafe24_reauth] 카페24 로그인 필요 → headless=False로 재시도하세요')
                await browser.close()
                sys.exit(2)

        final_url = page.url
        print(f'[cafe24_reauth] 리다이렉트 URL: {final_url}')
        await browser.close()

    # code 파라미터 추출
    parsed = urllib.parse.urlparse(final_url)
    qs     = urllib.parse.parse_qs(parsed.query)
    code   = qs.get('code', [''])[0]
    if not code:
        print(f'[cafe24_reauth] code 없음. URL: {final_url}')
        sys.exit(1)

    print(f'[cafe24_reauth] code 획득: {code[:8]}...')

    # 토큰 교환
    try:
        token_data = exchange_code(mall_id, cli_id, cli_sec, code, redirect_uri)
    except Exception as e:
        print(f'[cafe24_reauth] 토큰 교환 실패: {e}')
        sys.exit(1)

    if 'access_token' not in token_data:
        print(f'[cafe24_reauth] 토큰 교환 오류: {token_data}')
        sys.exit(1)

    # lc_config.json 업데이트
    cfg = load_config()
    cfg.setdefault('cafe24', {})
    cfg['cafe24']['token']                   = token_data['access_token']
    cfg['cafe24']['accessToken']             = token_data['access_token']
    cfg['cafe24']['refreshToken']            = token_data.get('refresh_token', '')
    cfg['cafe24']['tokenExpiresAt']          = token_data.get('expires_at', '')
    cfg['cafe24']['refreshTokenExpiresAt']   = token_data.get('refresh_token_expires_at', '')
    save_config(cfg)

    print(f'[cafe24_reauth] ✅ 완료!')
    print(f'  access_token  : {token_data["access_token"][:12]}...')
    print(f'  expires_at    : {token_data.get("expires_at", "")}')
    print(f'  refresh_token : {token_data.get("refresh_token","")[:12]}...')
    print(f'  refresh_expires: {token_data.get("refresh_token_expires_at","")}')

if __name__ == '__main__':
    asyncio.run(run())
