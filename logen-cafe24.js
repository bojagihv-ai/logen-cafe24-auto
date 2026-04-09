// ============================================================
// 로젠 x 카페24 송장 매니저 - Core Logic
// ============================================================

// --- State ---
const appState = {
  cafe24: {
    mallId: localStorage.getItem('lc_cafe24_mall_id') || '',
    clientId: localStorage.getItem('lc_cafe24_client_id') || '',
    clientSecret: localStorage.getItem('lc_cafe24_client_secret') || '',
    token: localStorage.getItem('lc_cafe24_token') || '',
    refreshToken: localStorage.getItem('lc_cafe24_refresh_token') || '',
    tokenExpiresAt: localStorage.getItem('lc_cafe24_token_expires_at') || '',
  },
  logen: {
    customerCode: localStorage.getItem('lc_logen_customer_code') || '',
    senderName: localStorage.getItem('lc_logen_sender_name') || '',
    senderTel: localStorage.getItem('lc_logen_sender_tel') || '',
    senderAddr: localStorage.getItem('lc_logen_sender_addr') || '',
    senderZipcode: localStorage.getItem('lc_logen_sender_zipcode') || '',
    userId: localStorage.getItem('lc_logen_user_id') || '',
    password: localStorage.getItem('lc_logen_password') || '',
  },
  orders: [],           // 카페24에서 가져온 미발송 주문
  selectedOrders: [],    // 송장 발급을 위해 선택된 주문
  invoiceItems: [],      // 송장 발급 대상 (주문 + 송장번호)
  uploadItems: [],       // 카페24 업로드 대상
  trackingItems: [],     // 배송 조회 대상
};

// --- DOM References ---
const dom = {};

function initDom() {
  // Settings
  dom.cafe24MallId = document.getElementById('cafe24-mall-id');
  dom.cafe24ClientId = document.getElementById('cafe24-client-id');
  dom.cafe24ClientSecret = document.getElementById('cafe24-client-secret');
  dom.cafe24Token = document.getElementById('cafe24-token');
  dom.cafe24RefreshToken = document.getElementById('cafe24-refresh-token');
  dom.saveCafe24Btn = document.getElementById('save-cafe24-btn');
  dom.cafe24Status = document.getElementById('cafe24-status');

  dom.logenCustomerCode = document.getElementById('logen-customer-code');
  dom.logenSenderName = document.getElementById('logen-sender-name');
  dom.logenSenderTel = document.getElementById('logen-sender-tel');
  dom.logenSenderAddr = document.getElementById('logen-sender-addr');
  dom.logenSenderZipcode = document.getElementById('logen-sender-zipcode');
  dom.logenUserId = document.getElementById('logen-user-id');
  dom.logenPassword = document.getElementById('logen-password');
  dom.saveLogenBtn = document.getElementById('save-logen-btn');
  dom.logenStatus = document.getElementById('logen-status');

  // Orders
  dom.orderDateFrom = document.getElementById('order-date-from');
  dom.orderDateTo = document.getElementById('order-date-to');
  dom.fetchOrdersBtn = document.getElementById('fetch-orders-btn');
  dom.ordersTbody = document.getElementById('orders-tbody');
  dom.selectAllOrders = document.getElementById('select-all-orders');
  dom.orderCountBadge = document.getElementById('order-count-badge');
  dom.selectedCount = document.getElementById('selected-count');
  dom.exportSelectedBtn = document.getElementById('export-selected-btn');

  // Invoice
  dom.invoiceTbody = document.getElementById('invoice-tbody');
  dom.invoiceCountBadge = document.getElementById('invoice-count-badge');
  dom.downloadLogenExcel = document.getElementById('download-logen-excel');
  dom.generateInvoicesBtn = document.getElementById('generate-invoices-btn');
  dom.autoRegisterLogenBtn = document.getElementById('auto-register-logen-btn');
  dom.logenAutoStatus = document.getElementById('logen-auto-status');
  dom.loadOrdersInvoiceBtn = document.getElementById('load-orders-invoice-btn');
  dom.loadLogenPrintedBtn = document.getElementById('load-logen-printed-btn');
  dom.reauthCafe24Btn = document.getElementById('reauth-cafe24-btn');
  dom.reauthPanel = document.getElementById('reauth-panel');
  dom.oauthCodeInput = document.getElementById('oauth-code-input');
  dom.exchangeCodeBtn = document.getElementById('exchange-code-btn');

  // Upload
  dom.invoiceFileDrop = document.getElementById('invoice-file-drop');
  dom.invoiceFileInput = document.getElementById('invoice-file-input');
  dom.manualInvoiceInput = document.getElementById('manual-invoice-input');
  dom.parseManualBtn = document.getElementById('parse-manual-btn');
  dom.uploadTbody = document.getElementById('upload-tbody');
  dom.selectAllUpload = document.getElementById('select-all-upload');
  dom.uploadToCafe24Btn = document.getElementById('upload-to-cafe24-btn');
  dom.uploadProgress = document.getElementById('upload-progress');
  dom.uploadCountBadge = document.getElementById('upload-count-badge');
  dom.uploadDateFrom = document.getElementById('upload-date-from');
  dom.uploadDateTo = document.getElementById('upload-date-to');
  dom.loadLogenPrintedUploadBtn = document.getElementById('load-logen-printed-upload-btn');
  dom.logenPrintedStatus = document.getElementById('logen-printed-status');
  dom.presetTodayBtn = document.getElementById('preset-today-btn');
  dom.presetYesterdayBtn = document.getElementById('preset-yesterday-btn');
  dom.presetWeekBtn = document.getElementById('preset-week-btn');
  dom.uploadProgressBar = document.getElementById('upload-progress-bar');
  dom.uploadProgressText = document.getElementById('upload-progress-text');

  // Tracking
  dom.trackingInput = document.getElementById('tracking-input');
  dom.trackSingleBtn = document.getElementById('track-single-btn');
  dom.trackAllBtn = document.getElementById('track-all-btn');
  dom.trackingTbody = document.getElementById('tracking-tbody');
  dom.trackingModal = document.getElementById('tracking-modal');
  dom.closeModal = document.getElementById('close-modal');
  dom.trackingDetail = document.getElementById('tracking-detail');

  // Global
  dom.loadingOverlay = document.getElementById('loading-overlay');
  dom.loadingText = document.getElementById('loading-text');
  dom.toastContainer = document.getElementById('toast-container');
}

// --- 세션/로컬 스토리지 영속화 ---
function saveSessionData() {
  try {
    sessionStorage.setItem('lc_orders', JSON.stringify(appState.orders));
    sessionStorage.setItem('lc_invoiceItems', JSON.stringify(appState.invoiceItems));
    sessionStorage.setItem('lc_uploadItems', JSON.stringify(appState.uploadItems));
  } catch(e) {}
}

function restoreSessionData() {
  try {
    const orders = JSON.parse(sessionStorage.getItem('lc_orders') || '[]');
    if (orders.length > 0) {
      appState.orders = orders;
      renderOrdersTable(orders);
      dom.orderCountBadge.textContent = `${orders.length}건`;
    }
    const invoiceItems = JSON.parse(sessionStorage.getItem('lc_invoiceItems') || '[]');
    if (invoiceItems.length > 0) {
      appState.invoiceItems = invoiceItems;
      renderInvoiceTable();
    }
    const uploadItems = JSON.parse(sessionStorage.getItem('lc_uploadItems') || '[]');
    if (uploadItems.length > 0) {
      appState.uploadItems = uploadItems;
      renderUploadTable();
    }
  } catch(e) {}
}

// --- Init ---
async function init() {
  initDom();
  initTabs();
  await loadConfigFromServer();
  loadSettings();
  initEventListeners();
  setDefaultDates();
  updateStatusIndicators();
  restoreSessionData();
}

async function loadConfigFromServer() {
  try {
    const resp = await fetch('/api/config');
    if (!resp.ok) return;
    const cfg = await resp.json();
    if (cfg.cafe24) {
      Object.assign(appState.cafe24, cfg.cafe24);
      // token/accessToken 동기화 (token 우선)
      const t = appState.cafe24.token || appState.cafe24.accessToken || '';
      appState.cafe24.token = t;
      appState.cafe24.accessToken = t;
    }
    if (cfg.logen)  Object.assign(appState.logen,  cfg.logen);
  } catch (e) {
    // 서버 설정 없으면 localStorage fallback 유지
  }
}

async function saveConfigToServer() {
  try {
    // token/accessToken 항상 동기화 (서버 auto_refresh가 token만 갱신해도 엇나가지 않도록)
    const t = appState.cafe24.token || appState.cafe24.accessToken || '';
    appState.cafe24.token = t;
    appState.cafe24.accessToken = t;
    // 기존 설정 읽어서 cafe24/logen만 덮어쓰기 (autoprint 등 다른 설정 보존)
    const existing = await fetch('/api/config').then(r => r.ok ? r.json() : {}).catch(() => ({}));
    existing.cafe24 = appState.cafe24;
    existing.logen = appState.logen;
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(existing),
    });
  } catch (e) { /* 무시 */ }
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

function loadSettings() {
  dom.cafe24MallId.value = appState.cafe24.mallId;
  dom.cafe24ClientId.value = appState.cafe24.clientId;
  dom.cafe24ClientSecret.value = appState.cafe24.clientSecret;
  dom.cafe24Token.value = appState.cafe24.token;
  dom.cafe24RefreshToken.value = appState.cafe24.refreshToken;
  dom.logenCustomerCode.value = appState.logen.customerCode;
  dom.logenSenderName.value = appState.logen.senderName;
  dom.logenSenderTel.value = appState.logen.senderTel;
  dom.logenSenderAddr.value = appState.logen.senderAddr;
  dom.logenSenderZipcode.value = appState.logen.senderZipcode;
  if (dom.logenUserId) dom.logenUserId.value = appState.logen.userId || '';
  if (dom.logenPassword) dom.logenPassword.value = appState.logen.password || '';
}

function setDefaultDates() {
  const saved_from = localStorage.getItem('lc_date_from');
  const saved_to = localStorage.getItem('lc_date_to');
  if (saved_from && saved_to) {
    dom.orderDateFrom.value = saved_from;
    dom.orderDateTo.value = saved_to;
  } else {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    dom.orderDateTo.value = formatDate(today);
    dom.orderDateFrom.value = formatDate(weekAgo);
  }
  // 날짜 변경 시 자동 저장
  dom.orderDateFrom.addEventListener('change', () => localStorage.setItem('lc_date_from', dom.orderDateFrom.value));
  dom.orderDateTo.addEventListener('change', () => localStorage.setItem('lc_date_to', dom.orderDateTo.value));
  // 업로드 탭 날짜 - 기본값 오늘 (로젠 출력완료는 당일 조회가 일반적)
  const todayStr = formatDate(new Date());
  const savedUploadFrom = localStorage.getItem('lc_upload_date_from') || todayStr;
  const savedUploadTo   = localStorage.getItem('lc_upload_date_to')   || todayStr;
  if (dom.uploadDateFrom) dom.uploadDateFrom.value = savedUploadFrom;
  if (dom.uploadDateTo)   dom.uploadDateTo.value   = savedUploadTo;
  if (dom.uploadDateFrom) dom.uploadDateFrom.addEventListener('change', () => {
    localStorage.setItem('lc_upload_date_from', dom.uploadDateFrom.value);
  });
  if (dom.uploadDateTo) dom.uploadDateTo.addEventListener('change', () => {
    localStorage.setItem('lc_upload_date_to', dom.uploadDateTo.value);
  });
}

