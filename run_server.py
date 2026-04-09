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
    pick_sales_cd = body.get('pickSalesCd', '33212068')
    pick_sales_nm = body.get('pickSalesNm', '상록영업소')

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


def api_logen_get_printed(body):
    """로젠에서 slipNo가 있는 (출력완료) 예약 목록 조회 — 날짜 범위 순회"""
    if not _logen_session.get('token'):
        return 401, {'error': '로젠 토큰 없음. 로젠 자동 등록을 한 번 먼저 눌러주세요.'}

    token    = _logen_session['token']
    page_id  = _logen_session.get('page_id', 'lrm01f0050')
    cust_cd  = body.get('customerCode', '33253401')
    pick_sales_cd = body.get('pickSalesCd', '33212068')
    pick_bran_cd  = body.get('pickBranCd',  '332')

    today_str = datetime.date.today().strftime('%Y-%m-%d')
    start_str = body.get('startDate', today_str)
    end_str   = body.get('endDate',   today_str)

    BASE = 'https://logis.ilogen.com/api/lrm01b-reserve'

    try:
        start_d = datetime.datetime.strptime(start_str, '%Y-%m-%d').date()
        end_d   = datetime.datetime.strptime(end_str,   '%Y-%m-%d').date()
    except ValueError:
        return 400, {'error': f'날짜 형식 오류: {start_str} ~ {end_str}'}

    all_items = []
    d = start_d
    while d <= end_d:
        date_str = d.strftime('%Y-%m-%d')
        try:
            resp = logen_post(f'{BASE}/lrm01b0050/getResvList', {
                'strTakeDt':      date_str,
                'strFixCustCd':   cust_cd,
                'strPickSalesCd': pick_sales_cd,
                'strPickBranCd':  pick_bran_cd,
            }, token, page_id)
            if isinstance(resp, list):
                for r in resp:
                    slip = str(r.get('slipNo', '') or '').strip()
                    if slip:  # slipNo 있는 항목 = 운송장 발급 완료
                        all_items.append({
                            'orderId':      str(r.get('fixTakeNo', '') or '').strip(),
                            'slipNo':       slip,
                            'receiverName': r.get('rcvCustNm', ''),
                            'date':         date_str,
                            'prtCnt':       r.get('prtCnt', 0),
                            'seq':          r.get('seq', ''),
                        })
        except Exception as e:
            print(f'  [logen-printed] {date_str} 오류: {e}')
        d += datetime.timedelta(days=1)

    print(f'  [logen-printed] {start_str}~{end_str} 조회 → {len(all_items)}건')
    return 200, {'items': all_items, 'total': len(all_items)}


def api_auto_print(body):
    """인쇄 다이얼로그가 열린 후 Enter 키로 자동 확인 (PowerShell SendKeys)"""
    import time
    delay_ms = int(body.get('delayMs', 2500))

    def press_enter():
        time.sleep(delay_ms / 1000.0)
        try:
            subprocess.run(
                ['powershell', '-WindowStyle', 'Hidden', '-Command',
                 '$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys("{ENTER}")'],
                capture_output=True,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0,
            )
            print(f'  [자동인쇄] Enter 키 전송 완료 ({delay_ms}ms 후)')
        except Exception as e:
            print(f'  [자동인쇄] Enter 키 전송 실패: {e}')

    threading.Thread(target=press_enter, daemon=True).start()
    return 200, {'ok': True}


def api_fix_launcher(_body):
    """바탕화면 바로가기 재생성 + 서버 재시작 (VBS watchdog이 새 코드로 재시작)"""
    import time

    def do_fix():
        # 1. 바탕화면 바로가기 재생성
        vbs = os.path.join(BASE_DIR, 'create_shortcut.vbs')
        if os.path.exists(vbs):
            try:
                subprocess.run(
                    ['wscript.exe', vbs],
                    capture_output=True,
                    creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0,
                    timeout=10,
                )
                print('  [런처 수정] 바로가기 재생성 완료')
            except Exception as e:
                print(f'  [런처 수정] 바로가기 생성 오류: {e}')
        time.sleep(1)
        # 2. 서버 종료 → VBS watchdog이 새 코드로 재시작
        print('  [런처 수정] 서버 재시작...')
        os._exit(0)

    threading.Thread(target=do_fix, daemon=True).start()
    return 200, {'ok': True, 'message': '바로가기 수정 + 서버 재시작 중...'}


