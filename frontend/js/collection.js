// collection.js — 기찻길 아카이브 페이지 로직
// 규칙: DOM 삽입은 textContent/createElement만 사용

requireAuth();

// 스탬프 데이터를 전역으로 저장 (모달용)
var stampMap = {};

// 노선별 색상 (시각적 구분)
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
    // 3가지 데이터 동시 호출
    var results = await Promise.all([getStations(), getStamps(), getRoutes()]);
    var stations = results[0];
    var stamps = results[1];
    var routes = results[2];

    // station name → station 객체 맵
    var stationByName = {};
    stations.forEach(function(s) {
      stationByName[s.name] = s;
    });

    // 스탬프 맵 생성 (station_id → stamp 데이터)
    stamps.forEach(function(s) {
      stampMap[s.station_id] = s;
    });
    var stampedIds = new Set(stamps.map(function(s) { return s.station_id; }));

    var totalStations = stations.length;
    var collected = stampedIds.size;

    // 전체 달성률 업데이트
    $('#total-rate').textContent = collected + ' / ' + totalStations + ' 역';
    var pct = totalStations > 0 ? (collected / totalStations * 100) : 0;
    $('#total-progress').style.width = pct + '%';

    // 기찻길 렌더링 (ROUTES 순서대로)
    var container = $('#railway-container');
    container.textContent = '';

    var routeNames = Object.keys(routes);
    routeNames.forEach(function(routeName) {
      var stationNames = routes[routeName];
      var routeColor = ROUTE_COLORS[routeName] || '#999';

      // 이 노선의 수집 현황 계산
      var routeTotal = 0;
      var routeCollected = 0;
      var stationList = [];

      stationNames.forEach(function(name) {
        var st = stationByName[name];
        if (st) {
          routeTotal++;
          var unlocked = stampedIds.has(st.id);
          if (unlocked) routeCollected++;
          stationList.push({ id: st.id, name: st.name, unlocked: unlocked });
        }
      });

      // 섹션
      var section = document.createElement('div');
      section.className = 'rail-section';

      // 노선 헤더 (이름 + 수집률)
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
      if (routeCollected === routeTotal && routeTotal > 0) {
        countBadge.classList.add('complete');
      }

      titleWrap.appendChild(colorDot);
      titleWrap.appendChild(titleText);
      header.appendChild(titleWrap);
      header.appendChild(countBadge);
      section.appendChild(header);

      // 노선 미니 진행바
      var miniTrack = document.createElement('div');
      miniTrack.className = 'route-mini-progress';
      var miniFill = document.createElement('div');
      miniFill.className = 'route-mini-fill';
      miniFill.style.width = (routeTotal > 0 ? (routeCollected / routeTotal * 100) : 0) + '%';
      miniFill.style.background = routeColor;
      miniTrack.appendChild(miniFill);
      section.appendChild(miniTrack);

      // 트랙 컨테이너
      var trackContainer = document.createElement('div');
      trackContainer.className = 'track-container';

      var trackLine = document.createElement('div');
      trackLine.className = 'track-line';
      trackLine.style.background = 'repeating-linear-gradient(90deg, ' + routeColor + '33, ' + routeColor + '33 10px, transparent 10px, transparent 15px)';
      trackContainer.appendChild(trackLine);

      stationList.forEach(function(station) {
        var node = document.createElement('div');
        node.className = 'track-node' + (station.unlocked ? ' unlocked' : '');

        // 원형 아이콘
        var circle = document.createElement('div');
        circle.className = 'node-circle';
        if (station.unlocked) {
          circle.style.background = routeColor;
          circle.style.borderColor = routeColor;
        }
        var icon = document.createElement('i');
        icon.className = station.unlocked ? 'fa-solid fa-train' : 'fa-solid fa-lock';
        circle.appendChild(icon);

        // 역 이름
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

// --- 스탬프 폴라로이드 모달 ---
function openStampModal(stationId) {
  var stamp = stampMap[stationId];
  if (!stamp) {
    showError('스탬프 데이터를 찾을 수 없습니다');
    return;
  }

  $('#modal-station-name').textContent = stamp.station_name;
  $('#modal-rank').textContent = rarityLabel(stamp.rarity);
  $('#modal-rank').className = 'rank-badge ' + stamp.rarity;
  $('#modal-line').textContent = stamp.line_name;
  $('#modal-date').textContent = formatDate(stamp.acquired_at);
  $('#modal-author').textContent = 'by. ' + getNickname();

  // 사진 영역 초기화
  var modalPhoto = $('#modal-photo-area');
  var placeholder = modalPhoto.querySelector('.photo-placeholder');
  var existingImg = modalPhoto.querySelector('img');
  if (existingImg) existingImg.remove();
  modalPhoto.classList.remove('illustration-locked');
  var oldCredit = modalPhoto.querySelector('.illust-credit');
  if (oldCredit) oldCredit.remove();

  if (stamp.illustration_url) {
    // 일러스트 카드
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

  $('#stamp-modal').classList.add('active');
}

// 모달 닫기 — X 버튼
$('#modal-close').addEventListener('click', function() {
  $('#stamp-modal').classList.remove('active');
});

// 모달 닫기 — 배경 클릭
$('#stamp-modal').addEventListener('click', function(e) {
  if (e.target === this) {
    this.classList.remove('active');
  }
});

loadCollection();
