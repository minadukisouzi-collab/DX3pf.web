const ALL_BAD_STATUSES = [
  { id: 'hard', name: '硬直', type: 'type-hard' },
  { id: 'pressure', name: '重圧', type: 'type-pressure' },
  { id: 'poison', name: '邪毒', type: 'type-poison' },
  { id: 'hatred', name: '憎悪', type: 'type-hatred' },
  { id: 'distracted', name: '放心', type: 'type-distracted' },
  { id: 'berserk', name: '暴走', type: 'type-berserk' },
  { id: 'mut_liberation', name: '変異:解放', type: 'type-berserk' },
  { id: 'mut_slaughter', name: '変異:殺戮', type: 'type-berserk' },
  { id: 'mut_fear', name: '変異:恐怖', type: 'type-berserk' }
];

let characters = [
  { id: 'c1', name: '綾瀬 友歌', hp: 30, maxHp: 30, erosion: 80, initiative: 12, badStatuses: ['pressure'] },
  { id: 'c2', name: '鷹司 秀一', hp: 35, maxHp: 35, erosion: 102, initiative: 8, badStatuses: ['hard'] }
];

let currentTab = 'main';
let chatLogsData = {
  main: [{ speaker: '[SYSTEM]', text: 'メインスレッドへようこそ。ダイス例: 8dx+2@8' }],
  sub:  [{ speaker: '[SYSTEM]', text: '雑談スレッドです。自由にお使いください。' }],
  info: [{ speaker: '[SYSTEM]', text: '情報スレッドです。ハンドアウトや共有情報を管理します。' }]
};

let isChatCollapsed = false;
let currentTiming = 'setup';
let activeCharIndex = 0;
let boardState = { scale: 1, panX: 0, panY: 0, isDragging: false, startX: 0, startY: 0 };
let tokens = [
  { id: 't1', charId: 'c1', name: '綾瀬 友歌', x: 100, y: 100, color: '#457b9d' },
  { id: 't2', charId: 'c2', name: '鷹司 秀一', x: 220, y: 150, color: '#e63946' }
];
let selectedModalCharId = null;

window.onload = function() {
  try {
    renderCharacters();
    renderTokens();
    initBoardPanAndZoom();
    updateProcessUI();
    renderChatLogs();
  } catch(e) {
    console.error("初期化エラー:", e);
  }
};

function switchChatTab(tabKey) {
  currentTab = tabKey;
  const tabs = document.querySelectorAll('.chat-tab');
  tabs.forEach(t => t.classList.remove('active'));
  
  const activeIdx = tabKey === 'main' ? 0 : (tabKey === 'sub' ? 1 : 2);
  if (tabs[activeIdx]) tabs[activeIdx].classList.add('active');

  if (isChatCollapsed) toggleChatPanel();
  renderChatLogs();
}

function toggleChatPanel() {
  isChatCollapsed = !isChatCollapsed;
  const wrapper = document.getElementById('chat-wrapper');
  const toggleBtn = document.getElementById('chat-toggle-btn');

  if (isChatCollapsed) {
    wrapper.classList.add('collapsed');
    toggleBtn.textContent = '▲ 開く';
  } else {
    wrapper.classList.remove('collapsed');
    toggleBtn.textContent = '▼ 畳む';
  }
}

function renderChatLogs() {
  const logsContainer = document.getElementById('chat-logs');
  if (!logsContainer) return;
  logsContainer.innerHTML = '';

  const logs = chatLogsData[currentTab] || [];
  logs.forEach(log => {
    const item = document.createElement('div');
    item.className = 'log-item';
    item.innerHTML = `<span class="log-name">${log.speaker}:</span><span>${log.text}</span>`;
    logsContainer.appendChild(item);
  });

  logsContainer.scrollTop = logsContainer.scrollHeight;
}

function sendMessage() {
  const input = document.getElementById('chat-input');
  const speaker = document.getElementById('chat-speaker-select').value;
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();

  appendLogToTab(currentTab, speaker, text);

  const diceMatch = text.match(/^(\d+)dx(?:\+(\d+))?(?:@(\d+))?$/i);
  if (diceMatch) {
    const num = parseInt(diceMatch[1], 10);
    const mod = parseInt(diceMatch[2] || 0, 10);
    const crit = parseInt(diceMatch[3] || 10, 10);
    const res = rollDX3(num, mod, crit);
    appendLogToTab(currentTab, '[DICE BOT]', `${speaker} の判定: ${res.detail} ➔ 【合計: ${res.total}】`);
  }

  input.value = '';
}

