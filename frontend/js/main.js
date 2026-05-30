// main.js — index.html 로직 (뽑기 + 미션 + 스탬프 받기)
// 규칙: API 호출은 api.js 함수만 사용, DOM 삽입은 textContent만 사용

requireAuth();

// --- 상태 ---
let currentDraw = null;    // { draw_id, station_id, station_name, line_name, train_type, requires_transfer, rarity, remaining_draws }
let currentChecklist = null; // { id, draw_id, missions, status }
let remainingDraws = 5;
const MAX_DRAWS = 5;

// --- 화면 전환 ---
function showStep(stepId) {
  $$('.screen').forEach(function(el) { el.classList.remove('active'); });
  $('#' + stepId).classList.add('active');
  updateFlowProgress(stepId);
}

// --- 3단계 진행바 ---
function updateFlowProgress(stepId) {
  var bar = $('#flow-progress');
  var s1 = $('#fp-step-1'), s2 = $('#fp-step-2'), s3 = $('#fp-step-3');
  var l1 = $('#fp-line-1'), l2 = $('#fp-line-2');

  // 스탬프 화면에서는 진행바 숨김
  if (stepId === 'step-stamp') {
    bar.classList.remove('visible');
    return;
  }

  // 뽑기/채팅/미션 화면에서만 보임
  bar.classList.add('visible');

  // 초기화
  [s1, s2, s3].forEach(function(s) { s.className = 'flow-step'; });
  [l1, l2].forEach(function(l) { l.className = 'flow-line'; });

  if (stepId === 'step-draw') {
    s1.classList.add('active');
  } else if (stepId === 'step-chat') {
    s1.classList.add('completed');
    l1.classList.add('filled');
    s2.classList.add('active');
  } else if (stepId === 'step-mission') {
    s1.classList.add('completed');
    s2.classList.add('completed');
    s3.classList.add('completed');
    l1.classList.add('filled');
    l2.classList.add('filled');
  }
}

// --- 초기화 ---
updateDrawButton();
updateFlowProgress('step-draw');

// --- 내비게이션 ---
$('#btn-home').addEventListener('click', function() {
  window.location.reload();
});

$('#btn-collection-1').addEventListener('click', function() {
  window.location.href = '/collection.html';
});

$('#btn-collection-2').addEventListener('click', function() {
  window.location.href = '/collection.html';
});

$('#btn-back-draw').addEventListener('click', function() {
  showStep('step-draw');
});

$('#btn-back-chat').addEventListener('click', function() {
  showStep('step-draw');
});

// 채팅 완료 버튼 (chat.js에서도 사용)
$('#chat-finish-btn').addEventListener('click', function() {
  completeChatSelection();
});

// ===== 1. 뽑기 =====
$('#main-draw-btn').addEventListener('click', drawCard);
$('#btn-retry').addEventListener('click', resetCard);
$('#btn-mission').addEventListener('click', startChat);  // 채팅 UI로 이동

async function drawCard() {
  var btn = $('#main-draw-btn');
  btn.disabled = true;

  try {
    // API 호출 (연출 시작 전에 데이터 먼저 확보)
    currentDraw = await drawGacha();
    remainingDraws = currentDraw.remaining_draws;

    // 카드 앞면 업데이트 (textContent 사용)
    $('#res-name').textContent = currentDraw.station_name;
    $('#res-line').textContent = currentDraw.line_name;
    $('#res-rank').textContent = rarityLabel(currentDraw.rarity);
    $('#res-rank').className = 'rank-badge ' + currentDraw.rarity;

    // 환승 태그
    if (currentDraw.requires_transfer) {
      show('#res-transfer');
    } else {
      hide('#res-transfer');
    }

    // 카드 스타일 (일러스트 있으면 special 클래스 추가)
    var cardFront = $('#card-result');
    var isSpecial = !!currentDraw.illustration_url;
    cardFront.className = 'card-face card-front ' + currentDraw.rarity + (isSpecial ? ' special' : '');

    // 특별카드 배지
    var oldBadge = cardFront.querySelector('.special-badge');
    if (oldBadge) oldBadge.remove();
    if (isSpecial) {
      var badge = document.createElement('div');
      badge.className = 'special-badge';
      badge.textContent = 'SPECIAL';
      cardFront.appendChild(badge);
    }

    updateDrawButton();

    // === 운명 연출 시퀀스 ===
    playFateAnimation();

  } catch (e) {
    showError(e.message);
    btn.disabled = false;
  }
}

