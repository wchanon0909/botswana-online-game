const socket = io();
let state = null;
let stateReceivedAt = Date.now();
let scoreModalShownForRound = 0;
let timerInterval = null;
let titleFlashInterval = null;
let originalTitle = document.title;
let draggedCardId = null;
let cardsFaceDown = localStorage.getItem('botswanaCardsFaceDown') === 'true';

const $ = (id) => document.getElementById(id);

const welcome = $('welcome');
const game = $('game');
const playerName = $('playerName');
const roomCode = $('roomCode');
const createRoomBtn = $('createRoomBtn');
const joinRoomBtn = $('joinRoomBtn');
const copyLinkBtn = $('copyLinkBtn');
const startBtn = $('startBtn');
const nextRoundBtn = $('nextRoundBtn');
const resetBtn = $('resetBtn');
const tokenModal = $('tokenModal');
const tokenChoices = $('tokenChoices');
const scoreModal = $('scoreModal');
const scoreCloseBtn = $('scoreCloseBtn');
const toast = $('toast');
const turnTimer = $('turnTimer');
const turnTimerLabel = $('turnTimerLabel');
const turnTimerText = $('turnTimerText');
const autoPlayToggle = $('autoPlayToggle');
const autoPlayStatus = $('autoPlayStatus');
const cardFaceToggle = $('cardFaceToggle');
const turnTimeControl = $('turnTimeControl');
const turnSecondsInput = $('turnSecondsInput');

const savedName = localStorage.getItem('botswanaPlayerName');
if (savedName) playerName.value = savedName;

const savedAutoPlay = localStorage.getItem('botswanaAutoPlay') === 'true';
if (autoPlayToggle) autoPlayToggle.checked = savedAutoPlay;

const params = new URLSearchParams(window.location.search);
const roomFromUrl = params.get('room');
if (roomFromUrl) roomCode.value = roomFromUrl.toUpperCase();

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) stopTitleFlash();
  updateTitleFlash();
});

createRoomBtn.addEventListener('click', () => {
  const name = getName();
  socket.emit('createRoom', { name });
});

joinRoomBtn.addEventListener('click', () => {
  const name = getName();
  const code = roomCode.value.trim().toUpperCase();
  if (!code) return showToast('ใส่ Room Code ก่อนนะ');
  socket.emit('joinRoom', { name, roomCode: code });
});

roomCode.addEventListener('input', () => {
  roomCode.value = roomCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});

startBtn.addEventListener('click', () => socket.emit('startGame'));
nextRoundBtn.addEventListener('click', () => socket.emit('nextRound'));
resetBtn.addEventListener('click', () => socket.emit('resetGame'));
scoreCloseBtn.addEventListener('click', () => scoreModal.classList.add('hidden'));

if (autoPlayToggle) {
  autoPlayToggle.addEventListener('change', () => {
    const enabled = autoPlayToggle.checked;
    localStorage.setItem('botswanaAutoPlay', String(enabled));
    socket.emit('setAutoPlay', { enabled });
  });
}

if (cardFaceToggle) {
  cardFaceToggle.addEventListener('click', () => {
    cardsFaceDown = !cardsFaceDown;
    localStorage.setItem('botswanaCardsFaceDown', String(cardsFaceDown));
    renderCardFaceControl();
    renderHand();
  });
}

if (turnSecondsInput) {
  const sendTurnLimit = () => {
    if (!state || !state.isHost || state.phase !== 'lobby') return;
    socket.emit('setTurnLimit', { seconds: Number(turnSecondsInput.value) || 30 });
  };
  turnSecondsInput.addEventListener('change', sendTurnLimit);
  turnSecondsInput.addEventListener('blur', sendTurnLimit);
}

copyLinkBtn.addEventListener('click', async () => {
  if (!state) return;
  const url = `${window.location.origin}${window.location.pathname}?room=${state.roomCode}`;
  try {
    await navigator.clipboard.writeText(url);
    showToast('คัดลอกลิงก์ห้องแล้ว');
  } catch {
    showToast(url);
  }
});

socket.on('state', (nextState) => {
  state = nextState;
  stateReceivedAt = Date.now();
  render();
});

