# CLAUDE.md — 로젠 x 카페24 송장 매니저

## 프로젝트 목적
카페24 쇼핑몰 미발송 주문 → 로젠택배 WEB-EDI 자동 등록 → 카페24 송장번호 업로드
전통공예품(보자기, 주머니 등) 중소기업 운영자가 매일 사용하는 업무 자동화 도구.

---

## 파일 구조

```
kuaai-main/
├── run_server.py           # 로컬 Python 서버 (포트 8080) - 핵심
├── logen-cafe24.html       # 메인 UI (브라우저에서 열림)
├── logen-cafe24.js         # 프론트엔드 로직
├── logen-cafe24.css        # 스타일
├── logen_get_token.py      # 로젠 JWT 자동 획득 (Playwright)
├── lc_config.json          # 설정 영구 저장 파일 (자동 생성)
├── logen_icon.ico          # 바탕화면 아이콘 (로젠 로고)
├── 로젠카페24_실행.bat      # 바탕화면 바로가기용 실행 파일
├── logen-relay-extension/  # Chrome 확장 (JWT PUSH 방식, 보조용)
│   ├── manifest.json
│   └── content.js
└── .playwright_logen/      # Playwright 세션 저장 (로젠 로그인 유지)
```

---

## 실행 방법

```
바탕화면 "로젠카페24 실행.lnk" 더블클릭
또는:
cd C:\Users\kua\Desktop\projects\kuaai\kuaai-main
python -X utf8 run_server.py
```

브라우저: http://localhost:8080

---

## 핵심 기술 구조

### JWT 획득 방식
- `logis.ilogen.com` 로그인 후 `document.body.id`에 JWT 저장됨 (로젠 BASE_PC_V2.js가 설정)
- Claude in Chrome MCP로 Logen 탭에서 JS 실행 → JWT 추출 → localhost:8080/store-logen-token에 POST
- 또는 `logen_get_token.py` (Playwright)로 자동 획득

### JWT 영속성
- `/store-logen-token` 수신 시 메모리(`_logen_session`) + 디스크(`lc_config.json`) 동시 저장
- 서버 시작 시 `lc_config.json`에서 JWT 자동 복원
- **6시간마다 자동 갱신**: `run_server.py` 내부 threading.Timer → `logen_get_token.py --headless` 실행

### 로젠 등록 API 4단계 흐름
```
① POST /lrm01b0050/saveResv      → 운송장 예약
② POST /lrm01b0050/getResvList   → 예약 확인 (seq 추출)
③ POST /lrm01b0050/getSlipNoSave → 운송장 번호 채번
④ POST /lrm01b0050/updateSlipNo  → 번호 확정
```
Base URL: `https://logis.ilogen.com`
인증: 헤더 `x-token: {JWT}`, `x-pageId: lrm01f0050`

### 설정 저장
- 서버: `GET/POST /api/config` → `lc_config.json` 읽기/쓰기
- 프론트: 시작 시 `/api/config` fetch → appState 복원 → DOM 반영
- 저장 시 localStorage + 서버 파일 동시 저장 (어떤 브라우저든 동일 설정)

---

## 카페24 API

```
GET  /api/v2/admin/orders?order_status=N20&embed=items,receivers  → 미발송 주문 조회
POST /api/v2/admin/orders/{id}/shipments                          → 송장번호 등록
POST /api/v2/oauth/token  (grant_type=refresh_token)              → 토큰 갱신
```
API 버전: `X-Cafe24-Api-Version: 2025-12-01`
프록시: `POST /api/cafe24` (run_server.py가 중계)

### 주문 데이터 필드 매핑 (카페24 → 로젠)
```javascript
receiver.name        → rcvCustNm     (수하인명)
receiver.cellphone   → rcvCellNo*    (휴대폰)
receiver.phone       → rcvTelno*     (전화)
receiver.address1    → rcvCustAddr   (주소)
receiver.address2    → rcvCustAddrDTL (상세주소)  ← address1+2 반드시 분리!
receiver.zipcode     → rcvZipCd
receiver.shipping_message → dlvMsg  (배송메시지)
```

---

## 현재 상태 (2026-03-31)

### 완성된 기능
- [x] 카페24 미발송 주문 조회
- [x] 로젠 자동 등록 (전화번호, 주소, 상세주소, 배송메시지 모두 정상)
- [x] JWT 자동 획득 (Playwright persistent session)
- [x] JWT 디스크 영속화 + 서버 재시작 후 자동 복원
- [x] 6시간마다 JWT 자동 갱신 (백그라운드 스레드)
- [x] 설정 영구 저장 (lc_config.json)
- [x] 바탕화면 바로가기 (로젠 로고 아이콘)
- [x] 배송 조회 (tracker.delivery API)

### 다음 작업 후보
- [ ] **①** 로젠 등록 완료 후 카페24에 송장번호 자동 업로드 (update_shipping 이미 구현됨, 연결만 하면 됨)
- [ ] **②** 원클릭 풀 자동화 (주문조회 → 로젠등록 → 카페24 업로드 한 번에)
- [ ] **③** 중복 등록 방지 (이미 등록된 주문 스킵)
- [ ] **④** 카카오톡 알림 (처리 완료 시)

---

## 알려진 이슈 & 해결책

### "로젠 로그인 필요" 오류
서버 재시작으로 JWT 날아간 경우.
→ 해결: 이제 lc_config.json에 저장되므로 자동 복원됨.
→ 수동: Claude in Chrome MCP로 logis.ilogen.com 탭에서:
```javascript
fetch('http://localhost:8080/store-logen-token', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({token: document.body.id, pageId: 'lrm01f0050', userInfo: '', empId: '33253401'})
})
```

### 서버 여러 개 뜨는 문제
배트 파일이 포트 8080 기존 프로세스 자동 종료 후 재시작하도록 수정됨.
PowerShell로 강제 종료: `Get-Process python | Stop-Process -Force`

### Playwright 첫 실행
`.playwright_logen/` 에 세션 없으면 브라우저 창 뜸 → 수동 로그인 1회 → 이후 자동.
`--headless` 플래그로 백그라운드 실행 가능.

### Claude in Chrome computer 도구 타임아웃
logis.ilogen.com에서 screenshot/click 도구가 타임아웃됨.
→ `javascript_tool`로 직접 DOM 조작으로 해결:
```javascript
basicLogin()  // 로그인 함수 직접 호출
document.body.id  // JWT 확인
```

---

## 발신자 기본 정보 (run_server.py 하드코딩 기본값)
- 이름: 신화사
- 전화: 031-411-6738
- 주소: 경기 안산시 상록구 동막길 69-9 (장상동 302)
- 우편번호: 15201
- 거래처코드: 33253401
- 집하지점: 332 (동안산)

---

## MCP 도구 사용법 (Claude in Chrome)

### 로젠 탭에서 JWT 뽑기
```
탭 ID 확인: mcp__Claude_in_Chrome__tabs_context_mcp
JS 실행: mcp__Claude_in_Chrome__javascript_tool (action: javascript_exec)
```

### 로젠 로그인 자동화 순서
1. logis.ilogen.com으로 이동
2. `document.getElementById('user.pw').value.length` 확인 (자동완성 여부)
3. 값 있으면 → `basicLogin()` 호출
4. main.html 이동 후 `document.body.id` 확인 (JWT 획득)
5. `/store-logen-token`에 POST