function initEventListeners() {
  // Settings save
  dom.saveCafe24Btn.addEventListener('click', saveCafe24Settings);
  dom.saveLogenBtn.addEventListener('click', saveLogenSettings);
  dom.reauthCafe24Btn.addEventListener('click', openCafe24ReauthWindow);
  dom.exchangeCodeBtn.addEventListener('click', exchangeCafe24Code);

  // Orders
  dom.fetchOrdersBtn.addEventListener('click', fetchOrders);
  dom.selectAllOrders.addEventListener('change', toggleSelectAllOrders);
  dom.exportSelectedBtn.addEventListener('click', exportToInvoiceTab);

  // Invoice
  dom.downloadLogenExcel.addEventListener('click', downloadLogenEDI);
  dom.generateInvoicesBtn.addEventListener('click', generateTestInvoices);
  dom.autoRegisterLogenBtn.addEventListener('click', autoRegisterLogen);
  if (dom.loadOrdersInvoiceBtn) dom.loadOrdersInvoiceBtn.addEventListener('click', loadOrdersToInvoiceTab);
  if (dom.loadLogenPrintedBtn) dom.loadLogenPrintedBtn.addEventListener('click', loadLogenPrinted);

  // Upload
  dom.invoiceFileDrop.addEventListener('click', () => dom.invoiceFileInput.click());
  dom.invoiceFileDrop.addEventListener('dragover', e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary-color)'; });
  dom.invoiceFileDrop.addEventListener('dragleave', e => { e.currentTarget.style.borderColor = ''; });
  dom.invoiceFileDrop.addEventListener('drop', handleInvoiceFileDrop);
  dom.invoiceFileInput.addEventListener('change', handleInvoiceFileSelect);
  dom.parseManualBtn.addEventListener('click', parseManualInput);
  dom.selectAllUpload.addEventListener('change', toggleSelectAllUpload);
  dom.uploadToCafe24Btn.addEventListener('click', uploadToCafe24);
  if (dom.loadLogenPrintedUploadBtn) dom.loadLogenPrintedUploadBtn.addEventListener('click', loadLogenPrintedToUpload);

  // 날짜 프리셋 버튼
  if (dom.presetTodayBtn) dom.presetTodayBtn.addEventListener('click', () => {
    const t = formatDate(new Date());
    dom.uploadDateFrom.value = t; dom.uploadDateTo.value = t;
    localStorage.setItem('lc_upload_date_from', t); localStorage.setItem('lc_upload_date_to', t);
  });
  if (dom.presetYesterdayBtn) dom.presetYesterdayBtn.addEventListener('click', () => {
    const y = formatDate(new Date(Date.now() - 86400000));
    dom.uploadDateFrom.value = y; dom.uploadDateTo.value = y;
    localStorage.setItem('lc_upload_date_from', y); localStorage.setItem('lc_upload_date_to', y);
  });
  if (dom.presetWeekBtn) dom.presetWeekBtn.addEventListener('click', () => {
    const to = formatDate(new Date());
    const fr = formatDate(new Date(Date.now() - 6*86400000));
    dom.uploadDateFrom.value = fr; dom.uploadDateTo.value = to;
    localStorage.setItem('lc_upload_date_from', fr); localStorage.setItem('lc_upload_date_to', to);
  });

  // Tracking
  dom.trackSingleBtn.addEventListener('click', trackSingle);
  dom.trackAllBtn.addEventListener('click', trackAll);
  dom.closeModal.addEventListener('click', () => dom.trackingModal.style.display = 'none');
  dom.trackingModal.addEventListener('click', e => { if (e.target === dom.trackingModal) dom.trackingModal.style.display = 'none'; });
}

// ============================================================
// SETTINGS
// ============================================================

function openCafe24ReauthWindow() {
  const mallId   = appState.cafe24.mallId;
  const clientId = appState.cafe24.clientId;
  if (!mallId || !clientId) {
    showToast('Mall ID와 Client ID를 먼저 설정하세요.', 'error');
    return;
  }
  const authUrl = `https://${mallId}.cafe24api.com/api/v2/oauth/authorize`
    + `?response_type=code`
    + `&client_id=${encodeURIComponent(clientId)}`
    + `&state=logen_cafe24_reauth`
    + `&redirect_uri=${encodeURIComponent('https://03030.co.kr/')}`
    + `&scope=mall.read_order,mall.read_shipping,mall.write_shipping,mall.write_order`;
  window.open(authUrl, '_blank', 'width=600,height=500');
  dom.reauthPanel.style.display = 'block';
  dom.oauthCodeInput.value = '';
  dom.oauthCodeInput.focus();
  showToast('새 창에서 로그인 후 주소창의 code= 값을 복사하세요.', 'info');
}

async function exchangeCafe24Code() {
  const code = dom.oauthCodeInput.value.trim();
  if (!code) { showToast('코드를 입력하세요.', 'error'); return; }
  showLoading('카페24 토큰 갱신 중...');
  try {
    const resp = await fetch(API_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'exchange_code',
        mallId: appState.cafe24.mallId,
        clientId: appState.cafe24.clientId,
        clientSecret: appState.cafe24.clientSecret,
        code,
        redirectUri: 'https://03030.co.kr/',
      }),
    });
    const data = await resp.json();
    if (data.access_token) {
      appState.cafe24.token = data.access_token;
      appState.cafe24.refreshToken = data.refresh_token || '';
      appState.cafe24.tokenExpiresAt = data.expires_at || '';
      localStorage.setItem('lc_cafe24_token', data.access_token);
      localStorage.setItem('lc_cafe24_refresh_token', data.refresh_token || '');
      if (data.expires_at) localStorage.setItem('lc_cafe24_token_expires_at', data.expires_at);
      if (dom.cafe24Token) dom.cafe24Token.value = data.access_token;
      if (dom.cafe24RefreshToken) dom.cafe24RefreshToken.value = data.refresh_token || '';
      appState.cafe24.accessToken = data.access_token;
      dom.reauthPanel.style.display = 'none';
      dom.oauthCodeInput.value = '';
      saveConfigToServer();
      updateStatusIndicators();
      showToast(`✅ 토큰 갱신 완료! 만료: ${data.expires_at || ''}`, 'success');
    } else {
      showToast('갱신 실패: ' + (data.error_description || data.error || JSON.stringify(data)), 'error');
    }
  } catch (err) {
    showToast('갱신 오류: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
}

function saveCafe24Settings() {
  appState.cafe24.mallId = dom.cafe24MallId.value.trim();
  appState.cafe24.clientId = dom.cafe24ClientId.value.trim();
  appState.cafe24.clientSecret = dom.cafe24ClientSecret.value.trim();
  appState.cafe24.token = dom.cafe24Token.value.trim();
  appState.cafe24.refreshToken = dom.cafe24RefreshToken.value.trim();
  localStorage.setItem('lc_cafe24_mall_id', appState.cafe24.mallId);
  localStorage.setItem('lc_cafe24_client_id', appState.cafe24.clientId);
  localStorage.setItem('lc_cafe24_client_secret', appState.cafe24.clientSecret);
  localStorage.setItem('lc_cafe24_token', appState.cafe24.token);
  localStorage.setItem('lc_cafe24_refresh_token', appState.cafe24.refreshToken);
  saveConfigToServer();
  updateStatusIndicators();
  showToast('카페24 설정이 저장되었습니다.', 'success');
}

function saveLogenSettings() {
  appState.logen.customerCode = dom.logenCustomerCode.value.trim();
  appState.logen.senderName = dom.logenSenderName.value.trim();
  appState.logen.senderTel = dom.logenSenderTel.value.trim();
  appState.logen.senderAddr = dom.logenSenderAddr.value.trim();
  appState.logen.senderZipcode = dom.logenSenderZipcode.value.trim();
  if (dom.logenUserId) appState.logen.userId = dom.logenUserId.value.trim();
  if (dom.logenPassword) appState.logen.password = dom.logenPassword.value;
  localStorage.setItem('lc_logen_customer_code', appState.logen.customerCode);
  localStorage.setItem('lc_logen_sender_name', appState.logen.senderName);
  localStorage.setItem('lc_logen_sender_tel', appState.logen.senderTel);
  localStorage.setItem('lc_logen_sender_addr', appState.logen.senderAddr);
  localStorage.setItem('lc_logen_sender_zipcode', appState.logen.senderZipcode);
  localStorage.setItem('lc_logen_user_id', appState.logen.userId || '');
  localStorage.setItem('lc_logen_password', appState.logen.password || '');
  saveConfigToServer();
  updateStatusIndicators();
  showToast('로젠 설정이 저장되었습니다.', 'success');
}

function updateStatusIndicators() {
  const cafe24Ok = appState.cafe24.mallId && appState.cafe24.token;
  const logenOk = appState.logen.customerCode && appState.logen.senderName;

  const cafe24Dot = dom.cafe24Status.querySelector('.dot');
  const cafe24Text = dom.cafe24Status.querySelector('strong');
  cafe24Dot.className = `dot ${cafe24Ok ? 'connected' : ''}`;
  cafe24Text.textContent = cafe24Ok ? '연결됨' : '미연결';

  const logenDot = dom.logenStatus.querySelector('.dot');
  const logenText = dom.logenStatus.querySelector('strong');
  logenDot.className = `dot ${logenOk ? 'connected' : ''}`;
  logenText.textContent = logenOk ? '설정완료' : '미설정';
}

// ============================================================
// CAFE24 토큰 자동 갱신
// ============================================================

// API 프록시 URL (Vercel에서 호스팅)
const API_PROXY = '/api/cafe24';
const LOGEN_PROXY = '/api/logen';

/** 서버 최신 토큰을 appState에 동기화 */
async function syncTokenFromServer() {
  try {
    const cfgResp = await fetch('/api/config');
    if (cfgResp.ok) {
      const cfg = await cfgResp.json();
      // token 필드 우선 (서버 auto_refresh가 업데이트하는 필드)
      const t = cfg.cafe24?.token || cfg.cafe24?.accessToken;
      if (t) {
        appState.cafe24.token = t;
        appState.cafe24.accessToken = t;
      }
      if (cfg.cafe24?.refreshToken) appState.cafe24.refreshToken = cfg.cafe24.refreshToken;
      if (cfg.cafe24?.tokenExpiresAt) appState.cafe24.tokenExpiresAt = cfg.cafe24.tokenExpiresAt;
    }
  } catch(e) {}
}

/** refresh_token으로 access_token 강제 재발급. 성공 true / 실패 false */
async function forceRefreshToken() {
  if (!appState.cafe24.refreshToken || !appState.cafe24.clientId || !appState.cafe24.clientSecret) return false;
  try {
    const rfResp = await fetch(API_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'refresh_token',
        mallId: appState.cafe24.mallId,
        clientId: appState.cafe24.clientId,
        clientSecret: appState.cafe24.clientSecret,
        refreshToken: appState.cafe24.refreshToken,
      }),
    });
    const data = await rfResp.json();
    if (data.access_token) {
      appState.cafe24.token = data.access_token;
      appState.cafe24.accessToken = data.access_token;
      if (data.refresh_token) appState.cafe24.refreshToken = data.refresh_token;
      if (data.expires_at) appState.cafe24.tokenExpiresAt = data.expires_at;
      await saveConfigToServer();  // 서버 저장 완료 후 리턴 (race condition 방지)
      return true;
    }
    // invalid_grant = refresh_token 만료 → 자동 재인증 시도
    if (data.error === 'invalid_grant' || String(data.error_description || '').includes('expired')) {
      showToast('카페24 토큰 만료 → 자동 재인증 중...', 'warning');
      try {
        const reauthResp = await fetch('/api/cafe24-reauth', {
          method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}',
        });
        const reauthData = await reauthResp.json();
        if (reauthData.ok && reauthData.token) {
          appState.cafe24.token = reauthData.token;
          appState.cafe24.accessToken = reauthData.token;
          await syncTokenFromServer();  // refreshToken 등 나머지 필드도 동기화
          showToast('✅ 카페24 자동 재인증 성공!', 'success');
          return true;
        }
      } catch(e) { /* headless 실패 시 수동으로 */ }
      showToast('자동 재인증 실패. 설정 탭에서 수동으로 재인증해주세요.', 'error');
      setTimeout(() => { switchTab('settings'); openCafe24ReauthWindow(); }, 1000);
      return false;
    }
    return false;
  } catch(e) { return false; }
}

async function ensureValidToken() {
  // 토큰 만료 시간 확인 (만료 5분 전에 미리 갱신)
  const expiresAt = appState.cafe24.tokenExpiresAt;
  if (expiresAt) {
    const expiresTime = new Date(expiresAt).getTime();
    const now = Date.now();
    if (now < expiresTime - 5 * 60 * 1000) {
      return; // 아직 유효함
    }
  }

  // Refresh Token으로 갱신 시도
  if (!appState.cafe24.refreshToken || !appState.cafe24.clientId || !appState.cafe24.clientSecret) {
    return; // 갱신 불가 (정보 부족)
  }

  try {
    const resp = await fetch(API_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'refresh_token',
        mallId: appState.cafe24.mallId,
        clientId: appState.cafe24.clientId,
        clientSecret: appState.cafe24.clientSecret,
        refreshToken: appState.cafe24.refreshToken,
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data.access_token) {
        appState.cafe24.token = data.access_token;
        appState.cafe24.refreshToken = data.refresh_token;
        appState.cafe24.tokenExpiresAt = data.expires_at;
        localStorage.setItem('lc_cafe24_token', data.access_token);
        localStorage.setItem('lc_cafe24_refresh_token', data.refresh_token);
        localStorage.setItem('lc_cafe24_token_expires_at', data.expires_at);
        dom.cafe24Token.value = data.access_token;
        dom.cafe24RefreshToken.value = data.refresh_token;
        saveConfigToServer();
        console.log('토큰 자동 갱신 완료:', data.expires_at);
      }
    }
  } catch (err) {
    console.warn('토큰 자동 갱신 실패:', err);
  }
}

