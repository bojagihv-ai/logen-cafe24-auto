(function () {
  'use strict';

  const SERVER = 'http://localhost:8080';

  function getEmpId() {
    try {
      return window.fixCustCd || window.EMP_ID || window.empId
          || window.BASE_PC_EMP_CD || '';
    } catch (_) { return ''; }
  }

  function pushToken() {
    const token = document.body.id || '';
    if (!token || token.length < 20 || token === 'null') return false;

    const empId = getEmpId();

    fetch(SERVER + '/store-logen-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token:    token,
        pageId:   'lrm01f0050',
        userInfo: '',
        empId:    String(empId),
      }),
    })
    .then(() => console.log('[kuaai] 로젠 토큰 자동 저장 완료 (len=' + token.length + ')'))
    .catch(e  => console.warn('[kuaai] 토큰 저장 실패 (서버 꺼짐?)', e.message));

    return true;
  }

  // document_idle 시점에 즉시 시도
  if (!pushToken()) {
    // JWT가 아직 없으면 1초, 3초 후 재시도 (로그인 애니메이션 후 설정될 수 있음)
    setTimeout(() => { if (!pushToken()) setTimeout(pushToken, 2000); }, 1000);
  }

  console.log('[kuaai] 로젠 토큰 릴레이 v1.2 준비 ✓');
})();
