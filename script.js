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
      // クリンナップ終了時の選択肢（次ラウンドへ進む or 戦闘終了）
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

  // クリンナップ後のラウンド進行・戦闘終了の選択処理
  function handleRoundEnd(toNextRound) {
    if (toNextRound) {
      // ラウンド数をインクリメント
      const roundInput = document.getElementById('round-num');
      if (roundInput) {
        let currentRound = parseInt(roundInput.value, 10) || 1;
        roundInput.value = currentRound + 1;
      }
      appendLog('[SYSTEM]', `第 ${roundInput.value} ラウンドを開始します。`);
      transitionTo('setup');
    } else {
      // 戦闘終了（オープニング・ミドル等のシーン演出へ復帰）
      appendLog('[SYSTEM]', '戦闘が終了しました。シーン演出へ復帰します。');
      currentTiming = 'setup';
      const roundInput = document.getElementById('round-num');
      if (roundInput) roundInput.value = 1;
      updateProcessUI();
    }
  }