// ============================================================
// CAFE24 API - 주문 조회
// ============================================================

async function fetchOrders() {
  if (!appState.cafe24.mallId || !appState.cafe24.token) {
    showToast('카페24 설정을 먼저 완료해주세요.', 'error');
    switchTab('settings');
    return;
  }

  // 날짜가 비어있으면 오늘 기준 7일로 자동 설정
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const defaultFrom = weekAgo.toISOString().slice(0, 10);
  const defaultTo = today.toISOString().slice(0, 10);

  if (!dom.orderDateFrom.value) dom.orderDateFrom.value = defaultFrom;
  if (!dom.orderDateTo.value) dom.orderDateTo.value = defaultTo;

  const dateFrom = dom.orderDateFrom.value;
  const dateTo = dom.orderDateTo.value;

  showLoading('카페24에서 미발송 주문을 가져오는 중...');

  try {
    await ensureValidToken();
    const orders = await cafe24GetUnshippedOrders(dateFrom, dateTo);
    appState.orders = orders;
    renderOrdersTable(orders);
    dom.orderCountBadge.textContent = `${orders.length}건`;
    localStorage.setItem('lc_date_from', dateFrom);
    localStorage.setItem('lc_date_to', dateTo);
    saveSessionData();
    showToast(`${orders.length}건의 미발송 주문을 가져왔습니다.`, 'success');
  } catch (err) {
    console.error('주문 조회 실패:', err);
    showToast(`주문 조회 실패: ${err.message}`, 'error');
    // 데모 모드 - API 호출 실패 시 샘플 데이터
    if (confirm('API 연결에 실패했습니다. 데모 데이터로 테스트하시겠습니까?')) {
      const demoOrders = generateDemoOrders();
      appState.orders = demoOrders;
      renderOrdersTable(demoOrders);
      dom.orderCountBadge.textContent = `${demoOrders.length}건`;
      showToast(`데모 모드: ${demoOrders.length}건의 샘플 주문이 로드되었습니다.`, 'info');
    }
  } finally {
    hideLoading();
  }
}

async function cafe24GetUnshippedOrders(dateFrom, dateTo) {
  // 서버 최신 토큰 동기화
  await syncTokenFromServer();

  const makeOrderReq = async () => {
    const r = await fetch(API_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get_orders',
        mallId: appState.cafe24.mallId,
        token: appState.cafe24.token,
        startDate: dateFrom,
        endDate: dateTo,
      }),
    });
    const d = await r.json().catch(() => ({}));
    return { status: r.status, ok: r.ok, data: d };
  };

  let { status, ok, data } = await makeOrderReq();

  // 토큰 오류 감지 (Cafe24는 HTTP 200으로 에러 반환하므로 body도 체크)
  const hasTokenErr = (d) => d?.error && (
    status === 401 || status === 403
    || Number(d.error.code) === 401
    || String(d.error.message || '').toLowerCase().includes('invalid')
    || String(d.error.message || '').toLowerCase().includes('token')
  );

  if (hasTokenErr(data)) {
    await forceRefreshToken();
    ({ status, ok, data } = await makeOrderReq());
  }

  // 재시도 후에도 에러면 throw
  if (!ok || data?.error) {
    throw new Error(data?.error?.message || `HTTP ${status}`);
  }

  const orders = (data.orders || []).map(normalizeOrder);

  // 상품 이미지 조회 (서버 경유 → 실패 시 클라이언트 직접 스크래핑)
  try {
    const productNos = [...new Set(orders.map(o => o.productNo).filter(Boolean))];
    if (productNos.length > 0) {
      // 1차: 서버 get_product_images 엔드포인트 시도
      let imgMap = {};
      try {
        const imgResp = await fetch(API_PROXY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get_product_images',
            mallId: appState.cafe24.mallId,
            token: appState.cafe24.token,
            productNos,
          }),
        });
        if (imgResp.ok) {
          const imgData = await imgResp.json();
          if (!imgData.error) imgMap = imgData.images || {};
        }
      } catch (e) { /* 서버 엔드포인트 없으면 무시 */ }

      // 2차: 서버에서 이미지 못 가져온 상품은 클라이언트 직접 스크래핑
      const missing = productNos.filter(no => !imgMap[String(no)]);
      for (const pno of missing.slice(0, 20)) {
        const pageUrl = `https://${appState.cafe24.mallId}.cafe24.com/product/detail.html?product_no=${pno}`;
        // 여러 CORS 프록시 순차 시도
        const proxies = [
          { url: `https://corsproxy.io/?url=${encodeURIComponent(pageUrl)}`, type: 'raw' },
          { url: `https://api.allorigins.win/get?url=${encodeURIComponent(pageUrl)}`, type: 'allorigins' },
        ];
        let found = false;
        for (const proxy of proxies) {
          if (found) break;
          try {
            const r = await fetch(proxy.url, { signal: AbortSignal.timeout(8000) });
            if (!r.ok) continue;
            let html = '';
            if (proxy.type === 'raw') {
              html = await r.text();
            } else {
              const j = await r.json();
              html = j.contents || '';
            }
            const m = html.match(/property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']/)
                   || html.match(/content=["\']([^"\']+)["\'][^>]*property=["\']og:image["\']/);
            if (m && m[1] && m[1].startsWith('http')) {
              imgMap[String(pno)] = m[1];
              found = true;
            }
          } catch (e) { /* 다음 프록시 시도 */ }
        }
      }

      // 매핑 적용
      orders.forEach(o => {
        if (o.productNo && imgMap[String(o.productNo)]) {
          o.productImage = imgMap[String(o.productNo)];
        }
      });
    }
  } catch (e) {
    console.warn('상품 이미지 조회 실패:', e.message);
  }

  return orders;
}

function normalizeOrder(order) {
  const item = order.items?.[0] || {};
  const receiver = order.receivers?.[0] || {};
  return {
    orderId: order.order_id,
    orderDate: order.order_date,
    orderItemCode: item.order_item_code || '',
    productName: item.product_name || '상품명 없음',
    productNo: item.product_no || null,       // 이미지 조회용
    productImage: item.product_image || item.image || '',
    productOption: item.option_value || '',   // 예: "색상=4연핑"
    quantity: item.quantity || 1,
    receiverName: receiver.name || order.buyer_name || '',
    receiverTel: receiver.cellphone || receiver.phone || '',
    receiverAddr: receiver.address1 || '',
    receiverAddrDetail: receiver.address2 || '',
    receiverZipcode: receiver.zipcode || '',
    shippingMessage: receiver.shipping_message || '',
    trackingNo: '',
    status: 'pending',
  };
}

// ============================================================
// 주문 테이블 렌더링
// ============================================================

function renderOrdersTable(orders) {
  if (orders.length === 0) {
    dom.ordersTbody.innerHTML = '<tr class="empty-row"><td colspan="10">미발송 주문이 없습니다</td></tr>';
    return;
  }

  dom.ordersTbody.innerHTML = orders.map((o, i) => `
    <tr data-index="${i}">
      <td><input type="checkbox" class="order-check" data-index="${i}"></td>
      <td title="${esc(o.orderId)}">${esc(o.orderId)}</td>
      <td>${esc(formatDateTime(o.orderDate))}</td>
      <td>${esc(o.receiverName)}</td>
      <td>${esc(o.receiverTel)}</td>
      <td title="${esc([o.receiverAddr, o.receiverAddrDetail].filter(Boolean).join(' '))}">${esc([o.receiverAddr, o.receiverAddrDetail].filter(Boolean).join(' '))}</td>
      <td>${esc(o.receiverZipcode)}</td>
      <td title="${esc(o.productName)}">${esc(o.productName)}</td>
      <td>${o.quantity}</td>
      <td title="${esc(o.shippingMessage)}">${esc(o.shippingMessage)}</td>
    </tr>
  `).join('');

  // 체크박스 이벤트
  dom.ordersTbody.querySelectorAll('.order-check').forEach(cb => {
    cb.addEventListener('change', updateOrderSelection);
  });

  dom.selectAllOrders.checked = false;
  updateOrderSelection();
}

function toggleSelectAllOrders() {
  const checked = dom.selectAllOrders.checked;
  dom.ordersTbody.querySelectorAll('.order-check').forEach(cb => cb.checked = checked);
  updateOrderSelection();
}

function updateOrderSelection() {
  const checks = [...dom.ordersTbody.querySelectorAll('.order-check')];
  const selectedCount = checks.filter(c => c.checked).length;
  dom.selectedCount.textContent = `${selectedCount}건 선택됨`;
  dom.exportSelectedBtn.disabled = selectedCount === 0;
}

// ============================================================
// 송장 발급 탭
// ============================================================

function exportToInvoiceTab() {
  const checks = [...dom.ordersTbody.querySelectorAll('.order-check')];
  const selectedIndices = checks.filter(c => c.checked).map(c => parseInt(c.dataset.index));
  appState.invoiceItems = selectedIndices.map(i => ({ ...appState.orders[i], trackingNo: '', status: 'pending' }));
  renderInvoiceTable();
  dom.invoiceCountBadge.textContent = `${appState.invoiceItems.length}건`;
  saveSessionData();
  switchTab('invoice');
  showToast(`${appState.invoiceItems.length}건이 송장 발급 탭으로 이동되었습니다.`, 'success');
}

function renderInvoiceTable() {
  const items = appState.invoiceItems;
  if (items.length === 0) {
    dom.invoiceTbody.innerHTML = '<tr class="empty-row"><td colspan="9">\'주문 조회\' 탭에서 주문을 선택해주세요</td></tr>';
    return;
  }

  dom.invoiceTbody.innerHTML = items.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(item.orderId)}</td>
      <td>${esc(item.receiverName)}</td>
      <td>${esc(item.receiverTel)}</td>
      <td title="${esc([item.receiverAddr, item.receiverAddrDetail].filter(Boolean).join(' '))}">${esc([item.receiverAddr, item.receiverAddrDetail].filter(Boolean).join(' '))}</td>
      <td title="${esc(item.productName)}">${esc(item.productName)}</td>
      <td>${item.quantity}</td>
      <td><input type="text" class="invoice-input" data-index="${i}" value="${esc(item.trackingNo)}" placeholder="송장번호"></td>
      <td><span class="status-tag ${item.status}">${statusLabel(item.status)}</span></td>
    </tr>
  `).join('');

  dom.invoiceTbody.querySelectorAll('.invoice-input').forEach(input => {
    input.addEventListener('change', e => {
      const idx = parseInt(e.target.dataset.index);
      appState.invoiceItems[idx].trackingNo = e.target.value.trim();
      if (e.target.value.trim()) {
        appState.invoiceItems[idx].status = 'assigned';
      }
      renderInvoiceTable();
    });
  });
}

// ============================================================
// 로젠 EDI 엑셀 생성
// ============================================================

function downloadLogenEDI() {
  if (appState.invoiceItems.length === 0) {
    showToast('송장 발급 대상이 없습니다.', 'warning');
    return;
  }

  const sender = appState.logen;
  const rows = appState.invoiceItems.map((item, i) => ({
    '순번': i + 1,
    '고객코드': sender.customerCode,
    '보내는분성명': sender.senderName,
    '보내는분전화번호': sender.senderTel,
    '보내는분주소': sender.senderAddr,
    '보내는분우편번호': sender.senderZipcode,
    '받는분성명': item.receiverName,
    '받는분전화번호': item.receiverTel,
    '받는분주소': [item.receiverAddr, item.receiverAddrDetail].filter(Boolean).join(' '),
    '받는분우편번호': item.receiverZipcode,
    '품목명': item.productName,
    '수량': item.quantity,
    '주문번호': item.orderId,
    '배송메시지': item.shippingMessage || '',
    '운임구분': '선불',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // 컬럼 너비 설정
  ws['!cols'] = [
    { wch: 5 },   // 순번
    { wch: 12 },  // 고객코드
    { wch: 10 },  // 보내는분성명
    { wch: 15 },  // 보내는분전화번호
    { wch: 40 },  // 보내는분주소
    { wch: 8 },   // 보내는분우편번호
    { wch: 10 },  // 받는분성명
    { wch: 15 },  // 받는분전화번호
    { wch: 40 },  // 받는분주소
    { wch: 8 },   // 받는분우편번호
    { wch: 30 },  // 품목명
    { wch: 5 },   // 수량
    { wch: 20 },  // 주문번호
    { wch: 30 },  // 배송메시지
    { wch: 8 },   // 운임구분
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '로젠배송데이터');
  const filename = `로젠EDI_${formatDate(new Date())}_${appState.invoiceItems.length}건.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast(`${filename} 다운로드 완료!`, 'success');
}