function appendLogToTab(tabKey, speaker, text) {
  if (!chatLogsData[tabKey]) chatLogsData[tabKey] = [];
  chatLogsData[tabKey].push({ speaker, text });
  if (tabKey === currentTab) renderChatLogs();
}

function appendLog(speaker, text) {
  appendLogToTab('main', speaker, text);
}

function renderCharacters() {
  const listEl = document.getElementById('character-list');
  const speakerSelect = document.getElementById('chat-speaker-select');
  if (!listEl || !speakerSelect) return;

  listEl.innerHTML = '';
  speakerSelect.innerHTML = '<option value="GM">GM</option>';

  characters.forEach(c => {
    const bsBadgesHtml = c.badStatuses.map(bsId => {
      const bs = ALL_BAD_STATUSES.find(b => b.id === bsId);
      return bs ? `<span class="bs-badge ${bs.type}">${bs.name}</span>` : '';
    }).join('');

    const card = document.createElement('div');
    card.className = 'char-card';
    card.innerHTML = `
      <div class="char-header">
        <span class="char-name">${c.name}</span>
        <button class="btn btn-purple" style="font-size:0.6rem;" onclick="openGMModal('${c.id}')">BS編集</button>
      </div>
      <div class="stat-row">
        <span>HP:</span><input type="number" value="${c.hp}" onchange="updateStat('${c.id}', 'hp', this.value)">/${c.maxHp}
        <span>侵蝕:</span><input type="number" value="${c.erosion}" onchange="updateStat('${c.id}', 'erosion', this.value)">%
        <span>行動:</span><input type="number" value="${c.initiative}" onchange="updateStat('${c.id}', 'initiative', this.value)">
      </div>
      <div class="bs-icon-container">${bsBadgesHtml || '<span style="font-size:0.6rem; color:#666;">BSなし</span>'}</div>
    `;
    listEl.appendChild(card);

    const opt = document.createElement('option');
    opt.value = c.name; opt.textContent = c.name;
    speakerSelect.appendChild(opt);
  });
}

function updateStat(id, key, val) {
  const char = characters.find(c => c.id === id);
  if (char) { char[key] = parseInt(val, 10) || 0; renderCharacters(); }
}

function addCharacter() {
  const name = prompt('キャラクター名を入力してください:', '新規PC');
  if (name) {
    const newId = 'c' + (characters.length + 1);
    characters.push({ id: newId, name: name, hp: 30, maxHp: 30, erosion: 60, initiative: 10, badStatuses: [] });
    tokens.push({ id: 't' + newId, charId: newId, name: name, x: 150, y: 150, color: '#7209b7' });
    renderCharacters();
    renderTokens();
  }
}

function openGMModal(charId) {
  selectedModalCharId = charId;
  const char = characters.find(c => c.id === charId);
  if (!char) return;
  document.getElementById('modal-char-name').textContent = `${char.name} - BS編集`;
  const grid = document.getElementById('modal-bs-grid');
  grid.innerHTML = '';
  ALL_BAD_STATUSES.forEach(bs => {
    const isActive = char.badStatuses.includes(bs.id);
    const btn = document.createElement('div');
    btn.className = `bs-toggle-btn ${isActive ? 'active' : ''}`;
    btn.textContent = bs.name;
    btn.onclick = () => {
      const idx = char.badStatuses.indexOf(bs.id);
      if (idx >= 0) char.badStatuses.splice(idx, 1);
      else char.badStatuses.push(bs.id);
      openGMModal(charId);
      renderCharacters();
    };
    grid.appendChild(btn);
  });
  document.getElementById('gm-modal').classList.add('active');
}

function closeModal() { document.getElementById('gm-modal').classList.remove('active'); }

