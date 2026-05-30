// collection.js — 기찻길 아카이브 페이지 로직
// 규칙: DOM 삽입은 textContent/createElement만 사용

requireAuth();

// 스탬프 데이터: station_id → [stamp, stamp, ...] (멀티카드 지원)
var stampsByStation = {};

// 모달 스와이프 상태
var modalCards = [];   // 현재 모달에 표시 중인 스탬프 배열
var modalIndex = 0;    // 현재 보고 있는 카드 인덱스

// 노선별 색상
var ROUTE_COLORS = {
  '경부선': '#E74C3C',
  '경강선(강릉선)': '#3498DB',
  '경전선': '#2ECC71',
  '전라선': '#9B59B6',
  '호남선': '#F39C12',
  '중앙선': '#1ABC9C',
  '중부내륙선': '#E67E22',
  '동해산타열차': '#E91E63'
};

async function loadCollection() {
  try {
    var results = await Promise.all([getStations(), getStamps(), getRoutes()]);
    var stations = results[0];
    var stamps = results[1];
    var routes = results[2];

    // station name → station 객체
    var stationByName = {};
    stations.forEach(function(s) { stationByName[s.name] = s; });

    // 스탬프를 station_id별 배열로 그룹핑
    stamps.forEach(function(s) {
      if (!stampsByStation[s.station_id]) {
        stampsByStation[s.station_id] = [];
      }
      stampsByStation[s.station_id].push(s);
    });

    var stampedIds = new Set(Object.keys(stampsByStation).map(Number));

    // 전체 달성률 (고유 역 수 기준)
    var totalStations = stations.length;
    var collected = stampedIds.size;
    $('#total-rate').textContent = collected + ' / ' + totalStations + ' 역';
    var pct = totalStations > 0 ? (collected / totalStations * 100) : 0;
    $('#total-progress').style.width = pct + '%';

    // 기찻길 렌더링
    var container = $('#railway-container');
    container.textContent = '';

    Object.keys(routes).forEach(function(routeName) {
      var stationNames = routes[routeName];
      var routeColor = ROUTE_COLORS[routeName] || '#999';

      var routeTotal = 0;
      var routeCollected = 0;
      var stationList = [];

      stationNames.forEach(function(name) {
        var st = stationByName[name];
        if (st) {
          routeTotal++;
          var unlocked = stampedIds.has(st.id);
          var cardCount = unlocked ? stampsByStation[st.id].length : 0;
          if (unlocked) routeCollected++;
          stationList.push({ id: st.id, name: st.name, unlocked: unlocked, cardCount: cardCount });
        }
      });

      // 섹션
      var section = document.createElement('div');
      section.className = 'rail-section';

      // 노선 헤더
      var header = document.createElement('div');
      header.className = 'route-header';

      var titleWrap = document.createElement('div');
      titleWrap.className = 'route-title-wrap';

      var colorDot = document.createElement('span');
      colorDot.className = 'route-color-dot';
      colorDot.style.background = routeColor;

      var titleText = document.createElement('span');
      titleText.className = 'route-title-text';
      titleText.textContent = routeName;

      var countBadge = document.createElement('span');
      countBadge.className = 'route-count';
      countBadge.textContent = routeCollected + '/' + routeTotal;
      if (routeCollected === routeTotal && routeTotal > 0) countBadge.classList.add('complete');

      titleWrap.appendChild(colorDot);
      titleWrap.appendChild(titleText);
      header.appendChild(titleWrap);
      header.appendChild(countBadge);
      section.appendChild(header);

      // 미니 진행바
      var miniTrack = document.createElement('div');
      miniTrack.className = 'route-mini-progress';
      var miniFill = document.createElement('div');
      miniFill.className = 'route-mini-fill';
      miniFill.style.width = (routeTotal > 0 ? (routeCollected / routeTotal * 100) : 0) + '%';
      miniFill.style.background = routeColor;
      miniTrack.appendChild(miniFill);
      section.appendChild(miniTrack);

      // 트랙
      var trackContainer = document.createElement('div');
      trackContainer.className = 'track-container';

      var trackLine = document.createElement('div');
      trackLine.className = 'track-line';
      trackLine.style.background = 'repeating-linear-gradient(90deg, ' + routeColor + '33, ' + routeColor + '33 10px, transparent 10px, transparent 15px)';
      trackContainer.appendChild(trackLine);

      stationList.forEach(function(station) {
        var node = document.createElement('div');
        node.className = 'track-node' + (station.unlocked ? ' unlocked' : '');

        var circle = document.createElement('div');
        circle.className = 'node-circle';
        if (station.unlocked) {
          circle.style.background = routeColor;
          circle.style.borderColor = routeColor;
        }
        var icon = document.createElement('i');
        icon.className = station.unlocked ? 'fa-solid fa-train' : 'fa-solid fa-lock';
        circle.appendChild(icon);

        // 멀티 카드 뱃지 (2장 이상일 때)
        if (station.cardCount > 1) {
          var badge = document.createElement('div');
          badge.className = 'multi-card-badge';
          badge.textContent = station.cardCount;
          circle.appendChild(badge);
        }

        var nameEl = document.createElement('div');
        nameEl.className = 'node-name';
        nameEl.textContent = station.name.replace('역', '');

        node.appendChild(circle);
        node.appendChild(nameEl);

        if (station.unlocked) {
          node.addEventListener('click', function() {
            openStampModal(station.id);
          });
        }

        trackContainer.appendChild(node);
      });

      section.appendChild(trackContainer);
      container.appendChild(section);
    });

    hide('#loading');

  } catch (e) {
    hide('#loading');
    showError('컬렉션을 불러올 수 없습니다');
  }
}

