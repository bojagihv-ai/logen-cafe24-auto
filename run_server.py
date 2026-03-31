# -*- coding: utf-8 -*-
"""
로젠 x 카페24 송장 매니저 - 로컬 서버
vercel dev 없이 실행하는 Python 서버
http://localhost:3000/logen-cafe24.html 로 접속
"""
import http.server, json, urllib.request, urllib.parse, urllib.error, os, sys, base64, datetime, threading, subprocess
from socketserver import ThreadingMixIn

class ThreadingHTTPServer(ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, 'lc_config.json')

# 로젠 세션 토큰 저장소 (메모리)
_logen_session = {}   # { 'token': str, 'page_id': str, 'user_info': str, 'emp_id': str }

def load_config():
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception:
        pass
    return {}

def save_config(data):
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def split_telno(tel, part):
    """전화번호를 '-' 기준으로 분리"""
    if not tel:
        return ''
    parts = tel.replace(' ', '').split('-')
    if len(parts) >= part:
        return parts[part - 1]
    return ''

def logen_post(url, payload, token, page_id='lrm01f0050'):
    """로젠 API POST 헬퍼"""
    headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'x-token':  token,
        'x-pageId': page_id,
    }
    req_data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(url, data=req_data, headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read().decode('utf-8')
        try:
            return json.loads(raw)
        except Exception:
            return raw  # getSlipNoSave 는 plain text 반환


def api_logen_register(body):
    """로젠 직접 송장 등록 API (saveResv → getSlipNoSave → updateSlipNo)"""
    if not _logen_session.get('token'):
        return 401, {'error': '로젠 토큰 없음. 로젠 포털(logis.ilogen.com)에 먼저 로그인하세요.'}

    orders = body.get('orders', [])
    if not orders:
        return 400, {'error': '주문 데이터가 없습니다.'}

    token   = _logen_session['token']
    page_id = _logen_session.get('page_id', 'lrm01f0050')
    emp_id  = _logen_session.get('emp_id', '33253401')
    today   = datetime.date.today().strftime('%Y%m%d')
    today_dash = datetime.date.today().strftime('%Y-%m-%d')

    # 송하인 정보 (저장된 설정)
    snd_name = body.get('senderName', '신화사')
    snd_tel  = body.get('senderTel',  '031-411-6738')
    snd_addr = body.get('senderAddr', '경기 안산시 상록구 동막길 69-9  (장상동 302)')
    snd_zip  = body.get('senderZip',  '15201')
    snd_bldg = body.get('senderBldgCd', '4127111400103020000028500')
    snd_addr_repl = body.get('senderAddrRepl', '(장상동 302)')
    cust_cd  = body.get('customerCode', '33253401')
    pick_bran_cd  = body.get('pickBranCd',  '332')
    pick_sales_cd = body.get('pickSalesCd', '33212059')
    pick_sales_nm = body.get('pickSalesNm', '본오동3')

    BASE = 'https://logis.ilogen.com/api/lrm01b-reserve'

    results = []
    for order in orders:
        rcv_tel   = order.get('phone', '')
        rcv_name  = order.get('name', '')
        rcv_addr  = order.get('address', '')
        rcv_zip   = order.get('zipcode', '')
        rcv_addr2 = order.get('addressDetail', '')
        dlv_msg   = order.get('deliveryMemo', '')
        order_no  = order.get('orderId', '')
        item_nm   = order.get('productName', '보자기')
        qty       = str(order.get('qty', 1))

        try:
            # ── Step 1: saveResv ────────────────────────────────────────────
            save_payload = {
                'data': [{
                    'fixcustCd':      cust_cd,
                    'fixcustNm':      snd_name,
                    'takeDt':         today,
                    'seq':            '',       # 서버가 자동 부여
                    'takeTy':         '100',
                    'resvTy':         '100',
                    'orgSlipNo':      '',
                    'fixTakeNo':      order_no,
                    # 수하인
                    'rcvTelno1':      split_telno(rcv_tel, 1),
                    'rcvTelno2':      split_telno(rcv_tel, 2),
                    'rcvTelno3':      split_telno(rcv_tel, 3),
                    'rcvCellNo1':     split_telno(rcv_tel, 1),
                    'rcvCellNo2':     split_telno(rcv_tel, 2),
                    'rcvCellNo3':     split_telno(rcv_tel, 3),
                    'rcvCustNm':      rcv_name,
                    'rcvZipCd':       rcv_zip.replace('-', ''),
                    'rcvCustAddr':    rcv_addr,
                    'rcvCustAddrDTL': rcv_addr2,
                    'rcvBldgCd':      '',
                    'rcvCustCd':      '',
                    'rcvAddrRepl':    '',
                    # 송하인
                    'sndTelno1':      split_telno(snd_tel, 1),
                    'sndTelno2':      split_telno(snd_tel, 2),
                    'sndTelno3':      split_telno(snd_tel, 3),
                    'sndCellNo1':     '',
                    'sndCellNo2':     '',
                    'sndCellNo3':     '',
                    'sndCustNm':      snd_name,
                    'sndZipCd':       snd_zip.replace('-', ''),
                    'sndCustAddr':    snd_addr,
                    'sndCustAddrDTL': '',
                    'sndBldgCd':      snd_bldg,
                    'sndCustCd':      '',
                    'sndAddrRepl':    snd_addr_repl,
                    # 배송
                    'dlvMsg':         dlv_msg,
                    'qty':            qty,
                    'fareTy':         '030',
                    'jejuFareTy':     '',
                    'boxPrice':       '0',
                    'totPrice':       '2700',
                    'boxTyCd':        '',
                    'fareDiv':        'T',
                    'pickBranCd':     pick_bran_cd,
                    'pickSalesCd':    pick_sales_cd,
                    'pickSalesNm':    pick_sales_nm,
                    'pickSalesCellNo':'',
                    'dlvBranCd':      '',
                    'dlvBranNm':      pick_sales_nm,
                    # 물품
                    'itemCd':         '',
                    'itemCdNm':       '',
                    'itemNm':         item_nm[:10] if item_nm else '보자기',
                    'goodAmt':        '0',
                    'wt':             '',
                    'jejuFare':       '',
                    'extraAmt':       '',
                    'dealKindCd':     '',
                    'rcvFixcustCd':   '',
                    'rcvFixcustNm':   '',
                    'autoRateTy':     'N',
                    'relNo':          '',
                    'relSeq':         '',
                    'relTotQty':      '',
                }],
                'regEmpId': emp_id,
                'gGubun':   'S',   # 'S' = 신규저장 (이전 'N' 오류 수정)
            }

            save_resp = logen_post(f'{BASE}/lrm01b0050/saveResv', save_payload, token, page_id)
            if not (save_resp.get('rtnNo') == 99 or save_resp.get('rtnNo') == '99'):
                results.append({'orderId': order_no, 'success': False,
                                 'error': save_resp.get('rtnMsg', 'saveResv 실패'), 'raw': save_resp})
                continue

            # ── Step 2: getResvList → 저장된 주문의 seq/ordSeq 조회 ──────────
            list_resp = logen_post(f'{BASE}/lrm01b0050/getResvList', {
                'strTakeDt':      today_dash,
                'strFixCustCd':   cust_cd,
                'strPickSalesCd': pick_sales_cd,
                'strPickBranCd':  pick_bran_cd,
            }, token, page_id)

            # fixTakeNo(주문번호)로 방금 저장된 행 찾기 (prtCnt=0 인 가장 최근 seq)
            saved_row = None
            if isinstance(list_resp, list):
                matches = [r for r in list_resp
                           if r.get('fixTakeNo') == order_no and str(r.get('prtCnt', '')) == '0']
                if matches:
                    # seq 가장 큰 것 (최신)
                    saved_row = max(matches, key=lambda r: int(r.get('seq', 0)))

            if not saved_row:
                # 조회 실패해도 slipNo 없이 성공 처리 (이미 저장은 됨)
                results.append({'orderId': order_no, 'success': True, 'slipNo': '',
                                 'note': 'saveResv 성공, getResvList 조회 실패', 'raw': save_resp})
                continue

            # ── Step 3: getSlipNoSave → 운송장 번호 채번 ────────────────────
            slip_resp = logen_post(f'{BASE}/lrm01bp500/getSlipNoSave',
                                   {'qty': 1}, token, page_id)
            # 응답은 plain text 숫자 (예: "44088127845")
            new_slip_no = str(slip_resp).strip() if slip_resp else ''

            if not new_slip_no or not new_slip_no.isdigit():
                results.append({'orderId': order_no, 'success': True, 'slipNo': '',
                                 'note': 'saveResv 성공, 운송장번호 채번 실패', 'raw': str(slip_resp)})
                continue

            # ── Step 4: updateSlipNo → 운송장 번호 확정 ─────────────────────
            update_payload = {
                'gubn':         'SAVE',
                'fixcustCd':    saved_row.get('fixcustCd', ''),
                'takeDt':       saved_row.get('takeDt', ''),
                'ordSeq':       saved_row.get('ordSeq', ''),
                'seq':          saved_row.get('seq', ''),
                'mgmtFixcust':  saved_row.get('mgmtFixcust', ''),
                'takeTy':       saved_row.get('takeTy', ''),
                'ordQty':       saved_row.get('ordQty', ''),
                'dlvFare':      saved_row.get('dlvFare', ''),
                'jejuFare':     saved_row.get('jejuFare', ''),
                'shipAmt':      saved_row.get('shipAmt', ''),
                'extraAmt':     saved_row.get('extraAmt', ''),
                'slipNo':       saved_row.get('slipNo', ''),
                'newSlipNo':    new_slip_no,
            }
            update_resp = logen_post(f'{BASE}/lrm01bp500/updateSlipNo',
                                     update_payload, token, page_id)

            print(f'  [로젠 등록] {order_no} → slipNo={new_slip_no}')
            results.append({'orderId': order_no, 'success': True, 'slipNo': new_slip_no,
                             'raw': {'saveResv': save_resp, 'updateSlipNo': update_resp}})

        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='ignore')
            results.append({'orderId': order_no, 'success': False,
                             'error': f'HTTP {e.code}: {err_body[:200]}'})
        except Exception as ex:
            results.append({'orderId': order_no, 'success': False, 'error': str(ex)})

    ok   = sum(1 for r in results if r['success'])
    fail = sum(1 for r in results if not r['success'])
    return 200, {'results': results, 'total': len(results), 'ok': ok, 'fail': fail}

MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.ico':  'image/x-icon',
    '.svg':  'image/svg+xml',
}

def cors(handler):
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    handler.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    handler.send_header('Access-Control-Allow-Private-Network', 'true')

def api_cafe24(body):
    action      = body.get('action', '')
    mall_id     = body.get('mallId', '')
    token       = body.get('token', '')
    client_id   = body.get('clientId', '')
    client_sec  = body.get('clientSecret', '')
    refresh_tok = body.get('refreshToken', '')

    if action == 'refresh_token':
        cred = base64.b64encode(f'{client_id}:{client_sec}'.encode()).decode()
        payload = f'grant_type=refresh_token&refresh_token={urllib.parse.quote(refresh_tok)}'.encode()
        req = urllib.request.Request(
            f'https://{mall_id}.cafe24api.com/api/v2/oauth/token',
            data=payload,
            headers={'Authorization': f'Basic {cred}', 'Content-Type': 'application/x-www-form-urlencoded'},
            method='POST'
        )

    elif action == 'exchange_code':
        code         = body.get('code', '')
        redirect_uri = body.get('redirectUri', '')
        cred = base64.b64encode(f'{client_id}:{client_sec}'.encode()).decode()
        payload = (f'grant_type=authorization_code'
                   f'&code={urllib.parse.quote(code)}'
                   f'&redirect_uri={urllib.parse.quote(redirect_uri)}').encode()
        req = urllib.request.Request(
            f'https://{mall_id}.cafe24api.com/api/v2/oauth/token',
            data=payload,
            headers={'Authorization': f'Basic {cred}', 'Content-Type': 'application/x-www-form-urlencoded'},
            method='POST'
        )

    elif action == 'get_orders':
        start = body.get('startDate', '')
        end   = body.get('endDate', '')
        qs    = f'start_date={start}&end_date={end}&order_status=N20&limit=100&embed=items,receivers'
        req   = urllib.request.Request(
            f'https://{mall_id}.cafe24api.com/api/v2/admin/orders?{qs}',
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json',
                     'X-Cafe24-Api-Version': '2025-12-01'},
            method='GET'
        )

    elif action == 'get_order_detail':
        order_id = body.get('orderId', '')
        req = urllib.request.Request(
            f'https://{mall_id}.cafe24api.com/api/v2/admin/orders/{order_id}?embed=items',
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json',
                     'X-Cafe24-Api-Version': '2025-12-01'},
            method='GET'
        )

    elif action == 'update_shipping':
        order_id      = body.get('orderId', '')
        tracking_no   = body.get('trackingNo', '')
        order_item_code = body.get('orderItemCode', '')
        item_codes    = [order_item_code] if order_item_code else []
        payload_dict  = {
            'shop_no': 1,
            'request': {
                'shipping_company_code': '0004',
                'tracking_no': tracking_no,
                'status': 'standby',
            }
        }
        if item_codes:
            payload_dict['request']['order_item_code'] = item_codes
        payload = json.dumps(payload_dict).encode()
        req = urllib.request.Request(
            f'https://{mall_id}.cafe24api.com/api/v2/admin/orders/{order_id}/shipments',
            data=payload,
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json',
                     'X-Cafe24-Api-Version': '2025-12-01'},
            method='POST'
        )
    else:
        return 400, {'error': 'Unknown action'}

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def api_logen(body):
    tracking_numbers = body.get('trackingNumbers', [])
    if not tracking_numbers:
        return 400, {'error': '송장번호 필요'}
    results = {}
    for no in tracking_numbers:
        try:
            url = f'https://apis.tracker.delivery/carriers/kr.logen/tracks/{urllib.parse.quote(str(no))}'
            req = urllib.request.Request(url, headers={'Accept': 'application/json'}, method='GET')
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode())
            if data.get('message'):
                results[no] = {'status': '배송준비', 'lastUpdate': '-', 'location': '', 'events': []}
            else:
                events = [{'time': e.get('time',''), 'status': (e.get('status') or {}).get('name','') or e.get('description',''), 'location': (e.get('location') or {}).get('name','')} for e in (data.get('events') or data.get('progresses') or [])]
                last = events[-1] if events else {}
                results[no] = {'status': last.get('status','조회중'), 'lastUpdate': last.get('time','-'), 'location': last.get('location',''), 'events': events}
        except Exception as ex:
            results[no] = {'status': '조회실패', 'lastUpdate': '-', 'location': '', 'events': [], 'error': str(ex)}
    return 200, {'data': results}


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f'  {self.address_string()} {fmt % args}')

    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        cors(self)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        cors(self)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs   = urllib.parse.parse_qs(parsed.query)

        # GET /store-logen-token?t=TOKEN&p=PAGE_ID&u=USER_INFO&e=EMP_ID
        if path == '/store-logen-token':
            tok = qs.get('t', [''])[0]
            if tok:
                _logen_session['token']     = tok
                _logen_session['page_id']   = qs.get('p', ['lrm01f0050'])[0]
                _logen_session['user_info'] = qs.get('u', [''])[0]
                _logen_session['emp_id']    = qs.get('e', [''])[0]
                print(f'  [로젠 토큰 GET 저장됨] empId={_logen_session["emp_id"]} len={len(tok)}')
            html = b'<html><head><meta charset="utf-8"><script>window.close();</script></head><body>Token saved. <a href="http://localhost:8080/">Back</a></body></html>'
            self.send_response(200)
            cors(self)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(html)))
            self.end_headers()
            self.wfile.write(html)
            return

        if path == '/api/config':
            self.send_json(200, load_config())
            return

        if path == '/':
            path = '/logen-cafe24.html'
        fpath = os.path.join(BASE_DIR, path.lstrip('/').replace('/', os.sep))
        if os.path.isfile(fpath):
            ext = os.path.splitext(fpath)[1].lower()
            mime = MIME.get(ext, 'application/octet-stream')
            with open(fpath, 'rb') as f:
                data = f.read()
            self.send_response(200)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not Found')

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        length = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(length)
        try:
            body = json.loads(raw.decode('utf-8')) if raw else {}
        except Exception:
            body = {}

        if path == '/api/config':
            try:
                save_config(body)
                self.send_json(200, {'ok': True})
            except Exception as e:
                self.send_json(500, {'error': str(e)})
            return
        if path == '/api/cafe24':
            status, data = api_cafe24(body)
            self.send_json(status, data)
        elif path == '/api/logen':
            status, data = api_logen(body)
            self.send_json(status, data)
        elif path == '/api/logen-register':
            status, data = api_logen_register(body)
            self.send_json(status, data)
        elif path == '/store-logen-token':
            # 브라우저에서 로젠 JWT 토큰 수신
            _logen_session['token']     = body.get('token', '')
            _logen_session['page_id']   = body.get('pageId', 'lrm01f0050')
            _logen_session['user_info'] = body.get('userInfo', '')
            _logen_session['emp_id']    = body.get('empId', '')
            print(f'  [로젠 토큰 저장됨] empId={_logen_session["emp_id"]} len={len(_logen_session["token"])}')
            # 디스크에도 저장 (서버 재시작 후 복원용)
            try:
                cfg = load_config()
                cfg['logen_token'] = _logen_session['token']
                cfg['logen_emp_id'] = _logen_session['emp_id']
                save_config(cfg)
            except Exception:
                pass
            self.send_json(200, {'ok': True})
        else:
            self.send_json(404, {'error': 'Not Found'})


