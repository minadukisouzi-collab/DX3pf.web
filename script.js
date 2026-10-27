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
      <div id="process-control-buttons" style="
