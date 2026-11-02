// ==========================================
// chat.js: チャットシステム・タブ切替・ダイスロール処理（モジュール版）
// ==========================================

let currentTab = 'main';
let currentSessionId = null; // 固着を防止するため初期値は null
let supabaseInstance = null;

let chatLogsData = {
  main: [{ speaker: '[SYSTEM]', text: 'スレッドへようこそ。ダイス例: 8dx+2@8' }],
  sub:  [{ speaker: '[SYSTEM]', text: '雑談スレッドです。自由にお使いください。' }],
  info: [{ speaker: '[SYSTEM]', text: '情報スレッドです。ハンドアウトや共有情報を管理します。' }]
};

let isChatCollapsed = false;

// 0. チャットシステムの初期化（vtt.html から Supabaseインスタンス、ルームID、プレイヤー名を受け取る）
export function initChatSystem(supabaseClient, roomId, playerName) {
  if (!supabaseClient || !roomId) {
    console.error('チャット初期化エラー: SupabaseクライアントまたはルームIDが不足しています。');
    return;
  }
  
  supabaseInstance = supabaseClient;
  currentSessionId = roomId;

  // スピーカーセレクトに自分の名前とGMをセット
  const speakerSelect = document.getElementById('chat-speaker-select');
  if (speakerSelect && playerName) {
    speakerSelect.innerHTML = `<option value="${playerName}">${playerName}</option><option value="GM">GM</option>`;
  }

  // 過去ログの取得とリアルタイム購読の開始
  loadInitialChatLogs();
  subscribeToChatRealtime();
}

// 1. チャットタブ切替
export function switchChatTab(tabKey) {
  currentTab = tabKey;
  const tabs = document.querySelectorAll('.chat-tab');
  tabs.forEach(t => t.classList.remove('active'));
  
  // タブのインデックスに合わせたアクティブ切替
  const tabArray = Array.from(tabs);
  const targetTab = tabArray.find(t => t.getAttribute('onclick')?.includes(tabKey));
  if (targetTab) targetTab.classList.add('active');

  renderChatLogs();
}

// 2. チャットパネルの折りたたみトグル
export function toggleChatPanel() {
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
  if (logs.length === 0) {
    logsContainer.innerHTML = `<div style="color: var(--text-muted); text-align: center; font-size: 0.75rem; margin-top: 10px;">メッセージはまだありません</div>`;
    return;
  }

  logs.forEach(log => {
    const item = document.createElement('div');
    item.className = 'log-item';
    item.innerHTML = `<span class="log-name">${log.speaker}:</span><span>${log.text}</span>`;
    logsContainer.appendChild(item);
  });

  logsContainer.scrollTop = logsContainer.scrollHeight;
}

// 4. メッセージ送信 ＆ ダイスロール判定 ＆ Supabaseへの保存
export async function sendMessage() {
  const input = document.getElementById('chat-input');
  const speakerSelect = document.getElementById('chat-speaker-select');
  if (!input || !input.value.trim() || !supabaseInstance || !currentSessionId) return;
  
  const text = input.value.trim();
  const speaker = speakerSelect ? speakerSelect.value : 'GM';
  
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

  // 現在のルームのセッションIDを使ってSupabaseへ送信（INSERT）する
  const { error } = await supabaseInstance
    .from('chat_log')
    .insert([
      { 
        session_id: currentSessionId, 
        speaker_name: speaker, 
        message: messageToSend 
      }
    ]);

  if (error) {
    console.error('Supabase送信エラー:', error);
  }
}

// 5. 初期化：過去のログをSupabaseから取得して画面に描画する
async function loadInitialChatLogs() {
  if (!supabaseInstance || !currentSessionId) return;

  const { data, error } = await supabaseInstance
    .from('chat_log')
    .select('*')
    .eq('session_id', currentSessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('過去ログ取得エラー:', error);
    return;
  }

  if (data && data.length > 0) {
    chatLogsData['main'] = data.map(item => ({
      speaker: item.speaker_name,
      text: item.message
    }));
  } else {
    chatLogsData['main'] = [];
  }
  renderChatLogs();
}

// 6. リアルタイム受信の設定
function subscribeToChatRealtime() {
  if (!supabaseInstance || !currentSessionId) return;

  supabaseInstance
    .channel(`chat-room-${currentSessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_log',
        filter: `session_id=eq.${currentSessionId}`
      },
      (payload) => {
        const newLog = payload.new;
        chatLogsData['main'].push({
          speaker: newLog.speaker_name,
          text: newLog.message
        });
        renderChatLogs();
      }
    )
    .subscribe((status) => {
      console.log('Realtime Status:', status);
    });
}

// 7. ダイスロールエンジン (DX3rd)
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

// 8. ダイスロールエンジン (一般d10)
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