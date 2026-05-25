// auth.js — JWT 토큰 관리 + 인증 상태 확인

function saveAuth(data) {
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('user_id', data.user_id);
  localStorage.setItem('nickname', data.nickname);
}

function getToken() {
  return localStorage.getItem('access_token');
}

function getNickname() {
  return localStorage.getItem('nickname') || '';
}

function getUserId() {
  return localStorage.getItem('user_id');
}

function isLoggedIn() {
  return !!getToken();
}

function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user_id');
  localStorage.removeItem('nickname');
  window.location.href = '/login.html';
}

// 로그인 필수 페이지에서 호출 — 토큰 없으면 로그인으로 리다이렉트
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

// 로그인 페이지에서 호출 — 토큰 있으면 메인으로 리다이렉트
function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    window.location.href = '/index.html';
    return true;
  }
  return false;
}