function generateTestInvoices() {
  if (appState.invoiceItems.length === 0) {
    showToast('송장 발급 대상이 없습니다.', 'warning');
    return;
  }

  appState.invoiceItems.forEach(item => {
    item.trackingNo = generateFakeTrackingNo();
    item.status = 'assigned';
  });

  renderInvoiceTable();

  // 업로드 탭에도 자동 반영
  appState.uploadItems = appState.invoiceItems.map(item => ({ ...item }));
  renderUploadTable();

  showToast(`${appState.invoiceItems.length}건의 테스트 송장번호가 생성되었습니다.`, 'info');
}

function generateFakeTrackingNo() {
  // 로젠 송장번호 형식: 숫자 11~13자리
  const prefix = '9' + Math.floor(Math.random() * 9 + 1);
  let num = prefix;
  for (let i = 0; i < 9; i++) num += Math.floor(Math.random() * 10);
  return num;
}

// ============================================================
// 송장 등록 (Upload) 탭
// ============================================================

function handleInvoiceFileDrop(e) {
  e.preventDefault();
  e.currentTarget.style.borderColor = '';
  const file = e.dataTransfer.files[0];
  if (file) parseInvoiceFile(file);
}

function handleInvoiceFileSelect(e) {
  const file = e.target.files[0];
  if (file) parseInvoiceFile(file);
  e.target.value = '';
}

async function parseInvoiceFile(file) {
  showLoading('파일 분석 중...');
  try {
    const data = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // 로젠 출력 파일은 상단에 제목 행이 있어 헤더가 3행째에 있음
    // 먼저 전체 데이터를 배열로 읽어서 헤더 행을 자동 감지
    const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // 헤더 행 찾기: '운송장번호' 또는 '송장번호' 가 포함된 행
    let headerRowIdx = -1;
    let headers = [];
    for (let i = 0; i < Math.min(allRows.length, 10); i++) {
      const row = allRows[i];
      if (!row) continue;
      const rowStrs = row.map(c => String(c || '').trim());
      if (rowStrs.some(c => c === '운송장번호' || c === '송장번호' || c === 'tracking_no')) {
        headerRowIdx = i;
        headers = rowStrs;
        break;
      }
    }

    // 헤더를 못 찾으면 기본 방식으로 파싱
    if (headerRowIdx === -1) {
      const rows = XLSX.utils.sheet_to_json(sheet);
      if (rows.length === 0) {
        showToast('파일에 데이터가 없습니다.', 'warning');
        return;
      }
      const mapped = rows.map(row => {
        const orderId = row['주문번호'] || row['order_id'] || row['주문 번호'] || '';
        const trackingNo = row['송장번호'] || row['운송장번호'] || row['tracking_no'] || row['운송장 번호'] || '';
        const receiverName = row['받는분성명'] || row['수령인'] || row['receiver_name'] || row['이름'] || '';
        const productName = row['품목명'] || row['상품명'] || row['product_name'] || row['물품명'] || '';
        return { orderId: String(orderId).trim(), trackingNo: String(trackingNo).trim(), receiverName: String(receiverName).trim(), productName: String(productName).trim(), status: trackingNo ? 'assigned' : 'pending' };
      }).filter(r => r.orderId || r.trackingNo);
      appState.uploadItems = mapped;
      renderUploadTable();
      showToast(`${mapped.length}건의 데이터를 읽었습니다.`, 'success');
      return;
    }

    // 헤더 행을 기반으로 데이터 행 파싱
    const dataRows = allRows.slice(headerRowIdx + 1);
    const findCol = (...names) => {
      for (const name of names) {
        const idx = headers.indexOf(name);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const colTrackingNo = findCol('운송장번호', '송장번호', 'tracking_no');
    const colName = findCol('이름', '받는분성명', '수령인', '수하인');
    const colProduct = findCol('물품명', '품목명', '상품명');
    const colOrderId = findCol('주문번호', 'order_id');
    const colPhone = findCol('휴대폰', '전화', '연락처');
    const colAddr = findCol('주소');

    const mapped = dataRows.map(row => {
      if (!row || row.length === 0) return null;
      const trackingNo = colTrackingNo >= 0 ? String(row[colTrackingNo] || '').trim() : '';
      const receiverName = colName >= 0 ? String(row[colName] || '').trim() : '';
      const productName = colProduct >= 0 ? String(row[colProduct] || '').trim() : '';
      const orderId = colOrderId >= 0 ? String(row[colOrderId] || '').trim() : '';
      const phone = colPhone >= 0 ? String(row[colPhone] || '').trim() : '';
      const addr = colAddr >= 0 ? String(row[colAddr] || '').trim() : '';

      // 숫자가 아닌 운송장번호는 헤더/소계 행이므로 제외
      if (!trackingNo || trackingNo === '합계' || !/^\d+$/.test(trackingNo)) return null;

      return { orderId, trackingNo, receiverName, productName, phone, addr, status: 'assigned' };
    }).filter(Boolean);

    // 주문번호가 없는 경우, 수령인 이름+물품명으로 기존 주문과 매칭
    if (appState.invoiceItems.length > 0) {
      mapped.forEach(m => {
        if (m.orderId) {
          const match = appState.invoiceItems.find(item => item.orderId === m.orderId);
          if (match) {
            m.receiverName = m.receiverName || match.receiverName;
            m.productName = m.productName || match.productName;
            m.orderItemCode = match.orderItemCode;
          }
        } else {
          // 주문번호 없으면 수령인 이름으로 매칭 시도
          const match = appState.invoiceItems.find(item =>
            item.receiverName === m.receiverName ||
            (m.phone && item.receiverTel && item.receiverTel.replace(/-/g, '').includes(m.phone.replace(/-/g, '')))
          );
          if (match) {
            m.orderId = match.orderId;
            m.productName = m.productName || match.productName;
            m.orderItemCode = match.orderItemCode;
          }
        }
      });
    }

    appState.uploadItems = mapped;
    renderUploadTable();
    showToast(`${mapped.length}건의 데이터를 읽었습니다.`, 'success');
  } catch (err) {
    console.error(err);
    showToast(`파일 파싱 오류: ${err.message}`, 'error');
  } finally {
    hideLoading();
  }
}

function parseManualInput() {
  const text = dom.manualInvoiceInput.value.trim();
  if (!text) {
    showToast('데이터를 입력해주세요.', 'warning');
    return;
  }

  const lines = text.split('\n').filter(l => l.trim());
  const parsed = lines.map(line => {
    const parts = line.split(/[,\t]/).map(p => p.trim());
    return {
      orderId: parts[0] || '',
      trackingNo: parts[1] || '',
      receiverName: '',
      productName: '',
      status: parts[1] ? 'assigned' : 'pending',
    };
  }).filter(r => r.orderId);

  // invoiceItems에서 정보 보충
  parsed.forEach(p => {
    const match = appState.invoiceItems.find(item => item.orderId === p.orderId);
    if (match) {
      p.receiverName = match.receiverName;
      p.productName = match.productName;
    }
  });

  appState.uploadItems = parsed;
  renderUploadTable();
  showToast(`${parsed.length}건이 파싱되었습니다.`, 'success');
}

function renderUploadTable() {
  const items = appState.uploadItems;
  if (items.length === 0) {
    dom.uploadTbody.innerHTML = '<tr class="empty-row"><td colspan="6">송장번호 데이터를 입력해주세요</td></tr>';
    dom.uploadToCafe24Btn.disabled = true;
    return;
  }

  dom.uploadTbody.innerHTML = items.map((item, i) => `
    <tr>
      <td><input type="checkbox" class="upload-check" data-index="${i}" ${(item.trackingNo && item.orderItemCode) ? 'checked' : ''} ${(!item.trackingNo || !item.orderItemCode) ? 'disabled' : ''}></td>
      <td>${esc(item.orderId)}</td>
      <td>${esc(item.receiverName)}</td>
      <td title="${esc(item.productName)}">${esc(item.productName)}</td>
      <td>${esc(item.trackingNo)}</td>
      <td>
        <span class="status-tag ${item.status}" ${item._error ? `title="${esc(item._error)}"` : ''}>${statusLabel(item.status)}</span>
        ${item._note  ? `<div style="font-size:11px;color:#27ae60;margin-top:2px;">${esc(item._note)}</div>` : ''}
        ${item._error ? `<div style="font-size:11px;color:#e74c3c;margin-top:2px;max-width:220px;word-break:break-all;">${esc(item._error)}</div>` : ''}
      </td>
    </tr>
  `).join('');

  dom.uploadTbody.querySelectorAll('.upload-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const hasChecked = [...dom.uploadTbody.querySelectorAll('.upload-check')].some(c => c.checked);
      dom.uploadToCafe24Btn.disabled = !hasChecked;
    });
  });

  const hasData = items.some(i => i.trackingNo);
  dom.uploadToCafe24Btn.disabled = !hasData;
  dom.selectAllUpload.checked = false;
  if (dom.uploadCountBadge) dom.uploadCountBadge.textContent = `${items.length}건`;
}

function toggleSelectAllUpload() {
  const checked = dom.selectAllUpload.checked;
  dom.uploadTbody.querySelectorAll('.upload-check:not(:disabled)').forEach(cb => cb.checked = checked);
  dom.uploadToCafe24Btn.disabled = !checked;
}

// ============================================================
// 카페24 송장 일괄 등록
// ============================================================

async function uploadToCafe24() {
  if (!appState.cafe24.mallId || !appState.cafe24.token) {
    showToast('카페24 설정을 먼저 완료해주세요.', 'error');
    switchTab('settings');
    return;
  }

  // 토큰 최신화
  await syncTokenFromServer();
  await forceRefreshToken();

  const checks = [...dom.uploadTbody.querySelectorAll('.upload-check')];
  const selectedItems = checks
    .filter(c => c.checked)
    .map(c => appState.uploadItems[parseInt(c.dataset.index)])
    .filter(item => item.trackingNo && item.orderItemCode);

  if (selectedItems.length === 0) {
    showToast('등록할 송장이 없습니다.', 'warning');
    return;
  }

  if (!confirm(`${selectedItems.length}건의 송장을 카페24에 등록하시겠습니까?`)) return;

  await ensureValidToken();
  dom.uploadProgress.style.display = 'flex';
  dom.uploadToCafe24Btn.disabled = true;

  let success = 0;
  let fail = 0;

  for (let i = 0; i < selectedItems.length; i++) {
    const item = selectedItems[i];
    dom.uploadProgressBar.style.width = `${((i + 1) / selectedItems.length) * 100}%`;
    dom.uploadProgressText.textContent = `${i + 1}/${selectedItems.length}`;

    try {
      const result = await cafe24UpdateShipping(item.orderId, item.orderItemCode, item.trackingNo);
      if (result && result.__alreadyRegistered) {
        item.status = 'registered';
        item._error = '';
        item._note = '이미 송장등록이 완료된 상태입니다';
      } else {
        item.status = 'registered';
        item._error = '';
        item._note = '';
      }
      success++;
    } catch (err) {
      console.error(`송장 등록 실패 [${item.orderId}]:`, err);
      item.status = 'failed';
      item._error = err.message || String(err);
      fail++;
    }

    // 배송조회 대상에도 추가
    if (item.status === 'registered') {
      const existing = appState.trackingItems.find(t => t.orderId === item.orderId);
      if (!existing) {
        appState.trackingItems.push({ ...item, trackingStatus: '접수', lastUpdate: new Date().toLocaleString() });
      }
    }

    renderUploadTable();

    // API 레이트 리밋 방지 - 약간의 딜레이
    if (i < selectedItems.length - 1) {
      await delay(300);
    }
  }

  dom.uploadProgress.style.display = 'none';
  dom.uploadToCafe24Btn.disabled = false;

  const msg = `등록 완료! 성공: ${success}건` + (fail > 0 ? `, 실패: ${fail}건` : '');
  showToast(msg, fail > 0 ? 'warning' : 'success');
}

