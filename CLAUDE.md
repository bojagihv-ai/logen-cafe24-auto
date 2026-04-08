# CLAUDE.md — 로젠 x 카페24 송장 매니저 (새 채팅 인수인계용)

> 이 파일은 새 채팅창에서 작업을 이어갈 때 Claude가 가장 먼저 읽어야 하는 파일입니다.
> 마지막 업데이트: 2026-04-08

---

## 1. 프로젝트 한줄 요약

카페24 쇼핑몰 미발송 주문을 조회하고 → 로젠택배 WEB-EDI에 자동 등록하는 로컬 데스크톱 앱.
전통공예품(보자기, 주머니 등) 제조 중소기업 운영자가 매일 쓰는 업무 자동화 도구.

---

## 2. 파일 구조 (전체)

```
C:\Users\kua\Desktop\projects\kuaai\kuaai-main\
├── run_server.py               # 로컬 Python 서버 (포트 8080) ← 핵심
├── logen-cafe24.html           # 메인 UI
├── logen-cafe24.js             # 프론트엔드 로직 전체
├── logen-cafe24.css            # 스타일
├── logen_get_token.py          # Playwright로 로젠 JWT 자동 획득
├── lc_config.json              # 설정 영구 저장 (gitignore됨, 자동 생성)
├── logen_icon.ico              # 바탕화면 바로가기 아이콘 (gitignore됨)
├── 로젠카페24_실행.bat          # 더블클릭 실행 파일
├── CLAUDE.md                   # 이 파일
├── 프로그램_개발과정및참고할점.txt  # 시행착오 총정리 문서
├── .gitignore
├── logen-relay-extension/      # Chrome 확장 (JWT 추출 보조, 현재 미사용)
│   ├── manifest.json
│   └── content.js
└── .playwright_logen/          # Playwright 세션 저장소 (gitignore됨)
```

**GitHub 레포**: https://github.com/bojagihv-ai/logen-cafe24-auto

---

## 3. 실행 방법

```
바탕화면 "로젠카페24 실행.lnk" 더블클릭
```

또는 수동:
```bash
cd C:\Users\kua\Desktop\projects\kuaai\kuaai-main
python -X utf8 run_server.py
```

브라우저 접속: http://localhost:8080

bat 파일은 실행 전 포트 8080 기존 프로세스 자동 종료 후 재시작함.

---

## 4. 핵심 기술 구조

### 전체 흐름 다이어그램

```
브라우저 (logen-cafe24.html/js)
        ↕ fetch (CORS 우회)
로컬 Python 서버 (run_server.py, 포트 8080)  ← 프록시 + 설정관리 + JWT보관
        ↕ HTTP POST
카페24 REST API  ← 주문 조회 / 송장번호 업로드
        ↕ HTTP POST
로젠 내부 REST API  ← 운송장 자동 등록 (4단계)
```

### 왜 로컬 Python 서버가 필요한가?
1. CORS 우회: 브라우저에서 외부 API 직접 호출 불가 → 서버가 프록시
2. JWT 보관: 메모리 + lc_config.json 영속화
3. 설정 관리: /api/config 엔드포인트
4. 자동화 스크립트 실행: subprocess로 Playwright 호출

---

## 5. 로젠 JWT 인증

### JWT가 어디에 있나?
- logis.ilogen.com 로그인 후 `document.body.id`에 JWT 자동 저장됨
- 로젠 자체 JS (BASE_PC_V2.js)가 세팅함

### JWT 획득 방법 (자동)
`logen_get_token.py` → Playwright로 `.playwright_logen/` 세션 사용 → 로젠 로그인 → JWT 추출 → `/store-logen-token` POST

```bash
python -X utf8 logen_get_token.py           # 브라우저 창 표시 (최초 수동 로그인용)
python -X utf8 logen_get_token.py --headless # 백그라운드 (자동 갱신용)
```

### JWT 획득 방법 (수동 - Claude in Chrome MCP 사용)
```
1. 탭 확인: mcp__Claude_in_Chrome__tabs_context_mcp
2. logis.ilogen.com 탭에서 JS 실행: mcp__Claude_in_Chrome__javascript_tool
3. document.getElementById('user.pw').value.length 확인 (자동완성 여부)
4. 0이 아니면 → basicLogin() 호출
5. 로그인 완료 후 document.body.id 로 JWT 확인
6. 아래 fetch로 서버에 저장:
```
```javascript
fetch('http://localhost:8080/store-logen-token', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    token: document.body.id,
    pageId: 'lrm01f0050',
    userInfo: '',
    empId: '33253401'
  })
})
```

### JWT 영속성 & 자동 갱신
- `/store-logen-token` 수신 시 → 메모리(`_logen_session`) + `lc_config.json` 동시 저장
- 서버 시작 시 → `lc_config.json`에서 JWT 자동 복원
- **6시간마다 자동 갱신**: `threading.Timer` → `logen_get_token.py --headless` 자동 실행
- 서버 시작 10초 후 첫 갱신 트리거

