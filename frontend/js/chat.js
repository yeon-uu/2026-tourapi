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

// --- 칩 렌더링 (토글 멀티셀렉트) ---
function renderChatChips() {
  var chipsEl = $('#chat-chips');
  chipsEl.textContent = '';

  CHAT_OPTIONS.forEach(function(opt) {
    var btn = document.createElement('button');
    btn.className = 'chat-chip-btn';
    if (chatSelectedThemes.indexOf(opt.theme) !== -1) {
      btn.classList.add('selected');
    }
    btn.textContent = opt.text;
    btn.addEventListener('click', function() {
      toggleChip(opt.theme);
    });
    chipsEl.appendChild(btn);
  });

  // 전송 버튼 활성화
  var sendBtn = $('#chat-send-btn');
  sendBtn.disabled = chatSelectedThemes.length === 0;
}

// --- 칩 토글 ---
function toggleChip(theme) {
  var idx = chatSelectedThemes.indexOf(theme);
  if (idx === -1) {
    chatSelectedThemes.push(theme);
  } else {
    chatSelectedThemes.splice(idx, 1);
  }
  renderChatChips();
}

// --- 전송 버튼 클릭 (main.js에서 이벤트 등록) ---
function handleChatSend() {
  if (chatSelectedThemes.length === 0) return;

  var optionsArea = $('#chat-options-area');
  optionsArea.style.display = 'none';

  // 선택한 테마를 유저 메시지로
  var labels = chatSelectedThemes.map(function(t) {
    for (var i = 0; i < CHAT_OPTIONS.length; i++) {
      if (CHAT_OPTIONS[i].theme === t) return CHAT_OPTIONS[i].text;
    }
    return t;
  });
  addUserChatMsg(labels.join(', '));

  showChatTyping();
  setTimeout(function() {
    hideChatTyping();
    var count = chatSelectedThemes.length;
    var name = getNickname();

    // 첫 번째 메시지
    if (count === CHAT_OPTIONS.length) {
      addDuduChatMsg('와우! 전부 다 골랐다멍! 욕심쟁이멍! 😆');
    } else if (count === 1 && chatSelectedThemes[0] === 'random') {
      addDuduChatMsg('나한테 맡기는 거다멍! 🎲');
    } else {
      addDuduChatMsg(count + '개 취향 접수 완료멍! 📝');
    }

    // 두 번째 메시지 (연달아)
    setTimeout(function() {
      addDuduChatMsg(name + ' 님만의 미션 바로 만들어줄게멍! 🚀');

      // 로딩 스피너 표시 후 화면 전환
      showChatTyping();
      setTimeout(function() {
        hideChatTyping();
        receiveMissionWithThemes(chatSelectedThemes);
      }, 1000);
    }, 800);
  }, 1000);
}

// --- 채팅 시작 (main.js에서 호출) ---
function startChat() {
  if (!currentDraw) return;

  // 상태 초기화
  chatSelectedThemes = [];

  var container = $('#chat-container');
  container.textContent = '';

  var optionsArea = $('#chat-options-area');
  optionsArea.style.display = '';

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