// --- 모달: 스탬프 카드 표시 ---
function renderModalCard(stamp) {
  $('#modal-station-name').textContent = stamp.station_name;
  $('#modal-rank').textContent = rarityLabel(stamp.rarity);
  $('#modal-rank').className = 'rank-badge ' + stamp.rarity;
  $('#modal-line').textContent = stamp.line_name;
  $('#modal-date').textContent = formatDate(stamp.acquired_at);
  $('#modal-author').textContent = 'by. ' + getNickname();

  // 카드 타입 라벨
  var typeLabel = $('#modal-card-type');
  typeLabel.className = 'card-type-label';
  if (stamp.card_type === 'special') {
    typeLabel.classList.add('type-special');
    typeLabel.textContent = 'SPECIAL';
  } else {
    typeLabel.classList.add('type-normal');
    typeLabel.textContent = 'NORMAL';
  }

  // 사진 영역
  var modalPhoto = $('#modal-photo-area');
  var placeholder = modalPhoto.querySelector('.photo-placeholder');
  var existingImg = modalPhoto.querySelector('img');
  if (existingImg) existingImg.remove();
  modalPhoto.classList.remove('illustration-locked');
  var oldCredit = modalPhoto.querySelector('.illust-credit');
  if (oldCredit) oldCredit.remove();

  if (stamp.illustration_url) {
    displayPhotoInArea(modalPhoto, stamp.illustration_url);
    modalPhoto.classList.add('illustration-locked');
    if (stamp.illustration_credit) {
      var credit = document.createElement('div');
      credit.className = 'illust-credit';
      credit.textContent = stamp.illustration_credit;
      modalPhoto.appendChild(credit);
    }
  } else {
    var savedPhoto = getStampPhoto(stamp.station_id);
    if (savedPhoto) {
      displayPhotoInArea(modalPhoto, savedPhoto);
    } else if (placeholder) {
      placeholder.style.display = '';
    }
  }

  // 카드 shimmer (special이면 적용)
  var card = $('#modal-stamp-card');
  card.classList.remove('special-modal');
  if (stamp.card_type === 'special') {
    card.classList.add('special-modal');
  }
}

// --- 스와이프 도트 렌더 ---
function renderSwipeDots() {
  var dotsEl = $('#swipe-dots');
  dotsEl.textContent = '';

  if (modalCards.length <= 1) {
    dotsEl.classList.remove('visible');
    return;
  }

  dotsEl.classList.add('visible');
  modalCards.forEach(function(_, i) {
    var dot = document.createElement('div');
    dot.className = 'swipe-dot' + (i === modalIndex ? ' active' : '');
    dot.addEventListener('click', function() {
      modalIndex = i;
      renderModalCard(modalCards[modalIndex]);
      renderSwipeDots();
    });
    dotsEl.appendChild(dot);
  });
}

// --- 화살표 표시/숨김 ---
function updateSwipeArrows() {
  var leftBtn = $('#swipe-left');
  var rightBtn = $('#swipe-right');

  if (modalCards.length <= 1) {
    leftBtn.style.display = 'none';
    rightBtn.style.display = 'none';
    return;
  }

  leftBtn.style.display = modalIndex > 0 ? 'flex' : 'none';
  rightBtn.style.display = modalIndex < modalCards.length - 1 ? 'flex' : 'none';
}

// --- 모달 열기 ---
function openStampModal(stationId) {
  var stamps = stampsByStation[stationId];
  if (!stamps || stamps.length === 0) {
    showError('스탬프 데이터를 찾을 수 없습니다');
    return;
  }

  modalCards = stamps;
  modalIndex = 0;

  renderModalCard(modalCards[0]);
  renderSwipeDots();
  updateSwipeArrows();

  $('#stamp-modal').classList.add('active');
}

// --- 화살표 클릭 ---
$('#swipe-left').addEventListener('click', function(e) {
  e.stopPropagation();
  if (modalIndex > 0) {
    modalIndex--;
    renderModalCard(modalCards[modalIndex]);
    renderSwipeDots();
    updateSwipeArrows();
  }
});

$('#swipe-right').addEventListener('click', function(e) {
  e.stopPropagation();
  if (modalIndex < modalCards.length - 1) {
    modalIndex++;
    renderModalCard(modalCards[modalIndex]);
    renderSwipeDots();
    updateSwipeArrows();
  }
});

// --- 터치 스와이프 ---
var touchStartX = 0;
var touchEndX = 0;

$('#stamp-modal').addEventListener('touchstart', function(e) {
  touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

$('#stamp-modal').addEventListener('touchend', function(e) {
  touchEndX = e.changedTouches[0].screenX;
  var diff = touchStartX - touchEndX;

  if (modalCards.length <= 1) return;

  if (diff > 50 && modalIndex < modalCards.length - 1) {
    // 왼쪽 스와이프 → 다음 카드
    modalIndex++;
    renderModalCard(modalCards[modalIndex]);
    renderSwipeDots();
    updateSwipeArrows();
  } else if (diff < -50 && modalIndex > 0) {
    // 오른쪽 스와이프 → 이전 카드
    modalIndex--;
    renderModalCard(modalCards[modalIndex]);
    renderSwipeDots();
    updateSwipeArrows();
  }
}, { passive: true });

// --- 모달 닫기 ---
$('#modal-close').addEventListener('click', function() {
  $('#stamp-modal').classList.remove('active');
});
$('#stamp-modal').addEventListener('click', function(e) {
  if (e.target === this) this.classList.remove('active');
});

loadCollection();