socket.on('toast', ({ message }) => showToast(message));

function getName() {
  const name = playerName.value.trim() || `Player ${Math.floor(Math.random() * 90) + 10}`;
  localStorage.setItem('botswanaPlayerName', name);
  return name;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add('hidden'), 2600);
}

function render() {
  if (!state) return;
  welcome.classList.add('hidden');
  game.classList.remove('hidden');

  $('roomTitle').textContent = state.roomCode;
  $('phaseText').textContent = phaseLabel(state.phase);
  $('turnText').textContent = state.currentPlayerName || (state.phase === 'lobby' ? 'รอเริ่มเกม' : '-');
  $('roundText').textContent = state.roundNo || 0;
  $('variantText').textContent = `${state.players.length === 6 ? '6P House-rule' : 'Classic style'} · ${state.turnLimitSeconds || 30}s`;
  $('playerCountText').textContent = `${state.players.length}/${state.maxPlayers}`;
  $('lastActionText').textContent = state.lastAction || 'พร้อมเล่น';

  startBtn.classList.toggle('hidden', !(state.isHost && state.phase === 'lobby'));
  nextRoundBtn.classList.toggle('hidden', !(state.isHost && state.phase === 'round_end'));
  resetBtn.classList.toggle('hidden', !(state.isHost && state.phase !== 'lobby'));

  renderTurnSetting();
  renderAutoPlayControl();
  renderCardFaceControl();
  renderTurnTimer();
  updateTitleFlash();
  renderPlayers();
  renderBoard();
  renderHand();
  renderLog();
  renderTokenModal();
  renderScoreModal();
}

function phaseLabel(phase) {
  const map = {
    lobby: 'Lobby / รอผู้เล่น',
    playing: 'กำลังเล่น',
    take: 'รอหยิบสัตว์',
    round_end: 'จบรอบ'
  };
  return map[phase] || phase;
}

function animalMeta(key) {
  return state.animals.find((a) => a.key === key);
}

function isMyActionTurn() {
  if (!state) return false;
  return (state.phase === 'playing' && state.currentPlayerId === state.myId)
    || (state.phase === 'take' && state.pendingTakePlayerId === state.myId);
}

function renderTurnSetting() {
  if (!turnTimeControl || !turnSecondsInput || !state) return;
  const canEdit = state.isHost && state.phase === 'lobby';
  turnTimeControl.classList.toggle('hidden', !canEdit);
  turnSecondsInput.disabled = !canEdit;
  if (document.activeElement !== turnSecondsInput) {
    turnSecondsInput.value = state.turnLimitSeconds || 30;
  }
}

function renderAutoPlayControl() {
  if (!autoPlayToggle || !autoPlayStatus || !state) return;
  autoPlayToggle.checked = Boolean(state.myAutoPlay);
  autoPlayToggle.disabled = state.phase === 'round_end' || state.phase === 'lobby' && !state.myId;
  if (state.myAutoPlayTemporary) {
    autoPlayStatus.textContent = 'Auto ชั่วคราวจากหมดเวลา';
  } else if (state.myAutoPlay) {
    autoPlayStatus.textContent = 'เปิด: ลงซ้ายสุด + หยิบตัวที่เหลือน้อยสุด';
  } else {
    autoPlayStatus.textContent = 'ปิด';
  }
}

function renderCardFaceControl() {
  if (!cardFaceToggle) return;
  cardFaceToggle.textContent = cardsFaceDown ? '👀 หงายการ์ด' : '🙈 คว่ำการ์ด';
  cardFaceToggle.classList.toggle('active', cardsFaceDown);
  cardFaceToggle.setAttribute('aria-pressed', String(cardsFaceDown));
}

function renderTurnTimer() {
  if (!turnTimer || !state) return;
  const shouldShow = isMyActionTurn();
  turnTimer.classList.toggle('hidden', !shouldShow);

  if (!shouldShow) {
    stopTimerInterval();
    return;
  }

  turnTimerLabel.textContent = state.phase === 'take' ? 'เลือกสัตว์ของคุณ' : 'ถึงตาคุณแล้ว';
  updateTurnTimerText();
  if (!timerInterval) timerInterval = setInterval(updateTurnTimerText, 300);
}