function updateProcessUI() {
  const textEl = document.getElementById('current-process-text');
  const btnsEl = document.getElementById('process-control-buttons');
  if (!textEl || !btnsEl) return;
  btnsEl.innerHTML = '';

  if (currentTiming === 'setup') {
    textEl.textContent = 'セットアップ';
    btnsEl.innerHTML = `<button class="btn btn-gold" onclick="transitionTo('initiative')">イニシアチブへ➔</button>`;
  } else if (currentTiming === 'initiative') {
    textEl.textContent = 'イニシアチブ';
    btnsEl.innerHTML = `<button class="btn btn-gold" onclick="transitionTo('main_minor')">メインへ➔</button>`;
  } else if (currentTiming === 'main_minor') {
    textEl.textContent = 'メイン(マイナー)';
    btnsEl.innerHTML = `<button class="btn btn-red" onclick="transitionTo('main_major')">メジャーへ➔</button>`;
  } else if (currentTiming === 'main_major') {
    textEl.textContent = 'メイン(メジャー)';
    btnsEl.innerHTML = `<button class="btn btn-red" onclick="finishMainAction()">行動終了➔</button>`;
  } else if (currentTiming === 'cleanup') {
    textEl.textContent = 'クリンナップ';
    btnsEl.innerHTML = `<button class="btn btn-gold" onclick="transitionTo('setup')">次ラウンド➔</button>`;
  }
}

function transitionTo(nextTiming) {
  currentTiming = nextTiming;
  appendLog('[SYSTEM]', `タイミング変更: ${nextTiming}`);
  updateProcessUI();
}

function finishMainAction() {
  activeCharIndex++;
  if (activeCharIndex >= characters.length) {
    activeCharIndex = 0;
    transitionTo('cleanup');
  } else {
    transitionTo('initiative');
  }
}

function initBoardPanAndZoom() {
  const wrapper = document.getElementById('board-wrapper');
  const viewport = document.getElementById('board-viewport');
  if (!wrapper || !viewport) return;

  wrapper.addEventListener('mousedown', (e) => {
    if (e.target !== wrapper && e.target !== viewport) return;
    boardState.isDragging = true;
    boardState.startX = e.clientX - boardState.panX;
    boardState.startY = e.clientY - boardState.panY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!boardState.isDragging) return;
    boardState.panX = e.clientX - boardState.startX;
    boardState.panY = e.clientY - boardState.startY;
    updateBoardTransform();
  });

  window.addEventListener('mouseup', () => { boardState.isDragging = false; });
}

function zoomBoard(delta) {
  boardState.scale = Math.min(Math.max(0.4, boardState.scale + delta), 2.5);
  updateBoardTransform();
}

function resetBoardView() {
  boardState.scale = 1; boardState.panX = 0; boardState.panY = 0;
  updateBoardTransform();
}

function updateBoardTransform() {
  const vp = document.getElementById('board-viewport');
  if (vp) vp.style.transform = `translate(${boardState.panX}px, ${boardState.panY}px) scale(${boardState.scale})`;
}

function renderTokens() {
  const viewport = document.getElementById('board-viewport');
  if (!viewport) return;
  viewport.innerHTML = '';

  tokens.forEach(t => {
    const el = document.createElement('div');
    el.className = 'token';
    el.style.left = `${t.x}px`; el.style.top = `${t.y}px`;
    el.innerHTML = `<div style="width:36px; height:36px; border-radius:50%; background:${t.color}; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:bold; font-size:0.8rem;">${t.name[0]}</div><div class="token-name">${t.name}</div>`;
    
    let dragging = false, ox = 0, oy = 0;
    el.addEventListener('mousedown', (e) => {
      e.stopPropagation(); dragging = true;
      ox = (e.clientX / boardState.scale) - t.x;
      oy = (e.clientY / boardState.scale) - t.y;
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      t.x = (e.clientX / boardState.scale) - ox;
      t.y = (e.clientY / boardState.scale) - oy;
      el.style.left = `${t.x}px`; el.style.top = `${t.y}px`;
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    viewport.appendChild(el);
  });
}

function rollDX3(num, mod, crit) {
  let cur = num, hist = [], total = 0, rerolls = 0;
  if (crit < 2) crit = 2;
  while (cur > 0) {
    let rolls = [], next = 0;
    for (let i = 0; i < cur; i++) {
      let r = Math.floor(Math.random() * 10) + 1;
      rolls.push(r);
      if (r >= crit) next++;
    }
    hist.push(`[${rolls.join(',')}]`);
    if (next > 0) { rerolls++; cur = next; }
    else { total = (rerolls * 10) + Math.max(...rolls) + mod; break; }
  }
  return { total: total, detail: hist.join(' -> ') + (mod ? ` + ${mod}` : '') };
}
