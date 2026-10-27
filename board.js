// ==========================================
// board.js: マップボードの操作（パン・ズーム） ＆ トークン管理
// ==========================================

let boardState = { scale: 1, panX: 0, panY: 0, isDragging: false, startX: 0, startY: 0 };
let tokens = [
  { id: 't1', charId: 'c1', name: '綾瀬 友歌', x: 100, y: 100, color: '#457b9d' },
  { id: 't2', charId: 'c2', name: '鷹司 秀一', x: 220, y: 150, color: '#e63946' }
];

// 1. ボードのパン（ドラッグ移動）とズームの初期化
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

  window.addEventListener('mouseup', () => { 
    boardState.isDragging = false; 
  });
}

function zoomBoard(delta) {
  boardState.scale = Math.min(Math.max(0.4, boardState.scale + delta), 2.5);
  updateBoardTransform();
}

function resetBoardView() {
  boardState.scale = 1; 
  boardState.panX = 0; 
  boardState.panY = 0;
  updateBoardTransform();
}

function updateBoardTransform() {
  const vp = document.getElementById('board-viewport');
  if (vp) {
    vp.style.transform = `translate(${boardState.panX}px, ${boardState.panY}px) scale(${boardState.scale})`;
  }
}

// 2. トークンの描画 ＆ ドラッグ移動処理
function renderTokens() {
  const viewport = document.getElementById('board-viewport');
  if (!viewport) return;
  viewport.innerHTML = '';

  tokens.forEach(t => {
    const el = document.createElement('div');
    el.className = 'token';
    el.style.left = `${t.x}px`; 
    el.style.top = `${t.y}px`;
    el.innerHTML = `
      <div style="width:36px; height:36px; border-radius:50%; background:${t.color}; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:bold; font-size:0.8rem;">
        ${t.name[0]}
      </div>
      <div class="token-name">${t.name}</div>
    `;
    
    let dragging = false, ox = 0, oy = 0;
    
    el.addEventListener('mousedown', (e) => {
      e.stopPropagation(); 
      dragging = true;
      ox = (e.clientX / boardState.scale) - t.x;
      oy = (e.clientY / boardState.scale) - t.y;
    });
    
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      t.x = (e.clientX / boardState.scale) - ox;
      t.y = (e.clientY / boardState.scale) - oy;
      el.style.left = `${t.x}px`; 
      el.style.top = `${t.y}px`;
    });
    
    window.addEventListener('mouseup', () => { 
      dragging = false; 
    });
    
    viewport.appendChild(el);
  });
}