async function cafe24UpdateShipping(orderId, orderItemCode, trackingNo) {
  const resp = await fetch(API_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'update_shipping',
      mallId: appState.cafe24.mallId,
      token: appState.cafe24.token,
      orderId,
      orderItemCode,
      trackingNo,
    }),
  });

  const data = await resp.json().catch(() => ({}));

  // API 응답 내 에러 확인
  if (data.error || !resp.ok) {
    const code = (data.error || {}).code;
    const msg  = (data.error || {}).message || '';

    if (msg.includes('insufficient_scope')) {
      throw new Error('권한 부족: 카페24 앱에 "주문 쓰기(mall.write_order)" 권한을 추가하고 다시 인증하세요.');
    }
    if (code === 404) {
      throw new Error(`주문번호를 찾을 수 없습니다 (${orderId})`);
    }

    // 에러가 나도 실제로는 이미 등록됐을 수 있음 → 주문 상태 재확인
    try {
      const checkResp = await fetch(API_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_order_detail',
          mallId: appState.cafe24.mallId,
          token: appState.cafe24.token,
          orderId,
        }),
      });
      const checkData = await checkResp.json().catch(() => ({}));
      const order = checkData.order || {};
      // 카페24 order 객체: shipping_status, items[].tracking_no 등
      const shippingStatus = order.shipping_status || '';
      const items = order.items || [];
      const existingTracking = items.map(it => it.tracking_no).filter(Boolean).join(',');

      // 배송대기(standby) 이상이거나, 이미 같은 송장번호 등록됨
      const alreadyDone = ['standby','delivering','delivered','shipping'].includes(shippingStatus)
        || existingTracking.includes(trackingNo);

      if (alreadyDone) {
        // 성공으로 처리 (특수 플래그)
        return { __alreadyRegistered: true, shippingStatus, existingTracking };
      }
    } catch(_) { /* 재확인 실패 시 원래 에러 throw */ }

    throw new Error(msg || `HTTP ${resp.status}`);
  }

  return data;
}

// ============================================================
// 배송 조회
// ============================================================

async function trackSingle() {
  const trackingNo = dom.trackingInput.value.trim();
  if (!trackingNo) {
    showToast('송장번호를 입력해주세요.', 'warning');
    return;
  }

  showLoading('배송 정보 조회 중...');
  try {
    const info = await getTrackingInfo(trackingNo);
    appState.trackingItems = [{ orderId: '-', trackingNo, receiverName: '-', trackingStatus: info.status, lastUpdate: info.lastUpdate, location: info.location }];
    renderTrackingTable();
    showToast('배송 정보를 조회했습니다.', 'success');
  } catch (err) {
    showToast(`배송 조회 실패: ${err.message}`, 'error');
  } finally {
    hideLoading();
  }
}

async function trackAll() {
  // invoiceItems + uploadItems에서 송장번호가 있는 항목들 조회
  const allItems = [...appState.invoiceItems, ...appState.uploadItems]
    .filter(item => item.trackingNo)
    .reduce((acc, item) => {
      if (!acc.find(a => a.trackingNo === item.trackingNo)) acc.push(item);
      return acc;
    }, []);

  if (allItems.length === 0) {
    showToast('조회할 송장번호가 없습니다.', 'warning');
    return;
  }

  showLoading(`${allItems.length}건 배송 조회 중...`);

  try {
    const trackingNumbers = allItems.map(item => item.trackingNo);
    const trackingMap = await getTrackingInfoBatch(trackingNumbers);

    const results = allItems.map(item => {
      const info = trackingMap[item.trackingNo] || {};
      return {
        ...item,
        trackingStatus: info.status || '배송준비',
        lastUpdate: info.lastUpdate || '-',
        location: info.location || '',
        trackingDetails: info.events || [],
      };
    });

    appState.trackingItems = results;
    renderTrackingTable();
    showToast(`${results.length}건 조회 완료`, 'success');
  } catch (err) {
    showToast(`배송 조회 실패: ${err.message}`, 'error');
  } finally {
    hideLoading();
  }
}

async function getTrackingInfoBatch(trackingNumbers) {
  // tracker.delivery API (서버 프록시 경유)
  const resp = await fetch(LOGEN_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackingNumbers }),
  });

  const result = await resp.json();
  if (result.error) throw new Error(result.error);

  // 프록시 응답: { data: { "43757058041": { status, lastUpdate, location, events }, ... } }
  return result.data || {};
}

async function getTrackingInfo(trackingNo) {
  const map = await getTrackingInfoBatch([trackingNo]);
  return map[trackingNo] || { status: '배송준비', lastUpdate: '-', events: [] };
}

function generateDemoTracking(trackingNo) {
  const statuses = ['집하', '간선상차', '간선하차', '배달출발', '배달완료'];
  const locations = ['서울 강남 집하장', '서울 허브터미널', '경기 수원 터미널', '수원 영통 배달소', '배달완료'];
  const randomIdx = Math.floor(Math.random() * statuses.length);
  const now = new Date();

  const details = [];
  for (let i = randomIdx; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(d.getHours() - (randomIdx - i) * 4);
    details.push({
      date: d.toLocaleString('ko-KR'),
      location: locations[i],
      status: statuses[i],
      description: `${locations[i]}에서 ${statuses[i]}`,
    });
  }

  return {
    orderId: '-',
    trackingNo,
    receiverName: '데모 수령인',
    trackingStatus: statuses[randomIdx],
    lastUpdate: details[0]?.date || '-',
    trackingDetails: details,
  };
}

function renderTrackingTable() {
  const items = appState.trackingItems;
  if (items.length === 0) {
    dom.trackingTbody.innerHTML = '<tr class="empty-row"><td colspan="6">송장번호를 입력하거나 \'전체 배송현황 조회\' 버튼을 클릭하세요</td></tr>';
    return;
  }

  dom.trackingTbody.innerHTML = items.map((item, i) => {
    const statusClass = getTrackingStatusClass(item.trackingStatus);
    return `
    <tr>
      <td>${esc(item.orderId || '-')}</td>
      <td>${esc(item.trackingNo)}</td>
      <td>${esc(item.receiverName || item.location || '-')}</td>
      <td><span class="status-tag ${statusClass}">${esc(item.trackingStatus || '조회중')}</span></td>
      <td>${esc(item.lastUpdate || '-')}</td>
      <td><button class="secondary-btn" onclick="showTrackingDetail(${i})">상세</button></td>
    </tr>`;
  }).join('');
}

function getTrackingStatusClass(status) {
  if (!status) return 'pending';
  if (status.includes('완료') || status.includes('배달완료')) return 'delivered';
  if (status.includes('배달출발') || status.includes('배송중')) return 'in-transit';
  if (status.includes('간선') || status.includes('집하')) return 'assigned';
  if (status.includes('배송준비') || status.includes('조회중')) return 'pending';
  return 'pending';
}

function showTrackingDetail(index) {
  const item = appState.trackingItems[index];
  const details = item.trackingDetails || [];

  let html = `
    <div style="margin-bottom:1rem">
      <strong>송장번호:</strong> ${esc(item.trackingNo)}<br>
      <strong>수령인:</strong> ${esc(item.receiverName || '-')}<br>
      <strong>현재 상태:</strong> ${esc(item.trackingStatus || '-')}
    </div>
  `;

  if (details.length > 0) {
    html += '<div class="tracking-timeline">';
    details.forEach(d => {
      html += `
        <div class="timeline-item">
          <div class="time">${esc(d.date)}</div>
          <div class="location">${esc(d.location)}</div>
          <div class="description">${esc(d.description || d.status)}</div>
        </div>`;
    });
    html += '</div>';
  } else {
    html += '<p style="color:var(--text-secondary)">상세 배송 이력이 없습니다.</p>';
  }

  dom.trackingDetail.innerHTML = html;
  dom.trackingModal.style.display = 'flex';
}

// ============================================================
// 데모 데이터 생성
// ============================================================

function generateDemoOrders() {
  const names = ['김민수', '이영희', '박지성', '최유리', '정대현', '한소희', '강동원', '윤서연', '임재범', '오승환'];
  const products = [
    '프리미엄 스킨케어 세트', '유기농 그래놀라 3종', '블루투스 이어폰', '실크 파자마 세트',
    '텀블러 500ml', '아로마 캔들 (라벤더)', '가죽 지갑', '스마트워치 밴드',
    '요가 매트', '핸드크림 세트'
  ];
  const addrs = [
    '서울특별시 강남구 역삼동 123-45', '경기도 성남시 분당구 판교역로 200',
    '부산광역시 해운대구 해운대로 456', '인천광역시 남동구 인하로 789',
    '대전광역시 유성구 대학로 100', '대구광역시 수성구 수성로 300',
    '광주광역시 서구 상무대로 555', '울산광역시 남구 삼산동 111',
    '경기도 수원시 영통구 영통로 222', '서울특별시 마포구 홍대입구로 333',
  ];
  const zips = ['06236', '13524', '48094', '21556', '34134', '42188', '61945', '44677', '16499', '04032'];

  const orders = [];
  const today = new Date();

  for (let i = 0; i < 10; i++) {
    const orderDate = new Date(today);
    orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 5));
    const orderId = `${formatDate(orderDate).replace(/-/g, '')}-${String(i + 1).padStart(4, '0')}`;

    orders.push({
      orderId,
      orderDate: orderDate.toISOString(),
      orderItemCode: `item_${orderId}`,
      productName: products[i],
      quantity: Math.floor(Math.random() * 3) + 1,
      receiverName: names[i],
      receiverTel: `010-${String(Math.floor(Math.random() * 9000) + 1000)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      receiverAddr: addrs[i],
      receiverZipcode: zips[i],
      shippingMessage: i % 3 === 0 ? '부재시 문 앞에 놓아주세요' : (i % 3 === 1 ? '경비실에 맡겨주세요' : ''),
      trackingNo: '',
      status: 'pending',
    });
  }

  return orders;
}

// ============================================================
// Utility Functions
// ============================================================

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (btn) btn.classList.add('active');
  const content = document.getElementById(`tab-${tabName}`);
  if (content) content.classList.add('active');
}

function formatDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${formatDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function statusLabel(status) {
  const labels = {
    pending: '대기',
    assigned: '발급완료',
    registered: '등록완료',
    failed: '실패',
    no_code: '주문코드없음',
  };
  return labels[status] || status;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function showLoading(text) {
  dom.loadingText.textContent = text || '처리 중...';
  dom.loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  dom.loadingOverlay.style.display = 'none';
}

function showToast(message, type = 'info') {
  const icons = { success: '\u2705', error: '\u274C', warning: '\u26A0\uFE0F', info: '\u2139\uFE0F' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${esc(message)}</span>`;
  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ============================================================
// 송장 불러오기 (배송준비중 주문 → 송장 발급 탭 직접 로드)
// ============================================================

async function loadOrdersToInvoiceTab() {
  if (!appState.cafe24.mallId) {
    showToast('카페24 설정을 먼저 완료해주세요.', 'error');
    switchTab('settings');
    return;
  }
  const btn = dom.loadOrdersInvoiceBtn;
  btn.disabled = true;
  btn.textContent = '불러오는 중...';
  showLoading('배송준비중 주문 불러오는 중...');
  try {
    await syncTokenFromServer();
    await forceRefreshToken();

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const dateFrom = dom.orderDateFrom?.value || formatDate(weekAgo);
    const dateTo   = dom.orderDateTo?.value   || formatDate(today);

    const orders = await cafe24GetUnshippedOrders(dateFrom, dateTo);
    appState.orders = orders;
    appState.invoiceItems = orders.map(o => ({ ...o, trackingNo: '', status: 'pending' }));

    renderInvoiceTable();
    dom.invoiceCountBadge.textContent = `${appState.invoiceItems.length}건`;
    saveSessionData();
    showToast(`${appState.invoiceItems.length}건 불러오기 완료. 🚀 로젠 자동 등록을 눌러주세요.`, 'success');
  } catch (err) {
    showToast(`불러오기 실패: ${err.message}`, 'error');
  } finally {
    hideLoading();
    btn.disabled = false;
    btn.textContent = '📥 송장 불러오기';
  }
}

// ============================================================
// 로젠 출력완료 송장번호 불러오기 → 카페24 자동 등록
// ============================================================

async function loadLogenPrinted() {
  const btn = dom.loadLogenPrintedBtn;
  btn.disabled = true;
  btn.textContent = '조회 중...';
  showLoading('로젠 출력완료 송장번호 조회 중...');

  const statusDiv = dom.logenAutoStatus;
  statusDiv.style.display = 'block';
  statusDiv.innerHTML = '<strong>🚚 로젠 출력완료 송장번호 불러오기</strong><br>';

  try {
    if (!appState.logen?.customerCode) {
      showToast('로젠 설정을 먼저 완료해주세요.', 'error');
      switchTab('settings');
      return;
    }

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const dateFrom = dom.orderDateFrom?.value || formatDate(weekAgo);
    const dateTo   = dom.orderDateTo?.value   || formatDate(today);

    statusDiv.innerHTML += `📅 조회 기간: ${dateFrom} ~ ${dateTo}<br>`;

    // 로젠 출력완료 목록 조회
    let resp = await fetch('/api/logen-printed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerCode: appState.logen.customerCode,
        pickSalesCd:  '33212059',
        pickBranCd:   '332',
        startDate:    dateFrom,
        endDate:      dateTo,
      }),
    });

    // 401 → 로젠 자동 로그인 후 재시도
    if (resp.status === 401) {
      statusDiv.innerHTML += '⚠️ 로젠 토큰 없음 → 자동 로그인 시도 중...<br>';
      hideLoading();
      const tokenResp = await fetch('/api/logen-get-token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      if (!tokenResp.ok) {
        showToast('로젠 자동 로그인 실패. 로젠 포털에 먼저 로그인해주세요.', 'error');
        return;
      }
      showLoading('재시도 중...');
      resp = await fetch('/api/logen-printed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerCode: appState.logen.customerCode,
          pickSalesCd: '33212068', pickBranCd: '332',
          startDate: dateFrom, endDate: dateTo,
        }),
      });
    }

    const data = await resp.json();
    if (data.error) { showToast(`조회 실패: ${data.error}`, 'error'); return; }

    const printedItems = data.items || [];
    statusDiv.innerHTML += `✅ 로젠 출력완료 ${printedItems.length}건 확인<br>`;

    if (printedItems.length === 0) {
      showToast(`${dateFrom}~${dateTo} 기간에 출력완료된 송장이 없습니다.`, 'warning');
      return;
    }

    // invoiceItems가 비어있으면 카페24 주문 먼저 로드
    if (appState.invoiceItems.length === 0 && appState.cafe24.mallId) {
      statusDiv.innerHTML += '📦 카페24 미발송 주문 조회 중...<br>';
      try {
        await syncTokenFromServer();
        await forceRefreshToken();
        const orders = await cafe24GetUnshippedOrders(dateFrom, dateTo);
        appState.orders = orders;
        appState.invoiceItems = orders.map(o => ({ ...o, trackingNo: '', status: 'pending' }));
        statusDiv.innerHTML += `📦 카페24 주문 ${orders.length}건 로드됨<br>`;
      } catch(e) {
        statusDiv.innerHTML += `⚠️ 카페24 주문 로드 실패 (${e.message})<br>`;
      }
    }

    // 매칭: 로젠 fixTakeNo ↔ invoiceItems[].orderId
    let matched = 0;
    const cafe24ToUpload = [];

    for (const p of printedItems) {
      const logenOrderId = p.orderId;
      const slipNo = p.slipNo;
      const item = appState.invoiceItems.find(i => i.orderId === logenOrderId);
      if (item) {
        item.trackingNo = slipNo;
        item.status = 'assigned';
        item.invoiceNo = slipNo;
        matched++;
        if (item.orderItemCode) {
          cafe24ToUpload.push({ orderId: item.orderId, orderItemCode: item.orderItemCode, slipNo });
        }
      } else {
        // invoiceItems에 없는 경우 — 새 항목으로 추가
        appState.invoiceItems.push({
          orderId: logenOrderId, receiverName: p.receiverName || '',
          trackingNo: slipNo, invoiceNo: slipNo, status: 'assigned', orderItemCode: '',
        });
        matched++;
      }
    }

    renderInvoiceTable();
    dom.invoiceCountBadge.textContent = `${appState.invoiceItems.length}건`;
    saveSessionData();
    statusDiv.innerHTML += `<strong>✅ 매칭 완료: ${matched}건에 송장번호 입력됨</strong><br>`;

    const noCode = printedItems.filter(p => {
      const it = appState.invoiceItems.find(i => i.orderId === p.orderId);
      return it && !it.orderItemCode;
    });
    if (noCode.length > 0) {
      statusDiv.innerHTML += `⚠️ ${noCode.length}건은 카페24 주문코드 없음 → 먼저 📥 송장 불러오기로 주문 로드 필요<br>`;
    }

    if (cafe24ToUpload.length === 0) {
      showToast(`송장번호 ${matched}건 입력 완료. 카페24 주문코드가 없어 자동 등록은 불가합니다.`, 'warning');
      return;
    }

    // 카페24 자동 등록
    statusDiv.innerHTML += `<br><strong>📮 카페24 자동 등록 중... (${cafe24ToUpload.length}건)</strong><br>`;
    await syncTokenFromServer();
    await forceRefreshToken();

    let c24ok = 0, c24fail = 0;
    for (const u of cafe24ToUpload) {
      try {
        await cafe24UpdateShipping(u.orderId, u.orderItemCode, u.slipNo);
        c24ok++;
        statusDiv.innerHTML += `<span style="color:#27ae60">✅ ${u.orderId} → 카페24 등록 완료 (${u.slipNo})</span><br>`;
      } catch(e) {
        c24fail++;
        statusDiv.innerHTML += `<span style="color:#e74c3c">❌ ${u.orderId} 실패: ${e.message}</span><br>`;
      }
    }

    const msg = `🚚 완료! 로젠 송장 ${matched}건 / 카페24 등록 ${c24ok}건 성공${c24fail > 0 ? ` (${c24fail}건 실패)` : ''}`;
    statusDiv.innerHTML += `<br><strong>${msg}</strong>`;
    showToast(msg, c24fail > 0 ? 'warning' : 'success');

  } catch(err) {
    showToast(`오류: ${err.message}`, 'error');
    statusDiv.innerHTML += `<span style="color:red">오류: ${err.message}</span>`;
  } finally {
    hideLoading();
    btn.disabled = false;
    btn.textContent = '🚚 로젠 출력완료 불러오기';
  }
}

