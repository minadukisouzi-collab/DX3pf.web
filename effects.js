// ==========================================
// effects.js: エフェクトマスター管理・発動・登録モーダル
// ==========================================

// グローバル変数
let effectsMasterData = {}; // GitHubから読み込むマスターデータ
let nameToIdMap = {};       // "エフェクト名" ➔ "ID" の逆引き用辞書

// 1. 起動時にGitHubからエフェクトマスターデータを読み込み、逆引き辞書を構築する
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

// 2. エフェクト発動コア関数（名前ベースの逆引き対応）
function applyEffectByName(charId, effectName, level) {
  const char = characters.find(c => c.id === charId);
  if (!char) { alert('キャラクターが見つかりません'); return; }

  // 名前から逆引き辞書でIDを引く
  const effectId = nameToIdMap[effectName];
  const effect = effectId ? effectsMasterData[effectId] : null;

  if (!effect) {
    // マスターに未登録でも簡易的にコスト3で動かせるフォールバック
    char.erosion += 3;
    if (typeof renderCharacters === 'function') renderCharacters();
    if (typeof appendLog === 'function') {
      appendLog('[SYSTEM]', `${char.name} は【${effectName}】（Lv.${level}）を使用！ 侵蝕率+3%（※マスター未登録）`);
    }
    return;
  }

  // 侵蝕率コストの自動支払い
  let cost = parseInt(effect.encroach, 10) || 3;
  char.erosion += cost;

  // 変動値（バフ・デバフ）の計算と適用
  let appliedDetails = [];
  if (effect.modifications && Array.isArray(effect.modifications)) {
    effect.modifications.forEach(mod => {
      let val = 0;
      try {
        val = eval(mod.calc.replace(/level/g, level));
      } catch (e) {
        console.error('計算式エラー:', mod.calc);
      }

      if (!char.tempModifiers) char.tempModifiers = { dice: 0, crit: 0, atk: 0, hp: 0, encroach: 0, guard: 0, armor: 0};
      
      if (mod.stat === 'dice') {
        char.tempModifiers.dice += val;
        appliedDetails.push(`ダイス ${val > 0 ? '+' + val : val}`);
      } else if (mod.stat === 'crit') {
        char.tempModifiers.crit += val;
        appliedDetails.push(`C値 ${val > 0 ? '+' + val : val}`);
      } else if (mod.stat === 'atk') {
        char.tempModifiers.atk += val;
        appliedDetails.push(`攻撃力 ${val > 0 ? '+' + val : val}`);
      } else if (mod.stat === 'hp') {
        // HPの増減（マイナスならダメージやコスト、プラスなら回復）
        char.hp = Math.max(0, (char.hp || 0) + val);
        appliedDetails.push(`HP ${val > 0 ? '+' + val : val}`);
      } else if (mod.stat === 'encroach') {
        // 追加の侵蝕率変動
        char.erosion = (char.erosion || 0) + val;
        appliedDetails.push(`侵蝕率 +${val}%`);
      } else if (mod.stat === 'guard') {
        char.guardMod = (char.guardMod || 0) + val;
        appliedDetails.push(`ガード値 ${val > 0 ? '+' + val : val}`);
      } else if (mod.stat === 'armor') {
        char.armorMod = (char.armorMod || 0) + val;
        appliedDetails.push(`装甲値 ${val > 0 ? '+' + val : val}`);
      }

  if (typeof renderCharacters === 'function') renderCharacters();
  
  const detailStr = appliedDetails.length > 0 ? `（${appliedDetails.join(', ')}）` : '';
  if (typeof appendLog === 'function') {
    appendLog('[SYSTEM]', `${char.name} は【${effect.name}】（Lv.${level}）を使用！ 侵蝕率+${cost}% ${detailStr}`);
  }
}

// ==========================================
// 3. エフェクト登録フォーム（自動採番 ＆ JSON生成）
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
  
  // SYNDROME_PREFIXES は main.js で定義されている前提
  const prefix = (typeof SYNDROME_PREFIXES !== 'undefined' ? SYNDROME_PREFIXES[syndromeSel.value] : null) || 'gen';

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