---

## 6. 로젠 등록 API (4단계)

Base URL: `https://logis.ilogen.com`
인증 헤더: `x-token: {JWT}`, `x-pageId: lrm01f0050`

```
① POST /lrm01b0050/saveResv       → 운송장 예약
② POST /lrm01b0050/getResvList    → 예약 목록 조회 (seq 번호 추출)
③ POST /lrm01b0050/getSlipNoSave  → 운송장 번호 채번
④ POST /lrm01b0050/updateSlipNo   → 번호 확정 (이 단계에서 실제 등록 완료)
```

모두 `run_server.py`의 `/api/logen` 엔드포인트를 통해 중계됨.

---

## 7. 카페24 API

```
GET  /api/v2/admin/orders?order_status=N20&embed=items,receivers  → 미발송 주문 조회
POST /api/v2/admin/orders/{id}/shipments                          → 송장번호 등록
POST /api/v2/oauth/token (grant_type=refresh_token)               → 토큰 갱신
```

API 버전 헤더: `X-Cafe24-Api-Version: 2025-12-01`
프록시: `POST /api/cafe24` (run_server.py가 중계)

### 필드 매핑 (카페24 응답 → 로젠 등록 파라미터)
```
receiver.name             → rcvCustNm        수하인명
receiver.cellphone        → rcvCellNo        휴대폰 (우선)
receiver.phone            → rcvTelno         일반전화
receiver.address1         → rcvCustAddr      주소 (도로명)        ← address1만!
receiver.address2         → rcvCustAddrDTL   상세주소 (동/호수)   ← address2만!
receiver.zipcode          → rcvZipCd         우편번호
receiver.shipping_message → dlvMsg           배송메시지
items[0].product_name     → goods            상품명
items[0].quantity         → goodsCnt         수량
```

**중요**: address1과 address2는 반드시 분리해서 각각 다른 필드로 보내야 함.
합치거나 누락하면 로젠에 주소가 깨지거나 빠짐.

### normalizeOrder() 핵심 코드 (logen-cafe24.js)
```javascript
receiverAddr:       receiver.address1 || '',
receiverAddrDetail: receiver.address2 || '',
receiverTel:        receiver.cellphone || receiver.phone || '',
shippingMessage:    receiver.shipping_message || '',
```

---

## 8. 발신자 기본 정보 (하드코딩)

run_server.py의 `SENDER_DEFAULTS`:
```
이름:       신화사
전화:       031-411-6738
주소:       경기 안산시 상록구 동막길 69-9 (장상동 302)
우편번호:   15201
거래처코드: 33253401
집하지점:   332 (동안산)
```

---

## 9. 설정 저장 구조

**lc_config.json** (자동 생성, gitignore됨):
```json
{
  "cafe24": {
    "mallId": "...",
    "clientId": "...",
    "clientSecret": "...",
    "accessToken": "...",
    "refreshToken": "..."
  },
  "logen": {
    "userId": "...",
    "password": "..."
  },
  "logen_token": "Bearer eyJ...",
  "logen_emp_id": "33253401"
}
```

**설정 로딩 흐름**:
1. `run_server.py` 시작 시 `lc_config.json` 읽어서 JWT 복원
2. 브라우저에서 `http://localhost:8080` 접속 시
3. `init()` → `loadConfigFromServer()` (`GET /api/config`) → `appState` 복원 → DOM 반영
4. 설정 저장 시 `saveConfigToServer()` (`POST /api/config`) + localStorage 동시 저장

---

## 10. 완성된 기능 목록

- [x] 카페24 미발송 주문 자동 조회
- [x] 로젠택배 운송장 자동 등록 (전화번호, 주소, 상세주소, 배송메시지 모두 정상)
- [x] JWT 자동 획득 (Playwright persistent session)
- [x] JWT 메모리 + 디스크 영속화 (서버 재시작 후 자동 복원)
- [x] 3시간마다 JWT 자동 갱신 + 실패 시 30분 retry×3 (백그라운드 threading.Timer)
- [x] 설정 영구 저장 (lc_config.json, 브라우저 무관)
- [x] 바탕화면 바로가기 + 로젠 로고 아이콘
- [x] 배송 조회 기능 (tracker.delivery API)
- [x] GitHub 레포 공개 (bojagihv-ai/logen-cafe24-auto)
- [x] 시행착오 총정리 문서 (프로그램_개발과정및참고할점.txt)

---

## 11. 다음 작업 후보 (아직 미구현)

| 우선순위 | 기능 | 설명 |
|---------|------|------|
| ① 높음 | 카페24 송장번호 자동 업로드 | 로젠 등록 완료 후 카페24 `/shipments` API 자동 호출. `update_shipping()` 함수는 이미 구현됨, 로젠 등록 콜백에 연결만 하면 됨 |
| ② 높음 | 원클릭 풀 자동화 | 주문조회 → 로젠등록 → 카페24 송장업로드 버튼 하나로 |
| ③ 중간 | 중복 등록 방지 | 이미 로젠에 등록된 주문은 스킵 (운송장번호 체크) |
| ④ 낮음 | 카카오톡 알림 | 처리 완료 시 사장님 카카오로 알림 |

