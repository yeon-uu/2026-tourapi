// collection.js — 기찻길 아카이브 페이지 로직
// 규칙: DOM 삽입은 textContent/createElement만 사용

requireAuth();

// 스탬프 데이터를 전역으로 저장 (모달용)
var stampMap = {};

async function loadCollection() {
  try {
    var stations = await getStations();
    var stamps = await getStamps();

    // 스탬프 맵 생성 (station_id → stamp 데이터)
    stamps.forEach(function(s) {
      stampMap[s.station_id] = s;
    });

    var stampedIds = new Set(stamps.map(function(s) { return s.station_id; }));

    // 노선별 그룹핑
    var lineMap = {};
    stations.forEach(function(s) {
      if (!lineMap[s.line_name]) lineMap[s.line_name] = [];
      lineMap[s.line_name].push({
        id: s.id,
        name: s.name,
        unlocked: stampedIds.has(s.id),
      });
    });

    var totalStations = stations.length;
    var collected = stampedIds.size;

    // 달성률 업데이트
    $('#total-rate').textContent = collected + ' / ' + totalStations + ' 역';
    var pct = totalStations > 0 ? (collected / totalStations * 100) : 0;
    $('#total-progress').style.width = pct + '%';

    // 기찻길 렌더링
    var container = $('#railway-container');
    container.textContent = '';

    Object.keys(lineMap).sort().forEach(function(lineName) {
      var stationList = lineMap[lineName];

      // 섹션
      var section = document.createElement('div');
      section.className = 'rail-section';

      // 노선 타이틀
      var title = document.createElement('div');
      title.className = 'rail-title';
      title.textContent = lineName;
      section.appendChild(title);

      // 트랙 컨테이너
      var trackContainer = document.createElement('div');
      trackContainer.className = 'track-container';

      var trackLine = document.createElement('div');
      trackLine.className = 'track-line';
      trackContainer.appendChild(trackLine);

      stationList.forEach(function(station) {
        var node = document.createElement('div');
        node.className = 'track-node' + (station.unlocked ? ' unlocked' : '');

        // 원형 아이콘
        var circle = document.createElement('div');
        circle.className = 'node-circle';
        var icon = document.createElement('i');
        icon.className = station.unlocked ? 'fa-solid fa-train' : 'fa-solid fa-lock';
        circle.appendChild(icon);

        // 역 이름
        var nameEl = document.createElement('div');
        nameEl.className = 'node-name';
        nameEl.textContent = station.name;

        node.appendChild(circle);
        node.appendChild(nameEl);

        if (!station.unlocked) {
          var lockLabel = document.createElement('div');
          lockLabel.style.cssText = 'font-size:10px; color:#ccc; margin-top:3px';
          lockLabel.textContent = '(잠금)';
          node.appendChild(lockLabel);
        } else {
          // 언락된 역 클릭 → 폴라로이드 모달
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

  // 저장된 사진 불러오기
  var modalPhoto = $('#modal-stamp-card .stamp-photo-area');
  var savedPhoto = getStampPhoto(stamp.station_id);
  var placeholder = modalPhoto.querySelector('.photo-placeholder');
  var existingImg = modalPhoto.querySelector('img');
  if (existingImg) existingImg.remove();

  if (savedPhoto) {
    displayPhotoInArea(modalPhoto, savedPhoto);
  } else if (placeholder) {
    placeholder.style.display = '';
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