def api_restart(_body):
    """서버 즉시 재시작 (VBS watchdog이 새 코드로 재시작)"""
    def do_restart():
        import time
        time.sleep(0.5)
        print('  [재시작] os._exit(0) 호출')
        os._exit(0)
    threading.Thread(target=do_restart, daemon=True).start()
    return 200, {'ok': True, 'message': '재시작 중...'}


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
    elif action == 'get_product_images':
        # product_no 목록으로 이미지 조회
        # 1차: mall.read_product API 시도
        # 2차: 실패 시 상품 상세 페이지 HTML에서 og:image 파싱 (스코프 불필요)
        import re as _re
        product_nos = body.get('productNos', [])
        if not product_nos:
            return 200, {'images': {}}
        result = {}

        # ── 1차 시도: API (mall.read_product 스코프 있을 때) ──────────────
        nos_str = ','.join(str(n) for n in product_nos[:50])
        img_api_url = (
            f'https://{mall_id}.cafe24api.com/api/v2/admin/products'
            f'?product_no={nos_str}&fields=product_no,detail_image,list_image'
        )
        img_req = urllib.request.Request(
            img_api_url,
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json',
                     'X-Cafe24-Api-Version': '2025-12-01'},
            method='GET'
        )
        api_ok = False
        try:
            with urllib.request.urlopen(img_req, timeout=10) as r:
                pdata = json.loads(r.read().decode())
                for p in pdata.get('products', []):
                    img = p.get('detail_image') or p.get('list_image') or ''
                    if img:
                        result[str(p['product_no'])] = img
            api_ok = True
            print(f'  [상품이미지] API로 {len(result)}개 조회 성공')
        except Exception:
            print(f'  [상품이미지] API 실패 (mall.read_product 스코프 없음) → 페이지 파싱으로 전환')

        # ── 2차 시도: 상품 상세 페이지 HTML에서 og:image 추출 ────────────
        if not api_ok:
            for pno in product_nos[:20]:  # 최대 20개 (과도한 요청 방지)
                if str(pno) in result:
                    continue
                try:
                    page_url = f'https://{mall_id}.cafe24.com/product/detail.html?product_no={pno}'
                    page_req = urllib.request.Request(
                        page_url,
                        headers={'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ko-KR,ko;q=0.9'},
                        method='GET'
                    )
                    with urllib.request.urlopen(page_req, timeout=8) as r:
                        html = r.read().decode('utf-8', errors='ignore')
                    # og:image 메타 태그 추출
                    m = _re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', html)
                    if not m:
                        m = _re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', html)
                    if m:
                        img_src = m.group(1).strip()
                        if img_src and img_src.startswith('http'):
                            result[str(pno)] = img_src
                            print(f'  [상품이미지] product_no={pno} og:image 파싱 성공')
                except Exception as pe:
                    print(f'  [상품이미지] product_no={pno} 페이지 파싱 실패: {pe}')

        return 200, {'images': result}

    else:
        return 400, {'error': 'Unknown action'}

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='ignore')
        print(f'  [카페24 API 오류] {action} HTTP {e.code}: {err_body[:300]}')
        try:
            return e.code, json.loads(err_body)
        except Exception:
            return e.code, {'error': {'code': e.code, 'message': err_body[:300]}}

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

        if path == '/api/health':
            cfg = load_config()
            logen_ok  = bool(_logen_session.get('token'))
            cafe24_ok = bool(cfg.get('cafe24', {}).get('token') or cfg.get('cafe24', {}).get('accessToken'))
            expires_at = cfg.get('cafe24', {}).get('tokenExpiresAt', '')
            # 만료까지 남은 분 계산
            minutes_left = None
            if expires_at:
                try:
                    exp_dt = datetime.datetime.fromisoformat(expires_at.replace('Z', '+00:00').replace('.000', ''))
                    now_dt = datetime.datetime.now()
                    diff = (exp_dt - now_dt).total_seconds()
                    minutes_left = int(diff / 60)
                except Exception:
                    pass
            self.send_json(200, {
                'ok': True,
                'logen':  {'tokenOk': logen_ok,  'tokenLen': len(_logen_session.get('token', '')),
                           'failCount': _logen_fail_count},
                'cafe24': {'tokenOk': cafe24_ok, 'expiresAt': expires_at,
                           'minutesLeft': minutes_left, 'failCount': _cafe24_fail_count},
                'time':   datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            })
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
        elif path == '/api/logen-printed':
            status, data = api_logen_get_printed(body)
            self.send_json(status, data)
        elif path == '/api/auto-print':
            status, data = api_auto_print(body)
            self.send_json(status, data)
        elif path == '/api/restart':
            status, data = api_restart(body)
            self.send_json(status, data)
        elif path == '/api/fix-launcher':
            status, data = api_fix_launcher(body)
            self.send_json(status, data)
        elif path == '/api/cafe24-reauth':
            # cafe24_reauth.py --headless 실행 → 자동 OAuth 재인증
            script = os.path.join(BASE_DIR, 'cafe24_reauth.py')
            try:
                print('  [카페24 재인증] cafe24_reauth.py --headless 실행 중...')
                result = subprocess.run(
                    [sys.executable, '-X', 'utf8', script, '--headless'],
                    cwd=BASE_DIR, timeout=90,
                    capture_output=True, text=True,
                    creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0,
                )
                if result.returncode == 0:
                    # 저장된 토큰 읽어서 메모리 갱신
                    cfg = load_config()
                    new_token = cfg.get('cafe24', {}).get('token', '')
                    print(f'  [카페24 재인증] 성공 token={new_token[:10]}...')
                    self.send_json(200, {'ok': True, 'token': new_token})
                else:
                    err = (result.stderr or result.stdout or '재인증 실패')[-500:]
                    print(f'  [카페24 재인증] 실패: {err}')
                    self.send_json(500, {'ok': False, 'error': err})
            except subprocess.TimeoutExpired:
                self.send_json(500, {'ok': False, 'error': '타임아웃 (90초)'})
            except Exception as e:
                self.send_json(500, {'ok': False, 'error': str(e)})
        elif path == '/api/logen-get-token':
            # logen_get_token.py --headless 실행하여 JWT 자동 획득 (동기 대기)
            script = os.path.join(BASE_DIR, 'logen_get_token.py')
            try:
                print('  [로젠 자동 로그인 요청] logen_get_token.py --headless 실행 중...')
                result = subprocess.run(
                    [sys.executable, '-X', 'utf8', script, '--headless'],
                    cwd=BASE_DIR,
                    timeout=90,
                    capture_output=True,
                    text=True,
                    creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0,
                )
                if result.returncode == 0 and _logen_session.get('token'):
                    print('  [로젠 자동 로그인] 성공')
                    self.send_json(200, {'ok': True})
                else:
                    err_msg = (result.stderr or result.stdout or '토큰 획득 실패')[-300:]
                    print(f'  [로젠 자동 로그인] 실패: {err_msg}')
                    self.send_json(500, {'ok': False, 'error': err_msg})
            except subprocess.TimeoutExpired:
                self.send_json(500, {'ok': False, 'error': '타임아웃 (90초)'})
            except Exception as e:
                self.send_json(500, {'ok': False, 'error': str(e)})
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


