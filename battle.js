// ==========================================
// battle.js: フェーズ管理・戦闘プロセス進行・ラウンド管理
// ==========================================

// フェーズ一覧定義
const PHASES = ['オープニングフェイズ', 'ミドルフェイズ', 'クライマックスフェイズ', 'エンディングフェイズ'];
let currentPhaseIndex = 0;
let isBattleMode = false;
let currentTiming = 'setup';
let activeCharIndex = 0;

// --- モード別UI更新（通常モード ⇔ 戦闘モード切替） ---
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

// 次のフェーズへ（ループ ＆ シーン番号を 1 にリセット）
function nextPhase() {
  currentPhaseIndex = (currentPhaseIndex + 1) % PHASES.length;
  
  const sceneInput = document.getElementById('scene-num');
  if (sceneInput) {
    sceneInput.value = 1;
    sceneInput.setAttribute('value', '1');
  }

  updateModeUI();
  if (typeof appendLog === 'function') {
    appendLog('[SYSTEM]', `フェーズが移行しました: 【${PHASES[currentPhaseIndex]}】（シーン番号を 1 にリセットしました）`);
  }
}

// 次のシーンへ（シーン番号インクリメント ＆ リザレクション確認サジェスト）
function nextScene() {
  const sceneInput = document.getElementById('scene-num');
  if (sceneInput) {
    let sc = parseInt(sceneInput.value, 10) || 1;
    sceneInput.value = sc + 1;
  }
  if (typeof appendLog === 'function') {
    appendLog('[SYSTEM]', `シーン ${sceneInput ? sceneInput.value : ''} に移行しました。`);
    appendLog('[SYSTEM]', '【サジェスト】シーンが変わりました。必要に応じてタイタスの昇華やリザレクション（侵蝕率上昇・HP回復）の処理を確認してください。');
  }
}

// 戦闘開始
function startBattle() {
  isBattleMode = true;
  currentTiming = 'setup';
  updateModeUI();
  if (typeof appendLog === 'function') {
    appendLog('[SYSTEM]', '戦闘を開始します。プロセス管理へ移行します。');
  }
}

// 戦闘終了
function endBattle() {
  isBattleMode = false;
  const roundInput = document.getElementById('round-num');
  if (roundInput) roundInput.value = 1;
  updateModeUI();
  if (typeof appendLog === 'function') {
    appendLog('[SYSTEM]', '戦闘が終了しました。通常モード（シーン・フェーズ管理）に戻ります。');
  }
}

// --- 戦闘プロセス進行管理 ---
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
  if (typeof appendLog === 'function') {
    appendLog('[SYSTEM]', `タイミング変更: ${nextTiming}`);
  }
  updateProcessUI();
}

function finishMainAction() {
  // characters は main.js で定義されているグローバル変数
  if (typeof characters !== 'undefined') {
    activeCharIndex++;
    if (activeCharIndex >= characters.length) {
      activeCharIndex = 0;
      transitionTo('cleanup');
    } else {
      transitionTo('initiative');
    }
  } else {
    transitionTo('cleanup');
  }
}

function handleRoundEnd(toNextRound) {
  const roundInput = document.getElementById('round-num');
  if (toNextRound) {
    if (roundInput) {
      let currentRound = parseInt(roundInput.value, 10) || 1;
      roundInput.value = currentRound + 1;
    }
    if (typeof appendLog === 'function') {
      appendLog('[SYSTEM]', `第 ${roundInput ? roundInput.value : ''} ラウンドを開始します。`);
    }
    transitionTo('setup');
  } else {
    endBattle();
  }
}
