// chat.js — 두두 대화 + 취향 선택 UI
// 규칙: DOM 삽입은 createElement + textContent만 사용 (XSS 방어)

// --- 상태 ---
var chatSelectedThemes = [];
var chatAvailableOptions = [];

var CHAT_OPTIONS = [
  { id: 'food', text: '🍔 맛집 털기', theme: 'food' },
  { id: 'nature', text: '🌲 자연 힐링', theme: 'nature' },
  { id: 'culture', text: '🏛️ 역사 탐방', theme: 'culture' },
  { id: 'random', text: '🎲 두두 맘대로', theme: 'random' }
];

// --- 시간 포맷 ---
function getChatTime() {
  var now = new Date();
  var h = now.getHours();
  var m = now.getMinutes();
  var ampm = h >= 12 ? '오후' : '오전';
  h = h % 12 || 12;
  return ampm + ' ' + h + ':' + String(m).padStart(2, '0');
}

// --- 두두 메시지 추가 (safe DOM creation) ---
// lines: string[] — 각 줄이 <br>로 구분됨
function addDuduChatMsg(lines) {
  if (typeof lines === 'string') lines = [lines];

  var container = $('#chat-container');

  var row = document.createElement('div');
  row.className = 'chat-msg-row chat-agent-msg';

  // 프로필
  var profileWrap = document.createElement('div');
  profileWrap.className = 'chat-profile-wrap';

  var avatar = document.createElement('div');
  avatar.className = 'chat-agent-avatar';
  var avatarImg = document.createElement('img');
  avatarImg.src = '/images/dudu_v2.png';
  avatarImg.alt = '두두';
  avatar.appendChild(avatarImg);

  var nameEl = document.createElement('div');
  nameEl.className = 'chat-agent-name';
  nameEl.textContent = '가이드 두두';

  profileWrap.appendChild(avatar);
  profileWrap.appendChild(nameEl);
  row.appendChild(profileWrap);

  // 말풍선
  var bubble = document.createElement('div');
  bubble.className = 'chat-bubble-left';
  lines.forEach(function(line, i) {
    if (i > 0) bubble.appendChild(document.createElement('br'));
    bubble.appendChild(document.createTextNode(line));
  });
  row.appendChild(bubble);

  // 시간
  var timeEl = document.createElement('div');
  timeEl.className = 'chat-msg-time';
  timeEl.textContent = getChatTime();
  row.appendChild(timeEl);

  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

// --- 유저 메시지 추가 ---
function addUserChatMsg(text) {
  var container = $('#chat-container');

  var row = document.createElement('div');
  row.className = 'chat-msg-row chat-user-msg';

  var bubble = document.createElement('div');
  bubble.className = 'chat-bubble-right';
  bubble.textContent = text;
  row.appendChild(bubble);

  var timeEl = document.createElement('div');
  timeEl.className = 'chat-msg-time';
  timeEl.textContent = getChatTime();
  row.appendChild(timeEl);

  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

// --- 타이핑 인디케이터 ---
function showChatTyping() {
  var container = $('#chat-container');

  var row = document.createElement('div');
  row.className = 'chat-msg-row chat-agent-msg';
  row.id = 'chat-typing-indicator';

  var profileWrap = document.createElement('div');
  profileWrap.className = 'chat-profile-wrap';

  var avatar = document.createElement('div');
  avatar.className = 'chat-agent-avatar';
  var avatarImg = document.createElement('img');
  avatarImg.src = '/images/dudu_v2.png';
  avatarImg.alt = '두두';
  avatar.appendChild(avatarImg);

  var nameEl = document.createElement('div');
  nameEl.className = 'chat-agent-name';
  nameEl.textContent = '가이드 두두';

  profileWrap.appendChild(avatar);
  profileWrap.appendChild(nameEl);
  row.appendChild(profileWrap);

  var bubble = document.createElement('div');
  bubble.className = 'chat-bubble-left';
  bubble.style.padding = '10px 15px';

  var typing = document.createElement('div');
  typing.className = 'chat-typing';
  for (var i = 0; i < 3; i++) {
    var dot = document.createElement('div');
    dot.className = 'chat-dot';
    typing.appendChild(dot);
  }
  bubble.appendChild(typing);
  row.appendChild(bubble);

  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

function hideChatTyping() {
  var el = document.getElementById('chat-typing-indicator');
  if (el) el.remove();
}

// --- 칩 렌더링 ---
function renderChatChips() {
  var chipsEl = $('#chat-chips');
  var finishBtn = $('#chat-finish-btn');
  chipsEl.textContent = '';

  // 남은 옵션이 없으면 완료 버튼만
  if (chatAvailableOptions.length === 0) {
    finishBtn.style.display = 'block';
    finishBtn.textContent = '오케이 완료! 미션 만들어줘 🚀';
    return;
  }

  // 개별 옵션 칩
  chatAvailableOptions.forEach(function(opt) {
    var btn = document.createElement('button');
    btn.className = 'chat-chip-btn';
    btn.textContent = opt.text;
    btn.addEventListener('click', function() {
      handleChatOptionSelect(opt);
    });
    chipsEl.appendChild(btn);
  });

  // 1개라도 선택 시 완료 버튼
  if (chatSelectedThemes.length > 0) {
    finishBtn.style.display = 'block';
    finishBtn.textContent = '오케이 완료! 미션 받을래 🚀';
  }
}

// --- 개별 칩 클릭 ---
function handleChatOptionSelect(option) {
  var optionsArea = $('#chat-options-area');
  optionsArea.style.pointerEvents = 'none';
  optionsArea.style.opacity = '0.5';

  addUserChatMsg(option.text);
  chatSelectedThemes.push(option.theme);
  chatAvailableOptions = chatAvailableOptions.filter(function(o) {
    return o.id !== option.id;
  });

  showChatTyping();
  setTimeout(function() {
    hideChatTyping();

    var responseLines;
    if (chatAvailableOptions.length === 0) {
      responseLines = [
        '와우! 모든 취향을 다 골랐네! 욕심쟁이다멍! 😆',
        '이제 바로 미션을 만들어줄게!'
      ];
    } else if (option.id === 'random') {
      responseLines = [
        '오! 나한테 맡기는 거다멍? 최고로 재밌게 짜줄게!',
        '더 추가할 거 있어?'
      ];
    } else {
      responseLines = [
        option.text + ' 취향 접수 완료! 📝',
        '또 하고 싶은 거 있어 멍?'
      ];
    }

    addDuduChatMsg(responseLines);

    optionsArea.style.pointerEvents = 'auto';
    optionsArea.style.opacity = '1';
    renderChatChips();

    // 자동 진행 ❌ → 모든 옵션 선택해도 완료 버튼으로 유저가 직접 진행
  }, 1000);
}

// --- 최종 완료 → 미션 생성으로 전환 ---
function completeChatSelection() {
  var optionsArea = $('#chat-options-area');
  optionsArea.style.display = 'none';

  addUserChatMsg('이제 미션을 줘!');
  showChatTyping();

  setTimeout(function() {
    hideChatTyping();
    addDuduChatMsg([
      '알겠다멍! 지금 바로 ' + getNickname() + ' 님만을 위한',
      '특별한 체크리스트를 만들고 있어! 🚀'
    ]);

    setTimeout(function() {
      // main.js의 receiveMissionWithThemes 호출
      receiveMissionWithThemes(chatSelectedThemes);
    }, 1500);
  }, 1000);
}

// --- 채팅 시작 (main.js에서 호출) ---
function startChat() {
  if (!currentDraw) return;

  // 상태 초기화
  chatSelectedThemes = [];
  chatAvailableOptions = CHAT_OPTIONS.slice();

  var container = $('#chat-container');
  container.textContent = '';

  var optionsArea = $('#chat-options-area');
  optionsArea.style.display = '';
  optionsArea.style.pointerEvents = 'auto';
  optionsArea.style.opacity = '1';

  var finishBtn = $('#chat-finish-btn');
  finishBtn.style.display = 'none';

  showStep('step-chat');

  // 두두 인사 (딜레이로 자연스럽게)
  setTimeout(function() {
    showChatTyping();
    setTimeout(function() {
      hideChatTyping();
      var chatStName = currentDraw.station_name.endsWith('역') ? currentDraw.station_name : currentDraw.station_name + '역';
      addDuduChatMsg([
        '멍! ' + chatStName + '에 도착했네!',
        getNickname() + ' 님은 어떤 스타일의 여행을 좋아해?',
        '아래에서 편하게 골라봐멍! 🐾'
      ]);
      renderChatChips();
    }, 1000);
  }, 500);
}