function playFateAnimation() {
  var cardInner = $('#card-inner');
  var overlay = $('#fate-overlay');
  var fateText = $('#fate-text');
  var fateTrain = $('#fate-train');
  var cardBack = cardInner.querySelector('.card-back');

  // 카드 뒷면 내용물 숨기기 (주황 배경만 남김)
  cardBack.classList.add('hide-content');

  // 1단계: 카드 흔들림 + 자막 등장 (2초)
  overlay.classList.add('active');
  cardInner.classList.add('is-shaking');
  fateText.classList.add('animate');

  // 2단계: 자막 사라지고 기차 지나감 (2초)
  setTimeout(function() {
    fateTrain.classList.add('animate');
  }, 2000);

  // 3단계: 연출 종료 → 카드 뒤집기 (4초 후)
  setTimeout(function() {
    cardInner.classList.remove('is-shaking');
    overlay.classList.remove('active');
    fateText.classList.remove('animate');
    fateTrain.classList.remove('animate');

    cardInner.classList.add('is-flipped');
    triggerSparkles();
    hide('#draw-controls');
    show('#result-actions');

    // 두두 가이드 메시지 업데이트 (사업 정보는 AI 서버 연결 후 교체)
    $('#dudu-guide-text').textContent = currentDraw.station_name + '역에 도착했다멍! 🚂';
    $('#result-actions').style.display = 'flex';
  }, 4000);
}

function resetCard() {
  var cardInner = $('#card-inner');
  var cardBack = cardInner.querySelector('.card-back');
  var canvas = $('#sparkle-canvas');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  cardInner.classList.remove('is-flipped');
  cardBack.classList.remove('hide-content');

  // 두두 가이드 메시지 원복
  $('#dudu-guide-text').textContent = '어서 뽑기 버튼을 눌러봐라 멍! 🐾';

  setTimeout(function() {
    show('#draw-controls');
    hide('#result-actions');
    $('#main-draw-btn').disabled = false;
  }, 300);
}

function updateDrawButton() {
  $('#draw-count-display').textContent = '(' + remainingDraws + '/' + MAX_DRAWS + '회)';
  if (remainingDraws <= 0) {
    $('#main-draw-btn').disabled = true;
  }
}

// ===== 2. 미션 =====
// receiveMissionWithThemes: chat.js에서 테마 선택 후 호출됨
async function receiveMissionWithThemes(themes) {
  if (!currentDraw) return;

  showStep('step-mission');
  $('#nav-station-title').textContent = currentDraw.station_name + ' 체크리스트';

  // 미니 카드 정보 (textContent 사용)
  var miniInfo = $('#mission-mini-info');
  miniInfo.textContent = '';
  var badge = createTextEl('span', rarityLabel(currentDraw.rarity), 'rank-badge ' + currentDraw.rarity);
  badge.style.marginBottom = '10px';
  var nameEl = createTextEl('h3', currentDraw.station_name);
  nameEl.style.cssText = 'margin:0; font-size:20px; color:#3D3D3D';
  var lineEl = createTextEl('p', currentDraw.line_name);
  lineEl.style.cssText = 'font-size:14px; color:#666; margin:5px 0';
  miniInfo.appendChild(badge);
  miniInfo.appendChild(nameEl);
  miniInfo.appendChild(lineEl);

  // 선택한 테마 태그 표시
  if (themes && themes.length > 0) {
    var themeWrap = document.createElement('div');
    themeWrap.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; justify-content:center';
    themes.forEach(function(t) {
      var tag = createTextEl('span', themeLabel(t), 'card-info-tag');
      tag.style.cssText = 'background:var(--primary-light); color:var(--accent-color); padding:4px 10px; border-radius:10px; font-size:12px; font-weight:700';
      themeWrap.appendChild(tag);
    });
    miniInfo.appendChild(themeWrap);
  }

  // 미션 목록 초기화
  var listEl = $('#mission-checklist');
  listEl.textContent = '';

  // 로딩 표시
  show('#mission-loading');

  try {
    // 기존 체크리스트가 있는지 먼저 확인
    try {
      currentChecklist = await getChecklist(currentDraw.draw_id);
    } catch (e) {
      if (e.status === 404) {
        // 없으면 생성 (테마 전달)
        currentChecklist = await generateChecklist(currentDraw.draw_id, themes);
      } else {
        throw e;
      }
    }

    hide('#mission-loading');
    renderMissions();

  } catch (e) {
    hide('#mission-loading');
    showError('미션 생성에 실패했습니다: ' + e.message);
  }
}

// 테마 한글 라벨
function themeLabel(theme) {
  var map = {
    food: '🍔 맛집',
    nature: '🌲 자연',
    culture: '🏛️ 역사',
    random: '🎲 랜덤'
  };
  return map[theme] || theme;
}

