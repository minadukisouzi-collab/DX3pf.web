// ==========================================
// chat.js: チャットシステム・タブ切替・ダイスロール処理
// ==========================================

let currentTab = 'main';
let chatLogsData = {
  main: [{ speaker: '[SYSTEM]', text: 'メインスレッドへようこそ。ダイス例: 8dx+2@8' }],
  sub:  [{ speaker: '[SYSTEM]', text: '雑談スレッドです。自由にお使いください。' }],
  info: [{ speaker: '[SYSTEM]', text: '情報スレッドです。ハンドアウトや共有情報を管理します。' }]
};

let isChatCollapsed = false;

// 1. チャットタブ切替
function switchChatTab(tabKey) {
  currentTab = tabKey;
  const tabs = document.querySelectorAll('.chat-tab');
  tabs.forEach(t => t.classList.remove('active'));
  
  const activeIdx = tabKey === 'main' ? 0 : (tabKey === 'sub' ? 1 : 2);
  if (tabs[activeIdx]) tabs[activeIdx].classList.add('active');

  if (isChatCollapsed) toggleChatPanel();
  renderChatLogs();
}

// 2. チャットパネルの折りたたみトグル
function toggleChatPanel() {
  isChatCollapsed = !isChatCollapsed;
  const wrapper = document.getElementById('chat-wrapper');
  const toggleBtn = document.getElementById('chat-toggle-btn');

  if (isChatCollapsed) {
    if (wrapper) wrapper.classList.add('collapsed');
    if (toggleBtn) toggleBtn.textContent = '▲ 開く';
  } else {
    if (wrapper) wrapper.classList.remove('collapsed');
    if (toggleBtn) toggleBtn.textContent = '▼ 畳む';
  }
}

// 3. チャットログの描画
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

// 4. メッセージ送信 ＆ ダイスロール判定の自動検知
function sendMessage() {
  const input = document.getElementById('chat-input');
  const speakerSelect = document.getElementById('chat-speaker-select');
  if (!input || !input.value.trim()) return;
  
  const text = input.value.trim();
  const speaker = speakerSelect ? speakerSelect.value : 'GM';

  appendLogToTab(currentTab, speaker, text);

  // ダブルクロス用ダイスパターンのマッチング (例: 8dx+2@8)
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

// 5. DX3rd 特有のクリティカルエフェクト＆スプリードを含むダイスロールエンジン
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
    if (next > 0) { 
      rerolls++; 
      cur = next; 
    } else { 
      total = (rerolls * 10) + Math.max(...rolls) + mod; 
      break; 
    }
  }
  return { total: total, detail: hist.join(' -> ') + (mod ? ` + ${mod}` : '') };
}