---

## 12. 알려진 이슈 & 해결법

### "로젠 로그인 필요" 오류
원인: JWT 만료 또는 서버 첫 시작 시 lc_config.json 없는 경우
해결: 이제 자동 복원됨. 그래도 안 되면 logen_get_token.py 수동 실행:
```bash
python -X utf8 logen_get_token.py
```
브라우저 창에서 로그인 → JWT 자동 저장.

### 서버 여러 개 뜨는 문제
원인: 개발 중 서버를 여러 번 재시작하면 구 프로세스가 포트 8080 점유 유지
증상: 새 코드로 바꿨는데 동작이 안 바뀜, /api/config 404 반환
해결:
```powershell
Get-Process python | Stop-Process -Force
Start-Process python -ArgumentList "-X utf8 run_server.py" -WorkingDirectory "C:\Users\kua\Desktop\projects\kuaai\kuaai-main"
```
bat 파일에 이미 포트 8080 자동 정리 로직 포함됨.

### logis.ilogen.com에서 MCP computer 도구 타임아웃
원인: 해당 사이트에서 screenshot/click MCP 도구가 타임아웃됨
해결: `mcp__Claude_in_Chrome__javascript_tool` 로 JS 직접 실행으로 대체:
```javascript
basicLogin()           // 로그인 함수 직접 호출
document.body.id       // JWT 확인
document.querySelector('.swal-button').click()  // swal 팝업 닫기
```

### Chrome 자동완성 비밀번호 JS에서 못 읽는 문제
Chrome 보안 정책: JS로 password 필드 value 읽으면 빈 문자열 반환
해결: `document.getElementById('user.pw').value.length` 로 길이만 확인
→ 0이 아니면 자동완성 되어있다고 판단 → basicLogin() 호출

### Playwright 첫 실행 시 수동 로그인 필요
`.playwright_logen/` 폴더 없으면 브라우저 창 뜸 → 한 번만 수동 로그인
이후 세션 저장되어 headless 자동 실행 가능.

### Python 서버 작업 디렉토리 문제
run_server.py 내 파일 경로는 항상 `__file__` 기준 절대경로 사용:
```python
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, 'lc_config.json')
```

---

## 13. 개발 과정에서 찾은 핵심 원칙

1. **브라우저 자동화 vs API 직접 호출**: 항상 F12 Network 탭으로 내부 API 먼저 탐색. 있으면 API 직접 호출 (속도 10~100배 차이)

2. **JWT/토큰 관리**: 메모리 + 파일 저장 + 자동 갱신 3단계 설계 필수

3. **필드 매핑**: 추측 금지. 실제 API 응답 JSON을 console.log 출력해서 필드명 직접 확인

4. **MCP Chrome 자동화**: computer(screenshot/click) 보다 javascript_tool 우선. 가능하면 사이트 자체 JS 함수 직접 호출

5. **설정 저장**: localStorage 단독 사용 금지. 서버 파일 기반 저장이 안전

6. **로컬 서버**: 개발 시 bat 파일에 기존 포트 정리 로직 포함 필수

자세한 내용: `프로그램_개발과정및참고할점.txt` 참조

---

## 14. GitHub & 배포

```
레포: https://github.com/bojagihv-ai/logen-cafe24-auto
계정: bojagihv-ai
브랜치: main
```

새 기능 커밋 & 푸시:
```bash
cd "C:\Users\kua\Desktop\projects\kuaai\kuaai-main"
git add -p                          # 변경사항 확인
git commit -m "기능 설명"
git push origin main
```

gitignore 항목 (절대 커밋하면 안 됨):
- lc_config.json (카페24 API 키, 로젠 계정 포함)
- .playwright_logen/ (로그인 세션)
- logen_icon.ico
- __pycache__/

---

## 15. 새 채팅창에서 작업 시작하는 법

1. 이 파일(CLAUDE.md) 먼저 읽을 것
2. 현재 실행 상태 확인:
   ```bash
   curl http://localhost:8080/api/health
   ```
3. 필요하면 서버 재시작:
   ```
   바탕화면 "로젠카페24 실행.lnk" 더블클릭
   ```
4. MCP Chrome 탭 확인:
   ```
   mcp__Claude_in_Chrome__tabs_context_mcp
   ```
5. 다음 작업은 위 11번 "다음 작업 후보" 참고

---

## 16. 현재 탭 구성 (작업 중 브라우저)

보통 Claude in Chrome MCP에 2개 탭 열려있음:
- `logis.ilogen.com/common/html/main.html` — 로젠 WEB-EDI (JWT 소스)
- `localhost:8080` — 로젠 x 카페24 송장 매니저 UI

필요 시 탭 추가: `mcp__Claude_in_Chrome__tabs_create_mcp`
