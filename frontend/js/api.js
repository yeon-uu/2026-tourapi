// api.js — 모든 API 호출의 단일 진입점
// 규칙: 페이지별 JS는 이 파일의 함수만 호출, 직접 fetch 금지

const BASE_URL = '/api/v1';

async function request(method, path, { body = null, stream = false } = {}) {
  const headers = {};
  const token = localStorage.getItem('access_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const opts = { method, headers };

  if (body !== null) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, opts);

  if (res.status === 401) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('nickname');
    window.location.href = '/login.html';
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new ApiError(res.status, err.detail || 'Request failed');
  }

  if (stream) {
    return res; // SSE — caller handles the stream
  }

  return res.json();
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// --- Auth ---
function guestLogin(nickname, departureStationId) {
  return request('POST', '/auth/guest', {
    body: { nickname, departure_station_id: departureStationId },
  });
}

// --- Stations ---
function getStations() {
  return request('GET', '/stations');
}

// --- Gacha ---
function drawGacha() {
  return request('POST', '/gacha/draw');
}

function getGachaHistory() {
  return request('GET', '/gacha/history');
}

// --- Checklists ---
function getChecklist(drawId) {
  return request('GET', `/checklists/${drawId}`);
}

function generateChecklist(drawId, themes) {
  var body = undefined;
  if (themes && themes.length > 0) {
    body = { themes: themes };
  }
  return request('POST', `/checklists/${drawId}/generate`, { body: body });
}

function toggleMission(checklistId, seq) {
  return request('PATCH', `/checklists/${checklistId}/missions/${seq}`);
}

function completeChecklist(checklistId) {
  return request('POST', `/checklists/${checklistId}/complete`);
}

// --- Stamps ---
function getStamps() {
  return request('GET', '/stamps');
}

function getStampStats() {
  return request('GET', '/stamps/stats');
}