REFRESH_INTERVAL = 6 * 3600  # 6시간마다 JWT 갱신

def auto_refresh_logen_token():
    """6시간마다 logen_get_token.py --headless 실행하여 JWT 자동 갱신"""
    script = os.path.join(BASE_DIR, 'logen_get_token.py')
    try:
        print('  [JWT 자동 갱신 시작]')
        subprocess.Popen(
            [sys.executable, '-X', 'utf8', script, '--headless'],
            cwd=BASE_DIR,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
        )
    except Exception as e:
        print(f'  [JWT 갱신 오류] {e}')
    # 다음 갱신 예약
    threading.Timer(REFRESH_INTERVAL, auto_refresh_logen_token).start()

if __name__ == '__main__':
    # 1. 서버 재시작 시 디스크에서 JWT 복원
    _saved = load_config()
    if _saved.get('logen_token'):
        _logen_session['token']   = _saved['logen_token']
        _logen_session['page_id'] = 'lrm01f0050'
        _logen_session['emp_id']  = _saved.get('logen_emp_id', '')
        print(f'  [로젠 JWT 복원됨] len={len(_logen_session["token"])}')

    # 2. 서버 시작 후 10초 뒤 첫 JWT 갱신 (백그라운드)
    threading.Timer(10, auto_refresh_logen_token).start()

    server = ThreadingHTTPServer(('localhost', PORT), Handler)
    print(f'')
    print(f'  [OK] Logen x Cafe24 server started!')
    print(f'  Open: http://localhost:{PORT}/')
    print(f'  JWT 자동 갱신: 6시간마다 (백그라운드)')
    print(f'  (종료: Ctrl+C)')
    print(f'')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('서버 종료.')