function renderMissions() {
  var listEl = $('#mission-checklist');
  listEl.textContent = '';

  currentChecklist.missions.forEach(function(m) {
    var li = document.createElement('li');
    li.className = 'mission-item' + (m.completed ? ' completed' : '');
    li.dataset.seq = m.seq;

    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = m.completed;
    checkbox.id = 'mission-' + m.seq;
    checkbox.addEventListener('change', function() {
      onMissionToggle(m.seq, this);
    });

    var label = document.createElement('label');
    label.setAttribute('for', 'mission-' + m.seq);
    label.textContent = m.title;

    li.appendChild(checkbox);
    li.appendChild(label);
    listEl.appendChild(li);
  });

  updateProgress();
}

var missionToggleLock = false;

async function onMissionToggle(seq, checkbox) {
  if (missionToggleLock) {
    checkbox.checked = !checkbox.checked; // 원복
    return;
  }
  missionToggleLock = true;
  checkbox.disabled = true;

  try {
    var result = await toggleMission(currentChecklist.id, seq);

    // 로컬 상태 업데이트
    currentChecklist.missions.forEach(function(m) {
      if (m.seq === seq) m.completed = result.completed;
    });

    // 체크박스 상태를 서버 결과와 동기화
    checkbox.checked = result.completed;

    // UI 업데이트
    var li = checkbox.closest('.mission-item');
    if (result.completed) {
      li.classList.add('completed');
    } else {
      li.classList.remove('completed');
    }

    updateProgress();

  } catch (e) {
    // 실패 시 체크박스 원복
    checkbox.checked = !checkbox.checked;
    showError('미션 업데이트 실패');
  }

  checkbox.disabled = false;
  missionToggleLock = false;
}

function updateProgress() {
  var missions = currentChecklist.missions;
  var total = missions.length;
  var done = missions.filter(function(m) { return m.completed; }).length;

  $('#progress-text').textContent = '진행률: ' + done + ' / ' + total + ' 완료';
  $('#progress-fill').style.width = (total > 0 ? (done / total * 100) : 0) + '%';

  var stampBtn = $('#stamp-btn');
  if (done === total && total > 0) {
    stampBtn.disabled = false;
    stampBtn.classList.add('active');
  } else {
    stampBtn.disabled = true;
    stampBtn.classList.remove('active');
  }
}

// ===== 3. 스탬프 받기 =====
$('#stamp-btn').addEventListener('click', claimStamp);

async function claimStamp() {
  var btn = $('#stamp-btn');
  btn.disabled = true;

  if (!currentChecklist || !currentChecklist.id) {
    showError('체크리스트 정보가 없습니다. 다시 시도해주세요.');
    btn.disabled = false;
    return;
  }

  try {
    // 서버 상태와 동기화 후 완료 요청
    var freshChecklist = await getChecklist(currentDraw.draw_id);
    var allDone = freshChecklist.missions.every(function(m) { return m.completed; });
    if (!allDone) {
      // 서버에서 미완료 미션이 있으면 로컬 상태 동기화 후 안내
      currentChecklist.missions = freshChecklist.missions;
      renderMissions();
      showError('완료되지 않은 미션이 있습니다. 다시 체크해주세요.');
      btn.disabled = false;
      return;
    }

    var result = await completeChecklist(currentChecklist.id);
    var stamp = result.stamp;

    // 폴라로이드 카드 업데이트 (textContent)
    $('#stamp-station-name').textContent = stamp.station_name;
    $('#stamp-rank').textContent = rarityLabel(stamp.rarity);
    $('#stamp-rank').className = 'rank-badge ' + stamp.rarity;
    $('#stamp-line').textContent = stamp.line_name;
    $('#stamp-date').textContent = formatDate(stamp.acquired_at);
    $('#stamp-author').textContent = 'by. ' + getNickname();

    // 사진 영역 — 일러스트 카드면 잠금 + 일러스트 표시
    var photoArea = $('#stamp-photo-area');
    photoArea.classList.remove('illustration-locked');
    var oldCredit = photoArea.querySelector('.illust-credit');
    if (oldCredit) oldCredit.remove();

    if (currentDraw.illustration_url) {
      // 일러스트 카드: 사진 영역 잠금 + 일러스트 표시
      displayPhotoInArea(photoArea, currentDraw.illustration_url);
      photoArea.classList.add('illustration-locked');
      if (currentDraw.illustration_credit) {
        var credit = document.createElement('div');
        credit.className = 'illust-credit';
        credit.textContent = currentDraw.illustration_credit;
        photoArea.appendChild(credit);
      }
    } else {
      // 일반 카드: 저장 사진 또는 플레이스홀더
      var savedPhoto = getStampPhoto(stamp.station_id);
      if (savedPhoto) {
        displayPhotoInArea(photoArea, savedPhoto);
      } else {
        var existingImg = photoArea.querySelector('img');
        if (existingImg) existingImg.remove();
        show('#photo-placeholder');
      }
    }

    // 완료 미션 목록 (textContent)
    var missionList = $('#stamp-mission-list');
    missionList.textContent = '';
    currentChecklist.missions.forEach(function(m) {
      var li = document.createElement('li');
      var icon = document.createElement('i');
      icon.className = 'fa-solid fa-check';
      var span = document.createElement('span');
      span.textContent = m.title;
      li.appendChild(icon);
      li.appendChild(span);
      missionList.appendChild(li);
    });

    // share.html + 컬렉션 모달용 sessionStorage 저장
    var stampData = {
      station_id: stamp.station_id,
      station_name: stamp.station_name,
      line_name: stamp.line_name,
      rarity: stamp.rarity,
      acquired_at: stamp.acquired_at,
      missions: currentChecklist.missions.map(function(m) { return m.title; }),
      illustration_url: currentDraw.illustration_url || null,
      illustration_credit: currentDraw.illustration_credit || null
    };
    sessionStorage.setItem('last_stamp', JSON.stringify(stampData));

    showStep('step-stamp');
    triggerStampSparkles();

  } catch (e) {
    if (e.status === 409) {
      showError('이미 스탬프를 받은 역입니다');
    } else if (e.status === 400) {
      showError('모든 미션을 완료해주세요');
    } else {
      showError('스탬프 받기 실패: ' + e.message);
    }
    btn.disabled = false;
  }
}

