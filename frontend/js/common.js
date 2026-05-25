// common.js — DOM 헬퍼, 날짜 포맷 등 공통 유틸
// 규칙: DOM 삽입 시 textContent 사용, innerHTML 금지 (XSS 방어)

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return document.querySelectorAll(selector);
}

function show(el) {
  if (typeof el === 'string') el = $(el);
  if (el) el.style.display = '';
}

function hide(el) {
  if (typeof el === 'string') el = $(el);
  if (el) el.style.display = 'none';
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function todayString() {
  return formatDate(new Date().toISOString());
}

// 안전한 텍스트 노드 생성 (XSS 방어)
function createTextEl(tag, text, className) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}

// 에러 토스트 표시
function showError(message) {
  let toast = $('#error-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'error-toast';
    toast.style.cssText =
      'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
      'background:#E63946;color:#fff;padding:12px 24px;border-radius:12px;' +
      'font-weight:700;font-size:14px;z-index:9999;opacity:0;transition:opacity 0.3s;';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

// rarity 한글 표시
function rarityLabel(rarity) {
  const map = { normal: 'NORMAL', rare: 'RARE', ssr: 'SSR' };
  return map[rarity] || rarity.toUpperCase();
}

// --- 스탬프 사진 localStorage 관리 (서버 저장 X) ---
// 사진을 400px로 리사이즈 후 JPEG 압축하여 localStorage에 저장
function saveStampPhoto(stationId, dataUrl) {
  var img = new Image();
  img.onload = function() {
    var canvas = document.createElement('canvas');
    var maxW = 400;
    var ratio = maxW / img.width;
    canvas.width = maxW;
    canvas.height = img.height * ratio;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    var compressed = canvas.toDataURL('image/jpeg', 0.7);
    try {
      localStorage.setItem('stamp_photo_' + stationId, compressed);
    } catch (e) {
      // localStorage 용량 초과 시 무시
    }
  };
  img.src = dataUrl;
}

function getStampPhoto(stationId) {
  return localStorage.getItem('stamp_photo_' + stationId) || null;
}

// 사진 영역에 이미지 표시 (공통)
function displayPhotoInArea(photoArea, src) {
  var existing = photoArea.querySelector('img');
  if (existing) existing.remove();
  var img = document.createElement('img');
  img.src = src;
  img.alt = '차창 밖 풍경';
  photoArea.appendChild(img);
  var placeholder = photoArea.querySelector('.photo-placeholder');
  if (placeholder) placeholder.style.display = 'none';
}
