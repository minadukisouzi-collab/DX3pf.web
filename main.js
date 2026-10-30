// Supabaseの接続情報
const SUPABASE_URL = 'https://iraddangbcsovgjiihzz.supabase.co';
const SUPABASE_KEY = 'YOUR_ANON_KEY'; // API Settingsから取得したanonキー

// 全ファイル共通で使えるようグローバル変数として保持
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// main.js: 共通データ定義・全体初期化・キャラクター管理
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

const SYNDROME_PREFIXES = {
  ang: 'ang', bal: 'bal', bdg: 'bdg', bld: 'bld',
  cym: 'cym', exg: 'exg', hnm: 'hnm', mol: 'mol',
  num: 'num', ork: 'ork', slm: 'slm', slr: 'slr', 
  uro: 'uro', gen: 'gen'
};

// キャラクターデータ（エフェクトは名前ベースで保持）
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

let selectedModalCharId = null;

// ==========================================
// 全体初期化 (window.onload)
// ==========================================
window.onload = async function() {
  try {
    // 1. エフェクトマスターの読み込み（effects.js 内で定義）
    if (typeof loadEffectsMaster === 'function') {
      await loadEffectsMaster();
    }
    
    // 2. 各種コンポーネントの描画・初期化
    renderCharacters();
    
    if (typeof renderTokens === 'function') renderTokens();
    if (typeof initBoardPanAndZoom === 'function') initBoardPanAndZoom();
    if (typeof updateModeUI === 'function') updateModeUI();
    if (typeof renderChatLogs === 'function') renderChatLogs();

  } catch(e) {
    console.error("初期化エラー:", e);
  }
};

// ==========================================
// キャラクター描画 ＆ ステータス更新
// ==========================================
function renderCharacters() {
  const listEl = document.getElementById('character-list');
  const speakerSelect = document.getElementById('chat-speaker-select');
  if (!listEl || !speakerSelect) return;

  listEl.innerHTML = '';
  speakerSelect.innerHTML = '<option value="GM">GM</option>';

  characters.forEach(c => {
    // バッドステータスのバッジ生成
    const bsBadgesHtml = c.badStatuses.map(bsId => {
      const bs = ALL_BAD_STATUSES.find(b => b.id === bsId);
      return bs ? `<span class="bs-badge ${bs.type}">${bs.name}</span>` : '';
    }).join('');

    // 所持エフェクトのボタン生成（名前ベースで呼び出し）
    const effectsHtml = (c.effects || []).map(eff => {
      return `
        <button class="btn" style="font-size:0.6rem; padding:2px 5px; background:#2b2d42; border:1px solid #4a4e69; color:#edf2f4; cursor:pointer;" 
          onclick="applyEffectByName('${c.id}', '${eff.name}', ${eff.level})">
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

function updateStat(id, key, val) {
  const char = characters.find(c => c.id === id);
  if (char) { char[key] = parseInt(val, 10) || 0; renderCharacters(); }
}

function addCharacter() {
  const name = prompt('キャラクター名を入力してください:', '新規PC');
  if (name) {
    const newId = 'c' + (characters.length + 1);
    characters.push({ id: newId, name: name, hp: 30, maxHp: 30, erosion: 60, initiative: 10, badStatuses: [], effects: [] });
    if (typeof tokens !== 'undefined') {
      tokens.push({ id: 't' + newId, charId: newId, name: name, x: 150, y: 150, color: '#7209b7' });
      renderTokens();
    }
    renderCharacters();
  }
}

function openGMModal(charId) {
  selectedModalCharId = charId;
  const char = characters.find(c => c.id === charId);
  if (!char) return;
  const nameEl = document.getElementById('modal-char-name');
  if (nameEl) nameEl.textContent = `${char.name} - BS編集`;
  
  const grid = document.getElementById('modal-bs-grid');
  if (!grid) return;
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
  
  const modal = document.getElementById('gm-modal');
  if (modal) modal.classList.add('active');
}

function closeModal() { 
  const modal = document.getElementById('gm-modal');
  if (modal) modal.classList.remove('active'); 
}
