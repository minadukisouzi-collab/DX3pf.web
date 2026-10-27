// ==========================================
// 1. 定数・グローバル変数・初期データ
// ==========================================
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

// シンドロームのプレフィックス定義
const SYNDROME_PREFIXES = {
  ang: 'ang', bal: 'bal', bld: 'bld', bsk: 'bsk',
  cym: 'cym', exg: 'exg', hnm: 'hnm', mol: 'mol',
  num: 'num', ork: 'ork', slm: 'slm', slr: 'slr',
  uro: 'uro', gen: 'gen'
};

// ★キャラクターデータ（エフェクトは「名前」で保持するように変更）
let characters = [
  { 
    id: 'c1', 
    name: '綾瀬 友歌', 
    hp: 30, maxHp: 30, erosion: 80, initiative: 12, badStatuses: ['pressure'],
    effects: [
      { name: 'イルミネイト', level: 1 },
      { name: '百花繚乱', level: 2 }
    ]
  },
  { 
    id: 'c2', 
    name: '鷹司 秀一', 
    hp: 35, maxHp: 35, erosion: 102, initiative: 8, badStatuses: ['hard'],
    effects: [
      { name: 'コンセントレイト：エンジェルハィロゥ', level: 3 }
    ]
  }
];

let currentTab = 'main';
let chatLogsData = {
  main: [{ speaker: '[SYSTEM]', text: 'メインスレッドへようこそ。ダイス例: 8dx+2@8' }],
  sub:  [{ speaker: '[SYSTEM]', text: '雑談スレッドです。自由にお使いください。' }],
  info: [{ speaker: '[SYSTEM]', text: '情報スレッドです。ハンドアウトや共有情報を管理します。' }]
};

let isChatCollapsed = false;

// フェーズ管理
const PHASES = ['オープニングフェイズ', 'ミドルフェイズ', 'クライマックスフェイズ', 'エンディングフェイズ'];
let currentPhaseIndex = 0;
let isBattleMode = false;
let currentTiming = 'setup';
let activeCharIndex = 0;

let boardState = { scale: 1, panX: 0, panY: 0, isDragging: false, startX: 0, startY: 0 };
let tokens = [
  { id: 't1', charId: 'c1', name: '綾瀬 友歌', x: 100, y: 100, color: '#457b9d' },
  { id: 't2', charId: 'c2', name: '鷹司 秀一', x: 220, y: 150, color: '#e63946' }
];
let selectedModalCharId = null;

// マスターデータ ＆ 逆引き辞書
let effectsMasterData = {};
let nameToIdMap = {}; // "エフェクト名" ➔ "ID" の逆引き用


// ==========================================
// 2. 起動処理 (window.onload)
// ==========================================
window.onload = async function() {
  try {
    await loadEffectsMaster(); // 先にマスターを読み込んで辞書を作る
    renderCharacters();
    renderTokens();
    initBoardPanAndZoom();
    updateModeUI();
    renderChatLogs();
  } catch(e) {
    console.error("初期化エラー:", e);
  }
};

// GitHubからエフェクトマスターデータを読み込み、逆引き辞書を構築する
async function loadEffectsMaster() {
  try {
    const response = await fetch('effects_master.json');
    if (response.ok) {
      effectsMasterData = await response.json();
      
      // 逆引き辞書 (nameToIdMap) の自動構築
      nameToIdMap = {};
      for (const [id, data] of Object.entries(effectsMasterData)) {
        if (data.name) {
          nameToIdMap[data.name] = id;
        }
      }
      console.log('エフェクトマスター読み込み完了:', effectsMasterData);
      console.log('逆引き辞書構築完了:', nameToIdMap);
    }
  } catch (e) {
    console.warn('effects_master.json の読み込みに失敗しました（ローカル動作など）:', e);
  }
}