// ============================================================
// 로젠 출력완료 → 송장 등록 탭으로 불러오기
// ============================================================

async function loadLogenPrintedToUpload() {
  const btn = dom.loadLogenPrintedUploadBtn;
  const statusDiv = dom.logenPrintedStatus;
  btn.disabled = true;
  btn.textContent = '조회 중...';
  statusDiv.style.display = 'block';
  statusDiv.innerHTML = '<strong>🚚 로젠 출력완료 송장번호 조회 중...</strong><br>';
  showLoading('로젠 출력완료 목록 조회 중...');

  try {
    const dateFrom = dom.uploadDateFrom?.value || dom.orderDateFrom?.value || formatDate(new Date(Date.now() - 7*86400000));
    const dateTo   = dom.uploadDateTo?.value   || dom.orderDateTo?.value   || formatDate(new Date());

    statusDiv.innerHTML += `📅 기간: ${dateFrom} ~ ${dateTo}<br>`;

    // ── 1. 로젠 출력완료 목록 조회 ───────────────────────────
    let resp = await fetch('/api/logen-printed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerCode: appState.logen.customerCode || '33253401',
        pickSalesCd: '33212068', pickBranCd: '332',
        startDate: dateFrom, endDate: dateTo,
      }),
    });

    if (resp.status === 401) {
      statusDiv.innerHTML += '⚠️ 로젠 토큰 없음 → 자동 로그인 중...<br>';
      hideLoading();
      const tr = await fetch('/api/logen-get-token', { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' });
      if (!tr.ok) { showToast('로젠 자동 로그인 실패', 'error'); return; }
      showLoading('재조회 중...');
      resp = await fetch('/api/logen-printed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerCode: appState.logen.customerCode || '33253401', pickSalesCd: '33212068', pickBranCd: '332', startDate: dateFrom, endDate: dateTo }),
      });
    }

    const data = await resp.json();
    if (data.error) { showToast('로젠 조회 실패: ' + data.error, 'error'); statusDiv.innerHTML += `❌ ${data.error}`; return; }

    const printed = data.items || [];
    statusDiv.innerHTML += `✅ 로젠 운송장 <strong>${printed.length}건</strong> 확인됨<br>`;

    if (printed.length === 0) {
      appState.uploadItems = [];
      renderUploadTable();
      showToast(`해당 기간 출력완료 송장 없음`, 'warning');
      return;
    }

    // ── 2. 카페24 주문 조회 (orderItemCode 확보용) ─────────────
    let orderMap = {};   // orderId → {orderItemCode, receiverName, productName}

    // 이미 로드된 주문 먼저 반영 (발송처리된 것 포함)
    appState.orders?.forEach(o => { orderMap[o.orderId] = o; });
    appState.invoiceItems?.forEach(o => { if (o.orderId && !orderMap[o.orderId]) orderMap[o.orderId] = o; });

    if (appState.cafe24.mallId) {
      statusDiv.innerHTML += '📦 카페24 주문코드 조회 중...<br>';
      try {
        await syncTokenFromServer();
        await forceRefreshToken();
        const orders = await cafe24GetUnshippedOrders(dateFrom, dateTo);
        orders.forEach(o => { orderMap[o.orderId] = o; });  // 신규 주문으로 덮어쓰기
        statusDiv.innerHTML += `📦 카페24 주문 ${Object.keys(orderMap).length}건 확보됨 (미발송 ${orders.length}건 포함)<br>`;
      } catch(e) {
        statusDiv.innerHTML += `⚠️ 카페24 신규 조회 실패 (${e.message}) — 기존 로드된 주문으로 매칭 시도<br>`;
      }
    }

    // ── 3. 병합 → uploadItems ──────────────────────────────────
    const items = printed.map(p => {
      const cafe24 = orderMap[p.orderId] || {};
      return {
        orderId:       p.orderId,
        orderItemCode: cafe24.orderItemCode || '',
        receiverName:  cafe24.receiverName  || p.receiverName || '',
        productName:   cafe24.productName   || '',
        trackingNo:    p.slipNo,
        status:        cafe24.orderItemCode ? 'assigned' : 'no_code',
        _prtCnt:       p.prtCnt,
      };
    });

    // orderItemCode 있는 항목 먼저 정렬
    items.sort((a, b) => {
      if (a.orderItemCode && !b.orderItemCode) return -1;
      if (!a.orderItemCode && b.orderItemCode) return 1;
      return 0;
    });
    appState.uploadItems = items;
    renderUploadTable();
    saveSessionData();

    // ── 4. 이름 기반 매칭 후보 탐색 ──────────────────────────────
    const noCodeItems = items.filter(i => !i.orderItemCode);
    const allOrders = Object.values(orderMap);

    if (noCodeItems.length > 0 && allOrders.length > 0) {
      const candidates = [];
      noCodeItems.forEach(logenItem => {
        if (!logenItem.receiverName) return;
        const lName = logenItem.receiverName.trim();
        const matches = allOrders.filter(o => {
          if (!o.receiverName || !o.orderItemCode) return false;
          const oName = o.receiverName.trim();
          return oName === lName || oName.includes(lName) || lName.includes(oName);
        });
        if (matches.length > 0) candidates.push({ logenItem, matches });
      });

      if (candidates.length > 0) {
        statusDiv.innerHTML += `🔍 이름 매칭 후보 <strong>${candidates.length}건</strong> 발견 → 확인 후 매칭하세요<br>`;
        showNameMatchModal(candidates, items, statusDiv);
      } else {
        const noCode = noCodeItems.length;
        statusDiv.innerHTML += `⚠️ ${noCode}건은 카페24 주문코드 없음 (이미 발송처리됐거나 기간 불일치)<br>`;
      }
    } else {
      const noCode = noCodeItems.length;
      if (noCode > 0) statusDiv.innerHTML += `⚠️ ${noCode}건은 카페24 주문코드 없음<br>`;
    }

    const readyCount = items.filter(i => i.orderItemCode).length;
    statusDiv.innerHTML += `<strong>✅ 완료! 총 ${items.length}건 / 카페24 등록 가능 ${readyCount}건</strong><br>`;
    statusDiv.innerHTML += `<small>✔체크 후 <b>카페24에 송장번호 일괄 등록</b> 버튼을 누르세요</small>`;

    showToast(`로젠 출력완료 ${items.length}건 불러오기 완료`, 'success');

  } catch(err) {
    showToast('오류: ' + err.message, 'error');
    statusDiv.innerHTML += `<span style="color:red">오류: ${err.message}</span>`;
  } finally {
    hideLoading();
    btn.disabled = false;
    btn.textContent = '🚚 로젠 출력완료 불러오기';
  }
}

// ============================================================
// 이름 기반 매칭 모달
// ============================================================