function updateTurnTimerText() {
  if (!state || !isMyActionTurn()) return;
  const startRemaining = Number.isFinite(state.turnRemainingMs) ? state.turnRemainingMs : ((state.turnLimitSeconds || 30) * 1000);
  const remainingMs = Math.max(0, startRemaining - (Date.now() - stateReceivedAt));
  const remaining = Math.ceil(remainingMs / 1000);
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');
  turnTimerText.textContent = `${minutes}:${seconds}`;
  turnTimer.classList.toggle('urgent', remaining <= 10);
}

function stopTimerInterval() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTitleFlash() {
  if (document.hidden && isMyActionTurn()) {
    startTitleFlash();
  } else {
    stopTitleFlash();
  }
}

function startTitleFlash() {
  if (titleFlashInterval) return;
  let visible = false;
  titleFlashInterval = setInterval(() => {
    visible = !visible;
    document.title = visible ? '🔔 ถึงตาคุณแล้ว!' : originalTitle;
  }, 900);
}

function stopTitleFlash() {
  if (titleFlashInterval) {
    clearInterval(titleFlashInterval);
    titleFlashInterval = null;
  }
  document.title = originalTitle;
}

function renderPlayers() {
  const list = $('playersList');
  list.innerHTML = '';
  for (const player of state.players) {
    const card = document.createElement('div');
    card.className = 'player-card';
    const isTurn = state.currentPlayerId === player.id || state.pendingTakePlayerId === player.id;
    const liveRoundScore = calculateLiveRoundScore(player);
    const previousTotalScore = state.phase === 'round_end'
      ? Math.max(0, player.totalScore - player.roundScore)
      : player.totalScore;
    const currentTotalScore = state.phase === 'round_end'
      ? player.totalScore
      : previousTotalScore + liveRoundScore;
    const tokenText = state.animals
      .map((a) => {
        const count = player.tokens[a.key] || 0;
        return count
          ? `<span class="token-pill"><span class="token-pill-emoji">${a.emoji}</span><span class="token-pill-count">${count}</span></span>`
          : '';
      })
      .join('');

    card.innerHTML = `
      <div class="player-head">
        <span class="player-name">${escapeHtml(player.name)}</span>
        <span class="badge">${player.isHost ? 'Host' : `Seat ${player.seat}`}</span>
      </div>
      <div class="player-stat-grid">
        <div><span>การ์ดในมือ</span><strong>${player.handCount}</strong></div>
        <div><span>รวมรอบก่อน</span><strong>${previousTotalScore}</strong></div>
        <div><span>รวมปัจจุบัน</span><strong>${currentTotalScore}</strong></div>
      </div>
      <div class="player-tokens">${tokenText || '<span class="token-pill empty">ยังไม่มีสัตว์</span>'}</div>
    `;
    if (isTurn) card.style.outline = '3px solid rgba(255, 183, 3, 0.55)';
    list.appendChild(card);
  }
}

function calculateLiveRoundScore(player) {
  if (!player) return 0;
  return state.animals.reduce((sum, animal) => {
    const pile = state.board[animal.key] || [];
    const latest = pile.length ? pile[pile.length - 1].value : 0;
    const tokenCount = player.tokens[animal.key] || 0;
    return sum + (latest * tokenCount);
  }, 0);
}

function renderBoard() {
  const rows = $('animalRows');
  rows.innerHTML = '';
  for (const animal of state.animals) {
    const pile = state.board[animal.key] || [];
    const latest = pile.length ? pile[pile.length - 1].value : 0;
    const row = document.createElement('div');
    row.className = 'animal-row';
    row.innerHTML = `
      <div class="animal-meta">
        <div class="animal-title"><span class="animal-emoji">${animal.emoji}</span><span>${animal.thai}</span></div>
        <div class="current-value">ค่าปัจจุบัน: <strong>${latest}</strong> · วางแล้ว ${pile.length}/6</div>
      </div>
      <div class="pile" aria-label="${animal.name} pile">
        ${pile.length ? pile.map((card) => cardHtml(card, animal, 'board-card')).join('') : '<div class="empty-state">ยังไม่มีการ์ด</div>'}
      </div>
      <div class="token-bank">
        <div class="big-token">${animal.emoji}</div>
        <div class="token-count">เหลือ ${state.availableTokens[animal.key] || 0}/${state.tokensPerAnimal || 0}</div>
      </div>
    `;
    rows.appendChild(row);
  }
}

