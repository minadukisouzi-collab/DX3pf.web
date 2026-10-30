// ==========================================
// chat.js: チャットシステム・タブ切替・ダイスロール処理（Supabase連携版）
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

// 4. メッセージ送信 ＆ ダイスロール判定 ＆ Supabaseへの保存
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const speakerSelect = document.getElementById('chat-speaker-select');
  if (!input || !input.value.trim()) return;
  
  const text = input.value.trim();
  const speaker = speakerSelect ? speakerSelect.value : 'GM';
  const sessionId = 'test01'; // 必要に応じてセッションIDを変えられます

  let messageToSend = text;

  // 1. ダブルクロス用ダイスパターンのマッチング (例: 8dx+2@8)
  const diceMatch = text.match(/^(\d+)dx(?:\+(\d+))?(?:@(\d+))?$/i);
  if (diceMatch) {
    const num = parseInt(diceMatch[1], 10);
    const mod = parseInt(diceMatch[2] || 0, 10);
    const crit = parseInt(diceMatch[3] || 10, 10);
    const res = rollDX3(num, mod, crit);
    messageToSend = `${text} ➔ ${speaker} の判定: ${res.detail} 【合計: ${res.total}】`;
  } else {
    // 2. 一般的な d10 ダイスロールパターンのマッチング (例: 2d10+3, 5d10)
    const d10Match = text.match(/^(\d+)d10(?:\+(\d+))?$/i);
    if (d10Match) {
      const num = parseInt(d10Match[1], 10);
      const mod = parseInt(d10Match[2] || 0, 10);
      const res = rollD10(num, mod);
      messageToSend = `${text} ➔ ${speaker} のダイス: [${res.rolls.join(', ')}] 【合計: ${res.total}】`;
    }
  }

  input.value = '';

  // Supabaseへ送信（INSERT）する
  if (window.supabaseClient) {
    const { error } = await window.supabaseClient
      .from('chat_log')
      .insert([
        { 
          session_id: sessionId, 
          speaker_name: speaker, 
          message: messageToSend 
        }
      ]);

    if (error) {
      console.error('Supabase送信エラー:', error);
    }  
  } else {
    // クライアントがない場合のフォールバック
    appendLogToTab(currentTab, speaker, messageToSend);
  }

  } else {
    // 万が一クライアントがない場合のフォールバック
    appendLogToTab(currentTab, speaker, messageToSend);
  }
}

// 初期化：過去のログをSupabaseから取得して画面に描画する
async function loadInitialChatLogs(sessionId = 'test01') {
  if (!window.supabaseClient) return;

  const { data, error } = await window.supabaseClient
    .from('chat_log')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('過去ログ取得エラー:', error);
    return;
  }

  if (data && data.length > 0) {
    // 取得したデータを画面のログ配列にセット
    chatLogsData[currentTab] = data.map(item => ({
      speaker: item.speaker_name,
      text: item.message
    }));
    renderChatLogs();
  }
}

// リアルタイム受信の設定
function subscribeToChat(sessionId = 'test01') {
  if (!window.supabaseClient) return;

  // 最初に過去ログを取得する
  loadInitialChatLogs(sessionId);

  // リアルタイム変更を監視
  window.supabaseClient
    .channel('chat-room')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_log',
        filter: `session_id=eq.${sessionId}`
      },
      (payload) => {
        const newLog = payload.new;
        appendLogToTab(currentTab, newLog.speaker_name, newLog.message);
      }
    )
    .subscribe((status) => {
      console.log('Realtime Status:', status);
    });
}

function appendLogToTab(tabKey, speaker, text) {
  if (!chatLogsData[tabKey]) chatLogsData[tabKey] = [];
  chatLogsData[tabKey].push({ speaker, text });
  if (tabKey === currentTab) renderChatLogs();
}

function appendLog(speaker, text) {
  appendLogToTab('main', speaker, text);
}

// 6. DX3rd 特有のクリティカルエフェクト＆スプリードを含むダイスロールエンジン
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

// 一般的な d10 ダイスロール用エンジン
function rollD10(num, mod) {
  let rolls = [];
  let sum = 0;
  for (let i = 0; i < num; i++) {
    let r = Math.floor(Math.random() * 10) + 1;
    rolls.push(r);
    sum += r;
  }
  return { total: sum + mod, rolls: rolls };
}