function showNameMatchModal(candidates, allItems, statusDiv) {
  const modal = document.getElementById('name-match-modal');
  const tbody = document.getElementById('name-match-tbody');

  tbody.innerHTML = candidates.map((c, ci) => {
    const multi = c.matches.length > 1;
    const orderCell = multi
      ? `<select class="name-match-select" data-ci="${ci}" style="font-size:12px;max-width:200px;padding:2px 4px;">
           ${c.matches.map((m, mi) => `<option value="${mi}">${esc(m.orderId)} (${esc(m.receiverName)})</option>`).join('')}
         </select>`
      : `${esc(c.matches[0].orderId)}<input type="hidden" class="name-match-select" data-ci="${ci}" value="0">`;

    const m0 = c.matches[0];
    return `
      <tr style="border-bottom:1px solid #eee;" data-ci="${ci}">
        <td style="padding:8px 6px;text-align:center;">
          <input type="checkbox" class="name-match-check" data-ci="${ci}" checked>
        </td>
        <td style="padding:8px 6px;font-weight:600;color:#1a6b3c;">${esc(c.logenItem.receiverName)}</td>
        <td style="padding:8px 6px;font-family:monospace;font-size:12px;">${esc(c.logenItem.trackingNo)}</td>
        <td style="padding:8px 6px;color:#aaa;font-size:18px;">→</td>
        <td style="padding:8px 6px;">${orderCell}</td>
        <td class="nm-rcv-name" style="padding:8px 6px;">${esc(m0.receiverName)}</td>
        <td class="nm-product" style="padding:8px 6px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(m0.productName)}">${esc(m0.productName)}</td>
      </tr>`;
  }).join('');

  // 드롭다운 변경 시 오른쪽 수령인/상품명 갱신
  tbody.querySelectorAll('select.name-match-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const ci = parseInt(sel.dataset.ci);
      const mi = parseInt(sel.value);
      const m = candidates[ci].matches[mi];
      const tr = sel.closest('tr');
      tr.querySelector('.nm-rcv-name').textContent = m.receiverName;
      const prod = tr.querySelector('.nm-product');
      prod.textContent = m.productName;
      prod.title = m.productName;
    });
  });

  modal.style.display = 'flex';

  const closeModal = () => { modal.style.display = 'none'; };
  document.getElementById('name-match-close-btn').onclick = closeModal;
  document.getElementById('name-match-cancel-btn').onclick = closeModal;

  document.getElementById('name-match-apply-btn').onclick = () => {
    let applied = 0;
    tbody.querySelectorAll('tr[data-ci]').forEach(tr => {
      const check = tr.querySelector('.name-match-check');
      if (!check || !check.checked) return;
      const ci = parseInt(tr.dataset.ci);
      const sel = tr.querySelector('.name-match-select');
      const mi = sel ? parseInt(sel.value) : 0;
      const matchedOrder = candidates[ci].matches[mi];
      const logenItem = candidates[ci].logenItem;
      const idx = allItems.indexOf(logenItem);
      if (idx >= 0) {
        allItems[idx].orderId = matchedOrder.orderId;
        allItems[idx].orderItemCode = matchedOrder.orderItemCode;
        allItems[idx].productName = allItems[idx].productName || matchedOrder.productName;
        allItems[idx].receiverName = allItems[idx].receiverName || matchedOrder.receiverName;
        allItems[idx].status = 'assigned';
        applied++;
      }
    });

    closeModal();
    appState.uploadItems = allItems;
    renderUploadTable();
    saveSessionData();

    if (statusDiv) {
      statusDiv.innerHTML += `<strong>✅ 이름 매칭 ${applied}건 적용됨 → 체크 후 카페24 등록하세요</strong><br>`;
    }
    showToast(`${applied}건 이름 매칭 적용 완료`, 'success');
    dom.uploadToCafe24Btn.disabled = !allItems.some(i => i.orderItemCode && i.trackingNo);
  };
}

// ============================================================
// 로젠 자동 등록
// ============================================================

/** logis.ilogen.com 탭에서 JWT 토큰을 가져와 백엔드에 저장 */
async function fetchAndStoreLogenToken() {
  try {
    // BroadcastChannel로 로젠 탭에서 토큰 요청
    return new Promise((resolve, reject) => {
      const ch = new BroadcastChannel('logen_token_channel');
      const timer = setTimeout(() => {
        ch.close();
        reject(new Error('로젠 포털 응답 없음 (타임아웃)'));
      }, 5000);

      ch.onmessage = async (e) => {
        clearTimeout(timer);
        ch.close();
        if (e.data && e.data.type === 'LOGEN_TOKEN_RESPONSE') {
          const { token, pageId, userInfo, empId } = e.data;
          // 백엔드에 저장
          const r = await fetch('/store-logen-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, pageId, userInfo, empId }),
          });
          const result = await r.json();
          resolve(result.ok);
        }
      };

      // 로젠 탭에 토큰 요청 브로드캐스트
      ch.postMessage({ type: 'LOGEN_TOKEN_REQUEST' });
    });
  } catch (err) {
    throw err;
  }
}

/** 로젠 자동 등록 메인 함수 */
async function autoRegisterLogen() {
  if (!appState.invoiceItems || appState.invoiceItems.length === 0) {
    showToast('송장 발급 탭에 주문이 없습니다. 먼저 주문을 가져와 주세요.', 'warning');
    return;
  }

  const btn = dom.autoRegisterLogenBtn;
  const statusDiv = dom.logenAutoStatus;
  btn.disabled = true;
  btn.textContent = '처리 중...';
  statusDiv.style.display = 'block';
  statusDiv.innerHTML = '<strong>🔄 로젠 토큰 확인 중...</strong>';

  try {
    // 1. 로젠 토큰 획득 시도
    try {
      await fetchAndStoreLogenToken();
      statusDiv.innerHTML += '<br>✅ 로젠 토큰 확인됨';
    } catch (tokenErr) {
      statusDiv.innerHTML += `<br>⚠️ 로젠 포털 자동 연결 실패 (${tokenErr.message})<br>→ logis.ilogen.com에 로그인된 상태인지 확인하세요. 기존 토큰으로 시도합니다.`;
    }

    statusDiv.innerHTML += '<br><strong>📦 로젠 송장 등록 중...</strong>';

    // 2. 주문 데이터 준비
    const orders = appState.invoiceItems.map(item => ({
      orderId:       item.orderId,
      name:          item.receiverName,
      phone:         item.receiverTel,
      address:       item.receiverAddr,
      addressDetail: item.receiverAddrDetail || '',
      zipcode:       item.receiverZipcode || '',
      deliveryMemo:  item.shippingMessage || '',
      productName:   item.productName || '보자기',
      qty:           item.qty || 1,
    }));

    const registerBody = JSON.stringify({
      orders,
      senderName:    appState.logen.senderName,
      senderTel:     appState.logen.senderTel,
      senderAddr:    appState.logen.senderAddr,
      senderZip:     appState.logen.senderZipcode,
      customerCode:  appState.logen.customerCode,
    });

    // 3. 백엔드 API 호출
    let resp = await fetch('/api/logen-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: registerBody,
    });

    // 4. 401이면 자동 로그인 후 재시도
    if (resp.status === 401) {
      statusDiv.innerHTML = '<strong>🔑 로젠 토큰 만료 — 자동 로그인 중... (최대 90초)</strong>';
      try {
        const loginResp = await fetch('/api/logen-get-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        const loginResult = await loginResp.json();
        if (loginResult.ok) {
          statusDiv.innerHTML += '<br>✅ 자동 로그인 성공. 재시도 중...';
          resp = await fetch('/api/logen-register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: registerBody,
          });
        } else {
          statusDiv.innerHTML = `<strong style="color:red">❌ 자동 로그인 실패: ${loginResult.error || '알 수 없는 오류'}</strong><br>설정 탭에서 로젠 ID/비밀번호를 확인해주세요.`;
          showToast('로젠 자동 로그인 실패', 'error');
          return;
        }
      } catch (loginErr) {
        statusDiv.innerHTML = `<strong style="color:red">❌ 자동 로그인 오류: ${loginErr.message}</strong>`;
        showToast('로젠 자동 로그인 오류', 'error');
        return;
      }
    }

    if (resp.status === 401) {
      statusDiv.innerHTML = `<strong style="color:red">❌ 로젠 로그인 실패</strong><br>설정 탭에서 로젠 ID/비밀번호를 입력하고 저장해주세요.`;
      showToast('로젠 로그인 실패', 'error');
      return;
    }

    const result = await resp.json();

    // 4. 로젠 등록 결과 처리 + invoiceNo 세팅
    let successCount = 0;
    const cafe24ToUpload = []; // 카페24에 바로 등록할 { orderId, orderItemCode, slipNo }

    let html = `<strong>📋 로젠 등록 결과 (${result.ok}성공 / ${result.fail}실패)</strong><ul style="margin-top:8px">`;
    for (const r of result.results) {
      if (r.success) {
        successCount++;
        const slipNo = r.slipNo || '';
        html += `<li style="color:#27ae60">✅ ${r.orderId} → 로젠 송장: <strong>${slipNo || '배정 대기'}</strong></li>`;

        if (slipNo) {
          const item = appState.invoiceItems.find(i => i.orderId === r.orderId);
          if (item) {
            item.invoiceNo = slipNo;
            cafe24ToUpload.push({ orderId: r.orderId, orderItemCode: item.orderItemCode, slipNo });
          }
        }
      } else {
        html += `<li style="color:#e74c3c">❌ ${r.orderId} → ${r.error}</li>`;
      }
    }
    html += '</ul>';
    statusDiv.innerHTML = html;

    // 5. 카페24 송장번호 자동 등록
    if (cafe24ToUpload.length > 0) {
      statusDiv.innerHTML += '<br><strong>📤 카페24 송장 자동 등록 중...</strong>';

      // Cafe24 토큰 최신화
      try {
        const cfgR = await fetch('/api/config');
        if (cfgR.ok) {
          const cfg = await cfgR.json();
          const t = cfg.cafe24?.accessToken || cfg.cafe24?.token;
          if (t) appState.cafe24.token = t;
          if (cfg.cafe24?.refreshToken) appState.cafe24.refreshToken = cfg.cafe24.refreshToken;
        }
      } catch(e) {}
      await ensureValidToken();

      let c24Ok = 0, c24Fail = 0;
      let c24Html = '<ul style="margin-top:4px">';
      for (const u of cafe24ToUpload) {
        try {
          await cafe24UpdateShipping(u.orderId, u.orderItemCode, u.slipNo);
          c24Ok++;
          c24Html += `<li style="color:#27ae60">✅ ${u.orderId} → 카페24 등록 완료</li>`;
        } catch(e) {
          c24Fail++;
          c24Html += `<li style="color:#e74c3c">❌ ${u.orderId} → ${e.message}</li>`;
        }
      }
      c24Html += '</ul>';
      statusDiv.innerHTML += c24Html;

      if (c24Ok > 0) {
        statusDiv.innerHTML += `<br><strong style="color:#27ae60">🎉 로젠+카페24 모두 완료! (${c24Ok}건)</strong>`;
        showToast(`로젠 ${successCount}건 + 카페24 ${c24Ok}건 자동 등록 완료!`, 'success');
      } else {
        statusDiv.innerHTML += `<br><span style="color:#e67e22">⚠️ 카페24 등록 실패 — 카페24 설정을 확인해주세요.</span>`;
        showToast(`로젠 등록 완료, 카페24 등록 실패`, 'error');
      }
    } else if (successCount > 0) {
      statusDiv.innerHTML += `<br><strong style="color:#27ae60">✅ 로젠 ${successCount}건 등록 완료!</strong><br><span style="color:#888">⚠️ 운송장번호 미배정 건은 카페24 수동 등록 필요</span>`;
      showToast(`${successCount}건 로젠 등록 완료 (운송장번호 배정 후 카페24 등록하세요)`, 'warning');
    } else {
      showToast('로젠 등록 실패. 상세 내용을 확인하세요.', 'error');
    }

    // 인보이스 테이블 갱신 & 세션 저장
    if (successCount > 0) {
      renderInvoiceTable();
      saveSessionData();
    }

  } catch (err) {
    statusDiv.innerHTML = `<strong style="color:red">❌ 오류: ${err.message}</strong>`;
    showToast('로젠 등록 중 오류 발생', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🚀 로젠 자동 등록';
  }
}

// ============================================================
// 자동인쇄 (Auto Print)
// ============================================================

let _autoprintTimer = null;
let _autoprintFiredToday = false;  // 오늘 이미 실행했는지

function initAutoprint() {
  // DOM
  dom.autoprintTime = document.getElementById('autoprint-time');
  dom.autoprintEnabled = document.getElementById('autoprint-enabled');
  dom.autoprintToggleLabel = document.getElementById('autoprint-toggle-label');
  dom.autoprintStatusBadge = document.getElementById('autoprint-status-badge');
  dom.saveAutoprintBtn = document.getElementById('save-autoprint-btn');
  dom.testAutoprintBtn = document.getElementById('test-autoprint-btn');
  dom.autoprintLog = document.getElementById('autoprint-log');
  dom.autoprintNextRun = document.getElementById('autoprint-next-run');
  dom.autoprintNextTime = document.getElementById('autoprint-next-time');

  // 서버에서 설정 로드
  loadAutoprintSettings();

  // 이벤트
  dom.autoprintEnabled.addEventListener('change', () => {
    const on = dom.autoprintEnabled.checked;
    dom.autoprintToggleLabel.textContent = on ? 'ON' : 'OFF';
    dom.autoprintToggleLabel.style.color = on ? 'var(--success-color)' : 'var(--text-secondary)';
    dom.autoprintStatusBadge.textContent = on ? 'ON' : 'OFF';
    dom.autoprintStatusBadge.style.background = on ? 'var(--success-color)' : 'var(--text-secondary)';
  });

  dom.saveAutoprintBtn.addEventListener('click', saveAutoprintSettings);
  dom.testAutoprintBtn.addEventListener('click', () => executeAutoPrint(true));

  // 매분 체크 타이머 시작
  startAutoprintChecker();
}