function renderHand() {
  const hand = $('myHand');
  hand.innerHTML = '';
  const isMyTurn = state.phase === 'playing' && state.currentPlayerId === state.myId;
  $('handHint').textContent = isMyTurn
    ? 'ถึงตาคุณแล้ว คลิกการ์ดเพื่อวาง หรือเปิด Auto Play'
    : 'ลากการ์ดเพื่อเรียงลำดับได้ตลอดเวลา';

  hand.ondragover = handleHandDragOver;
  hand.ondrop = handleHandDrop;

  if (!state.myHand.length) {
    hand.innerHTML = '<div class="empty-state">ไม่มีการ์ดในมือ</div>';
    return;
  }

  state.myHand.forEach((card, index) => {
    const animal = animalMeta(card.animal);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `hand-card ${isMyTurn ? 'playable' : 'not-playable'}`;
    el.dataset.cardId = card.id;
    el.draggable = true;
    el.style.background = cardsFaceDown ? '' : cardBackground(animal.key);
    el.style.animationDelay = `${Math.min(index * 0.035, 0.5)}s`;
    el.setAttribute('aria-disabled', String(!isMyTurn));
    el.title = cardsFaceDown ? 'การ์ดถูกคว่ำอยู่: ลากเพื่อเรียงลำดับ หรือคลิกเพื่อวางเมื่อถึงตา' : 'ลากเพื่อเรียงลำดับการ์ด';
    if (cardsFaceDown) {
      el.classList.add('face-down');
      el.innerHTML = `
        <span class="card-back-icon">🦁</span>
        <span class="card-back-text">SAFARI</span>
      `;
    } else {
      el.innerHTML = `
        <span class="card-label">${animal.name}</span>
        <span class="card-emoji">${animal.emoji}</span>
        <span class="card-value">${card.value}</span>
      `;
    }
    el.addEventListener('click', () => {
      if (!isMyTurn) return;
      socket.emit('playCard', { cardId: card.id });
    });
    el.addEventListener('dragstart', (event) => {
      draggedCardId = card.id;
      el.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.id);
    });
    el.addEventListener('dragend', () => {
      draggedCardId = null;
      el.classList.remove('dragging');
      emitCurrentHandOrder();
    });
    hand.appendChild(el);
  });
}

function handleHandDragOver(event) {
  if (!draggedCardId) return;
  event.preventDefault();
  const hand = $('myHand');
  const dragging = hand.querySelector('.dragging');
  if (!dragging) return;
  const afterElement = getDragAfterElement(hand, event.clientX);
  if (afterElement == null) hand.appendChild(dragging);
  else hand.insertBefore(dragging, afterElement);
}

function handleHandDrop(event) {
  if (!draggedCardId) return;
  event.preventDefault();
  emitCurrentHandOrder();
}