REFRESH_INTERVAL      = 3 * 3600   # 3시간마다 로젠 JWT 갱신 (기존 6h → 안전하게 단축)
CAFE24_REFRESH_INTERVAL = 80 * 60  # 80분마다 카페24 토큰 갱신 (유효기간 2시간, 여유 있게)
_cafe24_fail_count = 0             # 연속 실패 횟수 (짧은 retry 제어용)
_logen_fail_count  = 0

def auto_refresh_cafe24_token(retry=False):
    """80분마다 카페24 access_token 자동 갱신 + 실패 시 15분 후 재시도(최대 3회)"""
    global _cafe24_fail_count
    try:
        cfg = load_config()
        mall_id     = cfg.get('cafe24', {}).get('mallId', '')
        client_id   = cfg.get('cafe24', {}).get('clientId', '')
        client_sec  = cfg.get('cafe24', {}).get('clientSecret', '')
        refresh_tok = cfg.get('cafe24', {}).get('refreshToken', '')
        if mall_id and client_id and client_sec and refresh_tok:
            cred    = base64.b64encode(f'{client_id}:{client_sec}'.encode()).decode()
            payload = f'grant_type=refresh_token&refresh_token={urllib.parse.quote(refresh_tok)}'.encode()
            req     = urllib.request.Request(
                f'https://{mall_id}.cafe24api.com/api/v2/oauth/token',
                data=payload,
                headers={'Authorization': f'Basic {cred}', 'Content-Type': 'application/x-www-form-urlencoded'},
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode())
            if data.get('access_token'):
                cfg['cafe24']['accessToken']  = data['access_token']
                cfg['cafe24']['token']         = data['access_token']
                if data.get('refresh_token'):
                    cfg['cafe24']['refreshToken'] = data['refresh_token']
                if data.get('expires_at'):
                    cfg['cafe24']['tokenExpiresAt'] = data['expires_at']
                else:
                    expires_dt = datetime.datetime.now() + datetime.timedelta(hours=2)
                    cfg['cafe24']['tokenExpiresAt'] = expires_dt.strftime('%Y-%m-%dT%H:%M:%S.000')
                save_config(cfg)
                _cafe24_fail_count = 0
                print(f'  [카페24 토큰 자동갱신 완료] {datetime.datetime.now().strftime("%H:%M:%S")}')
            else:
                raise ValueError(f'access_token 없음: {data}')
        else:
            print(f'  [카페24 토큰 갱신 스킵] 설정 없음')
            _cafe24_fail_count = 0
    except Exception as e:
        _cafe24_fail_count += 1
        print(f'  [카페24 토큰 갱신 오류 #{_cafe24_fail_count}] {e}')
        if _cafe24_fail_count <= 3:
            # 실패 시 15분 후 재시도
            print(f'  [카페24] 15분 후 재시도 예약...')
            threading.Timer(15 * 60, auto_refresh_cafe24_token, kwargs={'retry': True}).start()
            return  # 재시도 예약했으니 정상 주기 타이머는 이번엔 건너뜀
        else:
            print(f'  [카페24] 3회 연속 실패 → 다음 정상 주기에 재시도')
            _cafe24_fail_count = 0
    # 다음 정상 주기 갱신 예약
    threading.Timer(CAFE24_REFRESH_INTERVAL, auto_refresh_cafe24_token).start()