// ==========================================
// 3. キャラクター描画 ＆ エフェクト連携
// ==========================================
function renderCharacters() {
  const listEl = document.getElementById('character-list');
  const speakerSelect = document.getElementById('chat-speaker-select');
  if (!listEl || !speakerSelect) return;

  listEl.innerHTML = '';
  speakerSelect.innerHTML = '<option value="GM">GM</option>';

  characters.forEach(c => {
    // 1. バッドステータスのバッジ生成
    const bsBadgesHtml = c.badStatuses.map(bsId => {
      const bs = ALL_BAD_STATUSES.find(b => b.id === bsId);
      return bs ? `<span class="bs-badge ${bs.type}">${bs.name}</span>` : '';
    }).join('');

    // 2. 所持エフェクトのボタン生成（名前から直接発動）
    const effectsHtml = (c.effects || []).map(eff => {
      return `
        <button class="btn" style="font-size:0.6rem; padding:2px 5px; background:#2b2d42; border:1px solid #4a4e69; color:#edf2f4; cursor:pointer;" 
          onclick="applyEffectByName('${c.id}', '${eff.name}',${eff.level})">
          ${eff.name} (Lv.${eff.level})
        </button>
      `;
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
      <div class="bs-icon-container" style="margin-top:4px;">${bsBadgesHtml || '<span style="font-size:0.6rem; color:#666;">BSなし</span>'}</div>
      <div class="effect-buttons-container" style="display:flex; flex-wrap:wrap; gap:3px; margin-top:6px;">
        ${effectsHtml || '<span style="font-size:0.6rem; color:#666;">エフェクトなし</span>'}
      </div>
    `;
    listEl.appendChild(card);

    const opt = document.createElement('option');
    opt.value = c.name; opt.textContent = c.name;
    speakerSelect.appendChild(opt);
  });
}


// ==========================================
// 4. エフェクト発動コア関数（名前ベースの逆引き対応）
// ==========================================
function applyEffectByName(charId, effectName, level) {
  const char = characters.find(c => c.id === charId);
  if (!char) { alert('キャラクターが見つかりません'); return; }

  // 1. 名前から逆引き辞書でIDを引く
  const effectId = nameToIdMap[effectName];
  const effect = effectId ? effectsMasterData[effectId] : null;

  if (!effect) {
    // マスターに未登録でも簡易的にコスト3で動かせるフォールバック
    char.erosion += 3;
    renderCharacters();
    appendLog('[SYSTEM]', `${char.name} は【${effectName}】（Lv.${level}）を使用！ 侵蝕率+3\%（※マスター未登録）`); return; }  // 2. 侵蝕率コストの自動支払い（数値または文字列のパース） let cost = parseInt(effect.encroach, 10) \vert{}\vert{} 3; char.erosion += cost;  // 3. 変動値（バフ・デバフ）の計算と適用 let appliedDetails = []; if (effect.modifications && Array.isArray(effect.modifications)) { effect.modifications.forEach(mod => { let val = 0; try { val = eval(mod.calc.replace(/level/g, level)); } catch (e) { console.error('計算式エラー:', mod.calc); }  if (!char.tempModifiers) char.tempModifiers = { dice: 0, crit: 0, atk: 0 };  if (mod.stat === 'dice') { char.tempModifiers.dice += val; appliedDetails.push(`ダイス ${val > 0 ? '+' + val : val}`);
      } else if (mod.stat === 'crit') {
        char.tempModifiers.crit += val;
        appliedDetails.push(`C値 ${val > 0 ? '+' + val : val}`); } else if (mod.stat === 'atk') { char.tempModifiers.atk += val; appliedDetails.push(`攻撃力 ${val > 0 ? '+' + val : val}`);
      }
    });
  }

  renderCharacters();
  const detailStr = appliedDetails.length > 0 ? `（${appliedDetails.join(', ')}）` : ''; appendLog('[SYSTEM]', `${char.name} は【${effect.name}】（Lv.${level}）を使用！ 侵蝕率+${cost}\%${detailStr}`);
}


// ==========================================
// 5. エフェクト登録フォーム（自動採番 ＆ JSON生成）
// ==========================================
function openEffectModal() {
  const modal = document.getElementById('effect-modal');
  if (modal) modal.classList.add('active');
  updateEffectIdAuto(); // モーダルを開いた時に自動採番を実行
}

function closeEffectModal() {
  const modal = document.getElementById('effect-modal');
  if (modal) modal.classList.remove('active');
}

// 選択されたシンドロームに応じてIDを自動採番する
function updateEffectIdAuto() {
  const syndromeSel = document.getElementById('eff-syndrome');
  if (!syndromeSel) return;
  
  const prefix = SYNDROME_PREFIXES[syndromeSel.value] || 'gen';

  let count = 1;
  if (effectsMasterData) {
    const matchingIds = Object.keys(effectsMasterData).filter(id => id.startsWith(prefix + '_'));
    count = matchingIds.length + 1;
  }

  const numStr = String(count).padStart(3, '0');
  const idInput = document.getElementById('eff-id');
  if (idInput) {
    idInput.value = `${prefix}_${numStr}`;
  }

  generateEffectJson();
}

// フォームの内容から完全なエフェクトマスター用JSONを生成する
function generateEffectJson() {
  const idInput = document.getElementById('eff-id');
  const nameInput = document.getElementById('eff-name');
  if (!idInput || !nameInput) return;

  const id = idInput.value.trim() || 'ang_001';
  const name = nameInput.value.trim() || 'サンプルエフェクト';
  const maxLevel = parseInt(document.getElementById('eff-max-level')?.value, 10) || 1;
  const timing = document.getElementById('eff-timing')?.value || 'メジャーアクション';
  const skill = document.getElementById('eff-skill')?.value.trim() || '<RC>';
  const difficulty = document.getElementById('eff-difficulty')?.value || '自動成功';
  const target = document.getElementById('eff-target-type-sel')?.value || '-';
  const range = document.getElementById('eff-range')?.value || '視界';
  const encroach = document.getElementById('eff-encroach')?.value.trim() || '2';
  const limit = document.getElementById('eff-limit')?.value || '-';
  
  const stat = document.getElementById('eff-stat')?.value || 'dice';
  const calc = document.getElementById('eff-calc')?.value.trim() || 'level * 2';

  const effectObj = {
    [id]: {
      name: name,
      max_level: maxLevel,
      timing: timing,
      skill: skill,
      difficulty: difficulty,
      target: target,
      range: range,
      encroach: encroach,
      limit: limit,
      effect_type: "buff",
      target_type: target === "-" ? "self" : "other",
      modifications: [
        { stat: stat, calc: calc }
      ]
    }
  };

  const outputArea = document.getElementById('eff-json-output');
  if (outputArea) {
    outputArea.value = JSON.stringify(effectObj, null, 2);
  }
}

function downloadEffectsJson() {
  const outputArea = document.getElementById('eff-json-output');
  if (!outputArea) return;
  
  const jsonText = outputArea.value;
  const blob = new Blob([jsonText], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'effect_add.json';
  a.click();
  
  URL.revokeObjectURL(url);
  alert('エフェクトのJSONデータをダウンロードしました！GitHubの effects_master.json に追記してください。');
}


// ==========================================
// 6. その他既存の機能（モード・チャット・ボード・ステータス等）
// ==========================================
function updateModeUI() {
  const phaseText = document.getElementById('current-phase-text');
  const modeControls = document.getElementById('mode-controls');
  if (!phaseText || !modeControls) return;

  phaseText.textContent = PHASES[currentPhaseIndex];
  modeControls.innerHTML = '';

  if (!isBattleMode) {
    modeControls.innerHTML = `
      <button class="btn" onclick="nextScene()">次のシーンへ</button>
      <button class="btn" onclick="nextPhase()">次のフェーズ</button>
      <button class="btn btn-gold" onclick="startBattle()">戦闘開始</button>
    `;
  } else {
    modeControls.innerHTML = `
      <span style="color:var(--accent-gold); font-weight:bold; margin-left:4px;">Proc:</span>
      <span id="current-process-text" style="color:#fff; font-weight:bold;">セットアップ</span>
      <div id="process-control-buttons" style="display:flex; gap:3px; margin-left:4px;"></div>
    `;
    updateProcessUI();
  }
}

function nextPhase() {
  currentPhaseIndex = (currentPhaseIndex + 1) % PHASES.length;
  const sceneInput = document.getElementById('scene-num');
  if (sceneInput) {
    sceneInput.value = 1;
    sceneInput.setAttribute('value', '1');
  }
  updateModeUI();
  appendLog('[SYSTEM]', `フェーズが移行しました: 【${PHASES[currentPhaseIndex]}】（シーン番号を 1 にリセットしました）`);
}

function nextScene() {
  const sceneInput = document.getElementById('scene-num');
  if (sceneInput) {
    let sc = parseInt(sceneInput.value, 10) || 1;
    sceneInput.value = sc + 1;
  }
  appendLog('[SYSTEM]', `シーン ${sceneInput.value} に移行しました。`);
  appendLog('[SYSTEM]', '【サジェスト】シーンが変わりました。必要に応じてタイタスの昇華やリザレクションの処理を確認してください。');
}

function startBattle() {
  isBattleMode = true;
  currentTiming = 'setup';
  updateModeUI();
  appendLog('[SYSTEM]', '戦闘を開始します。プロセス管理へ移行します。');
}

function endBattle() {
  isBattleMode = false;
  const roundInput = document.getElementById('round-num');
  if (roundInput) roundInput.value = 1;
  updateModeUI();
  appendLog('[SYSTEM]', '戦闘が終了しました。通常モードに戻ります。');
}

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
    btnsEl.innerHTML = `
      <button class="btn btn-gold" onclick="handleRoundEnd(true)">次ラウンド➔</button>
      <button class="btn btn-purple" onclick="handleRoundEnd(false)">戦闘終了</button>
    `;
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

function handleRoundEnd(toNextRound) {
  const roundInput = document.getElementById('round-num');
  if (toNextRound) {
    if (roundInput) {
      let currentRound = parseInt(roundInput.value, 10) || 1;
      roundInput.value = currentRound + 1;
    }
    appendLog('[SYSTEM]', `第 ${roundInput ? roundInput.value : ''} ラウンドを開始します。`);
    transitionTo('setup');
  } else {
    endBattle();
  }
}

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

function updateStat(id, key, val) {
  const char = characters.find(c => c.id === id);
  if (char) { char[key] = parseInt(val, 10) || 0; renderCharacters(); }
}

function addCharacter() {
  const name = prompt('キャラクター名を入力してください:', '新規PC');
  if (name) {
    const newId = 'c' + (characters.length + 1);
    characters.push({ id: newId, name: name, hp: 30, maxHp: 30, erosion: 60, initiative: 10, badStatuses: [], effects: [] });
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
  viewport.viewport = '';
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