async function loadAutoprintSettings() {
  try {
    const resp = await fetch('/api/config');
    if (!resp.ok) return;
    const cfg = await resp.json();
    if (cfg.autoprint) {
      dom.autoprintTime.value = cfg.autoprint.time || '15:00';
      dom.autoprintEnabled.checked = cfg.autoprint.enabled || false;
      dom.autoprintEnabled.dispatchEvent(new Event('change'));
    }
    if (cfg.autoprint_logs) {
      renderAutoprintLog(cfg.autoprint_logs);
    }
  } catch (e) { /* ignore */ }
  updateNextRunDisplay();
}

async function saveAutoprintSettings() {
  const settings = {
    time: dom.autoprintTime.value || '15:00',
    enabled: dom.autoprintEnabled.checked,
  };

  try {
    // 기존 config 읽고 autoprint만 업데이트
    const resp = await fetch('/api/config');
    const cfg = resp.ok ? await resp.json() : {};
    cfg.autoprint = settings;
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    });
    showToast('자동인쇄 설정이 저장되었습니다.', 'success');
    _autoprintFiredToday = false; // 시간 바뀌면 리셋
    updateNextRunDisplay();
  } catch (e) {
    showToast('설정 저장 실패: ' + e.message, 'error');
  }
}

function startAutoprintChecker() {
  // 매 30초마다 시간 체크
  if (_autoprintTimer) clearInterval(_autoprintTimer);
  _autoprintTimer = setInterval(checkAutoprintTime, 30000);
  // 즉시 한 번 체크
  checkAutoprintTime();
}

function checkAutoprintTime() {
  if (!dom.autoprintEnabled.checked) return;

  const now = new Date();
  const targetTime = dom.autoprintTime.value || '15:00';
  const [targetH, targetM] = targetTime.split(':').map(Number);

  const nowH = now.getHours();
  const nowM = now.getMinutes();

  // 날짜가 바뀌면 리셋
  const todayStr = now.toISOString().slice(0, 10);
  if (_autoprintLastDate && _autoprintLastDate !== todayStr) {
    _autoprintFiredToday = false;
  }
  _autoprintLastDate = todayStr;

  // 정확한 시각 ± 1분 이내 & 오늘 아직 안 실행
  if (nowH === targetH && Math.abs(nowM - targetM) <= 1 && !_autoprintFiredToday) {
    _autoprintFiredToday = true;
    console.log('[자동인쇄] 예약 시각 도달 - 실행합니다.');
    executeAutoPrint(false);
  }

  updateNextRunDisplay();
}

let _autoprintLastDate = new Date().toISOString().slice(0, 10);

function updateNextRunDisplay() {
  if (!dom.autoprintNextRun) return;
  if (!dom.autoprintEnabled.checked) {
    dom.autoprintNextRun.style.display = 'none';
    return;
  }

  const targetTime = dom.autoprintTime.value || '15:00';
  const [targetH, targetM] = targetTime.split(':').map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setHours(targetH, targetM, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  const diffMs = next - now;
  const diffH = Math.floor(diffMs / 3600000);
  const diffM = Math.floor((diffMs % 3600000) / 60000);

  dom.autoprintNextTime.textContent = `${next.toLocaleDateString('ko-KR')} ${targetTime} (${diffH}시간 ${diffM}분 후)`;
  dom.autoprintNextRun.style.display = 'block';
}

async function executeAutoPrint(isTest) {
  const logPrefix = isTest ? '[테스트]' : '[자동]';
  addAutoprintLog(`${logPrefix} 주문서 인쇄 시작...`, 'info');

  if (!appState.cafe24.mallId) {
    addAutoprintLog(`${logPrefix} 실패: 카페24 설정이 없습니다.`, 'error');
    showToast('카페24 설정을 먼저 완료해주세요.', 'error');
    return;
  }

  try {
    // 0+1. 서버 동기화 후 토큰 강제 갱신 (await 보장 → race condition 방지)
    await syncTokenFromServer();
    const refreshed = await forceRefreshToken();
    if (!refreshed) {
      addAutoprintLog(`${logPrefix} 토큰 갱신 실패 - 설정 탭에서 재인증 필요`, 'error');
      return;
    }

    // 2. 배송준비중(N20) 주문 가져오기 (최근 7일)
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const dateFrom = formatDate(weekAgo);
    const dateTo = formatDate(today);

    addAutoprintLog(`${logPrefix} 배송준비중 주문 조회 (${dateFrom} ~ ${dateTo})...`, 'info');

    const orders = await cafe24GetUnshippedOrders(dateFrom, dateTo);

    if (orders.length === 0) {
      addAutoprintLog(`${logPrefix} 배송준비중 주문 0건 - 인쇄 생략`, 'info');
      showToast('배송준비중 주문이 없습니다.', 'info');
      return;
    }

    addAutoprintLog(`${logPrefix} ${orders.length}건 조회 완료 → 주문서 인쇄 중...`, 'info');

    // 3. 주문서 인쇄
    // 테스트: 브라우저 window.print() (사용자가 다이얼로그에서 직접 클릭)
    // 자동:  서버 Playwright --kiosk-printing (다이얼로그 없이 바로 프린터 출력)
    if (isTest) {
      printOrderSheet(orders);
      addAutoprintLog(`${logPrefix} ${orders.length}건 주문서 인쇄 대화상자 열림 (직접 인쇄 클릭)`, 'success');
      showToast(`${orders.length}건 주문서 인쇄 시작!`, 'success');
    } else {
      await autoPrintOrderSheet(orders);
      addAutoprintLog(`${logPrefix} ${orders.length}건 자동 인쇄 완료 (프린터 직접 출력)`, 'success');
      showToast(`${orders.length}건 자동 인쇄 완료!`, 'success');
    }

    // 4. 로그 서버 저장
    saveAutoprintLog(`${logPrefix} ${orders.length}건 인쇄 완료`);

  } catch (err) {
    addAutoprintLog(`${logPrefix} 오류: ${err.message}`, 'error');
    showToast(`자동인쇄 실패: ${err.message}`, 'error');
  }
}

// 주문서 HTML 문자열 생성 (테스트/자동 공통)
function buildPrintHtml(orders) {
  const today = new Date().toLocaleDateString('ko-KR');
  const timeStr = new Date().toLocaleTimeString('ko-KR');

  let body = `<div style="font-family:'Malgun Gothic',sans-serif;font-size:12px;background:#fff;color:#000;padding:10px;">
<div style="text-align:right;font-size:10px;color:#999;margin-bottom:5px;">출력일: ${today} ${timeStr}</div>`;

  orders.forEach((order, i) => {
    const imgHtml = order.productImage
      ? `<img src="${esc(order.productImage)}" alt="상품이미지"
           style="width:150px;height:150px;object-fit:cover;border:1px solid #ddd;border-radius:4px;flex-shrink:0;"
           onerror="this.style.display='none'">`
      : `<div style="width:150px;height:150px;background:#f0f0f0;border:1px solid #ddd;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#999;font-size:12px;flex-shrink:0;">이미지 없음</div>`;

    body += `
<div style="page-break-after:${i < orders.length - 1 ? 'always' : 'auto'};border:2px solid #333;padding:16px;margin-bottom:10px;background:#fff;">
  <div style="text-align:center;font-size:18px;font-weight:bold;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:12px;">주문서 #${i + 1}</div>
  <div style="font-size:11px;color:#666;margin-bottom:8px;">주문번호: ${esc(order.orderId)}</div>
  <div style="font-size:36px;font-weight:900;margin:8px 0 12px 0;">${esc(order.receiverName)}</div>
  <div style="display:flex;margin-bottom:4px;"><span style="width:80px;font-weight:bold;color:#555;flex-shrink:0;">연락처:</span><span>${esc(order.receiverTel)}</span></div>
  <div style="display:flex;margin-bottom:4px;"><span style="width:80px;font-weight:bold;color:#555;flex-shrink:0;">주소:</span><span>${esc(order.receiverAddr)} ${esc(order.receiverAddrDetail)}</span></div>
  <div style="display:flex;margin-bottom:4px;"><span style="width:80px;font-weight:bold;color:#555;flex-shrink:0;">우편번호:</span><span>${esc(order.receiverZipcode)}</span></div>
  <div style="display:flex;gap:16px;align-items:flex-start;margin-top:12px;padding-top:10px;border-top:1px dashed #999;">
    ${imgHtml}
    <div style="flex:1;">
      <div style="font-size:36px;font-weight:900;line-height:1.2;margin-bottom:8px;">${esc(order.productName)}</div>
      ${order.productOption ? `<div style="font-size:28px;font-weight:700;color:#c0392b;margin-bottom:8px;">${esc(order.productOption)}</div>` : ''}
      <div style="font-size:36px;font-weight:900;color:#333;">${order.quantity}개</div>
    </div>
  </div>
  ${order.shippingMessage ? `<div style="margin-top:10px;padding-top:8px;border-top:1px dashed #999;"><div style="font-weight:bold;font-size:13px;margin-bottom:6px;">배송메모</div><div style="padding:6px;background:#f9f9f9;border-radius:4px;">${esc(order.shippingMessage)}</div></div>` : ''}
</div>`;
  });

  body += `</div>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;">${body}</body></html>`;
}

// 테스트 인쇄: 브라우저 frame에 주입 후 window.print() (사용자가 인쇄 버튼 클릭)
function printOrderSheet(orders) {
  const html = buildPrintHtml(orders);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const frame = document.getElementById('autoprint-frame');
  frame.innerHTML = doc.body.innerHTML;
  window.print();
  setTimeout(() => { frame.innerHTML = ''; }, 2000);
}

// 자동 인쇄: 서버에 Enter 예약 → window.print() 다이얼로그 자동 확인
async function autoPrintOrderSheet(orders) {
  // 서버에 2.5초 후 Enter 키 입력 예약 (다이얼로그 열리면 자동 확인)
  try {
    await fetch('/api/auto-print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delayMs: 2500 }),
    });
  } catch(e) { /* 무시 */ }

  // 테스트 인쇄와 동일하게 다이얼로그 열기 → 2.5초 후 서버가 Enter로 자동 클릭
  printOrderSheet(orders);
}

function addAutoprintLog(message, type) {
  if (!dom.autoprintLog) return;
  const now = new Date().toLocaleTimeString('ko-KR');
  const typeClass = type === 'error' ? 'log-error' : type === 'success' ? 'log-success' : '';

  // 첫 로그면 기본 메시지 제거
  if (dom.autoprintLog.querySelector('p')) {
    dom.autoprintLog.innerHTML = '';
  }

  const entry = document.createElement('div');
  entry.className = 'autoprint-log-entry';
  entry.innerHTML = `<span class="log-time">[${now}]</span> <span class="${typeClass}">${esc(message)}</span>`;
  dom.autoprintLog.prepend(entry);

  // 최대 50개 유지
  while (dom.autoprintLog.children.length > 50) {
    dom.autoprintLog.lastChild.remove();
  }
}

async function saveAutoprintLog(message) {
  try {
    const resp = await fetch('/api/config');
    const cfg = resp.ok ? await resp.json() : {};
    const logs = cfg.autoprint_logs || [];
    logs.unshift({ time: new Date().toISOString(), message });
    if (logs.length > 30) logs.length = 30; // 최근 30개만
    cfg.autoprint_logs = logs;
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    });
  } catch (e) { /* ignore */ }
}

function renderAutoprintLog(logs) {
  if (!logs || logs.length === 0 || !dom.autoprintLog) return;
  dom.autoprintLog.innerHTML = '';
  logs.forEach(log => {
    const entry = document.createElement('div');
    entry.className = 'autoprint-log-entry';
    const d = new Date(log.time);
    const timeStr = `${d.toLocaleDateString('ko-KR')} ${d.toLocaleTimeString('ko-KR')}`;
    const isErr = log.message.includes('실패') || log.message.includes('오류');
    const isOk = log.message.includes('완료');
    const cls = isErr ? 'log-error' : isOk ? 'log-success' : '';
    entry.innerHTML = `<span class="log-time">[${timeStr}]</span> <span class="${cls}">${esc(log.message)}</span>`;
    dom.autoprintLog.appendChild(entry);
  });
}

// ============================================================
// Initialize
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  init().then(() => {
    initAutoprint();
  });
});