def auto_refresh_logen_token(retry=False):
    """3시간마다 logen_get_token.py --headless 실행하여 JWT 자동 갱신 + 실패 시 30분 후 재시도"""
    global _logen_fail_count
    script = os.path.join(BASE_DIR, 'logen_get_token.py')
    prev_token = _logen_session.get('token', '')
    try:
        print(f'  [로젠 JWT 자동 갱신 시작] {"(재시도)" if retry else ""}')
        result = subprocess.run(
            [sys.executable, '-X', 'utf8', script, '--headless'],
            cwd=BASE_DIR,
            capture_output=True,
            timeout=120,  # 2분 제한
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
        )
        # 갱신 성공 여부: 메모리 토큰이 바뀌었거나 returncode=0
        new_token = _logen_session.get('token', '')
        if result.returncode == 0 and new_token:
            _logen_fail_count = 0
            changed = '변경됨' if new_token != prev_token else '동일 (세션 유지)'
            print(f'  [로젠 JWT 갱신 완료] {datetime.datetime.now().strftime("%H:%M:%S")} 토큰={changed}')
        else:
            raise RuntimeError(f'returncode={result.returncode}, token_len={len(new_token)}')
    except Exception as e:
        _logen_fail_count += 1
        print(f'  [로젠 JWT 갱신 오류 #{_logen_fail_count}] {e}')
        if _logen_fail_count <= 3:
            print(f'  [로젠] 30분 후 재시도 예약...')
            threading.Timer(30 * 60, auto_refresh_logen_token, kwargs={'retry': True}).start()
            return
        else:
            print(f'  [로젠] 3회 연속 실패 → 다음 정상 주기에 재시도')
            _logen_fail_count = 0
    # 다음 정상 주기 갱신 예약
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

    # 3. 카페24 토큰 자동 갱신 (30초 후 첫 갱신, 이후 90분마다)
    threading.Timer(30, auto_refresh_cafe24_token).start()

    # 포트 사용 중이면 최대 10초 재시도
    for _retry in range(10):
        try:
            server = ThreadingHTTPServer(('localhost', PORT), Handler)
            break
        except OSError as e:
            print(f'  [포트 {PORT} 사용중] 재시도 {_retry+1}/10... ({e})', flush=True)
            import time as _time; _time.sleep(1)
    else:
        print(f'  [FATAL] 포트 {PORT} 바인딩 실패 - 다른 프로세스가 점유 중', flush=True)
        sys.exit(1)
    print(f'')
    print(f'  [OK] Logen x Cafe24 server started!')
    print(f'  Open: http://localhost:{PORT}/')
    print(f'  JWT 자동 갱신: 6시간마다 (백그라운드)')
    print(f'  카페24 토큰 자동 갱신: 90분마다 (백그라운드)')
    print(f'  (종료: Ctrl+C)')
    print(f'')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('서버 종료.')