// ===== 사진 업로드 =====
$('#stamp-photo-area').addEventListener('click', function() {
  // 일러스트 카드면 사진 업로드 차단
  if (this.classList.contains('illustration-locked')) return;
  $('#stamp-photo-input').click();
});

$('#stamp-photo-input').addEventListener('change', function(e) {
  var file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showError('사진은 5MB 이하만 가능합니다');
    e.target.value = '';
    return;
  }

  var reader = new FileReader();
  reader.onload = function(ev) {
    var photoArea = $('#stamp-photo-area');
    displayPhotoInArea(photoArea, ev.target.result);

    // localStorage에 압축 저장 (같은 폰에서 계속 보임)
    if (currentDraw) {
      saveStampPhoto(currentDraw.station_id, ev.target.result);
    }
  };
  reader.readAsDataURL(file);
});

// ===== 카드 이미지 저장 (Safari 호환) =====
$('#btn-save-stamp').addEventListener('click', function() {
  var btn = this;
  btn.disabled = true;
  btn.textContent = '저장 중...';

  var stationName = $('#stamp-station-name').textContent || 'card';
  saveCardAsImage($('#stamp-card'), stationName, function() {
    btn.disabled = false;
    btn.textContent = '';
    var icon = document.createElement('i');
    icon.className = 'fa-solid fa-download';
    btn.appendChild(icon);
    btn.appendChild(document.createTextNode(' 저장'));
  });
});

// ===== 파티클 효과 =====
function triggerSparkles() {
  var canvas = $('#sparkle-canvas');
  var ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.offsetWidth;
  canvas.height = canvas.parentElement.offsetHeight;
  var particles = [];
  for (var i = 0; i < 60; i++) {
    particles.push({
      x: canvas.width / 2, y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 15, vy: (Math.random() - 0.5) * 15 - 5,
      size: Math.random() * 5 + 3,
      color: 'hsla(' + (Math.random() * 60 + 40) + ',100%,70%,',
      alpha: 1
    });
  }
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var alive = false;
    particles.forEach(function(p) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.alpha -= 0.015;
      if (p.alpha > 0) {
        alive = true;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + p.alpha + ')';
        ctx.fill();
      }
    });
    if (alive) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  animate();
}

function triggerStampSparkles() {
  var canvas = $('#stamp-canvas');
  var ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.offsetWidth;
  canvas.height = canvas.parentElement.offsetHeight;
  var particles = [];
  for (var i = 0; i < 100; i++) {
    particles.push({
      x: canvas.width / 2, y: canvas.height / 2 + 50,
      vx: (Math.random() - 0.5) * 25, vy: (Math.random() - 0.5) * 25 - 8,
      size: Math.random() * 6 + 4,
      color: 'hsla(' + (Math.random() * 360) + ',100%,60%,',
      alpha: 1
    });
  }
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var alive = false;
    particles.forEach(function(p) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.alpha -= 0.01;
      if (p.alpha > 0) {
        alive = true;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + p.alpha + ')';
        ctx.fill();
      }
    });
    if (alive) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  animate();
}