function getDragAfterElement(container, x) {
  const draggableElements = [...container.querySelectorAll('.hand-card:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = x - box.left - box.width / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function emitCurrentHandOrder() {
  const hand = $('myHand');
  const cardIds = [...hand.querySelectorAll('.hand-card')].map((el) => el.dataset.cardId).filter(Boolean);
  if (cardIds.length === state.myHand.length) socket.emit('reorderHand', { cardIds });
}

function renderLog() {
  const log = $('gameLog');
  if (!state.log.length) {
    log.innerHTML = '<div class="empty-state">ยังไม่มี action</div>';
    return;
  }
  log.innerHTML = state.log.slice().reverse().map((entry) => {
    if (typeof entry === 'string') return `<div class="log-entry">${escapeHtml(entry)}</div>`;
    if (entry.type === 'move') return moveLogHtml(entry);
    return `<div class="log-entry text-log"><span class="log-stamp">${escapeHtml(entry.stamp || '')}</span><span class="log-message">${escapeHtml(entry.message || '')}</span></div>`;
  }).join('');
}

function moveLogHtml(entry) {
  const cardAnimal = animalMeta(entry.card.animal);
  const tokenAnimal = animalMeta(entry.tokenAnimalKey);
  return `
    <div class="log-entry kill-feed">
      <span class="log-stamp">${escapeHtml(entry.stamp || '')}</span>
      <strong class="feed-name">${escapeHtml(entry.playerName)}</strong>
      <span class="feed-card" style="background:${cardBackground(entry.card.animal)}">
        <span>${cardAnimal.emoji}</span><b>${entry.card.value}</b>
      </span>
      <span class="feed-arrow">➜</span>
      <span class="feed-token">${tokenAnimal.emoji}</span>
      ${entry.auto ? '<span class="feed-auto">AUTO</span>' : ''}
    </div>
  `;
}

function renderTokenModal() {
  const shouldShow = state.phase === 'take' && state.pendingTakePlayerId === state.myId && !state.myAutoPlay;
  tokenModal.classList.toggle('hidden', !shouldShow);
  if (!shouldShow) return;

  tokenChoices.innerHTML = '';
  for (const animal of state.animals) {
    const left = state.availableTokens[animal.key] || 0;
    const btn = document.createElement('button');
    btn.className = 'token-choice';
    btn.disabled = left <= 0;
    btn.innerHTML = `<span>${animal.emoji}</span><strong>${animal.thai}</strong><small>เหลือ ${left}</small>`;
    btn.addEventListener('click', () => socket.emit('takeToken', { animalKey: animal.key }));
    tokenChoices.appendChild(btn);
  }
}

function renderScoreModal() {
  if (state.phase !== 'round_end') return;
  if (scoreModalShownForRound === state.roundNo) return;
  scoreModalShownForRound = state.roundNo;
  const scores = [...state.players].sort((a, b) => (b.totalScore - a.totalScore) || (b.roundScore - a.roundScore) || (a.seat - b.seat));
  const medals = ['🥇', '🥈', '🥉'];
  const topThree = scores.slice(0, 3);
  const rest = scores.slice(3);
  $('scoreSummary').innerHTML = `
    <div class="scoreboard-head">
      <span class="scoreboard-kicker">Round ${state.roundNo} Complete</span>
      <strong>Score Board</strong>
      <small>อันดับเรียงตามคะแนนรวมปัจจุบัน</small>
    </div>
    <div class="podium">
      ${topThree.map((p, index) => podiumHtml(p, index, medals[index])).join('')}
    </div>
    <div class="score-list">
      ${rest.map((p, index) => scoreRowHtml(p, index + 4)).join('')}
    </div>
  `;
  scoreModal.classList.remove('hidden');
}

function podiumHtml(player, index, medal) {
  return `
    <div class="podium-card rank-${index + 1}">
      <div class="podium-medal">${medal}</div>
      <div class="podium-name">${escapeHtml(player.name)}</div>
      <div class="podium-score">${player.totalScore}</div>
      <div class="podium-round">รอบนี้ +${player.roundScore}</div>
    </div>
  `;
}

function scoreRowHtml(player, rank) {
  return `
    <div class="score-row compact">
      <span class="score-rank">#${rank}</span>
      <span>${escapeHtml(player.name)}</span>
      <span>รอบนี้ +${player.roundScore}</span>
      <strong>${player.totalScore}</strong>
    </div>
  `;
}

function cardHtml(card, animal, className) {
  return `
    <div class="${className}" style="background:${cardBackground(animal.key)}">
      <span class="card-label">${animal.name}</span>
      <span class="card-emoji">${animal.emoji}</span>
      <span class="card-value">${card.value}</span>
    </div>
  `;
}

function cardBackground(animalKey) {
  const gradients = {
    lion: 'linear-gradient(145deg, #ffcf56, #f4a261)',
    elephant: 'linear-gradient(145deg, #dff9fb, #a8dadc)',
    giraffe: 'linear-gradient(145deg, #ffe8a3, #e9c46a)',
    zebra: 'linear-gradient(145deg, #ffffff, #d8dee9)',
    hippo: 'linear-gradient(145deg, #e8ddff, #b8a1ff)'
  };
  return gradients[animalKey] || 'linear-gradient(145deg, #fff, #ddd)';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
