const socket = io();
let state = null;
let stateReceivedAt = Date.now();
let scoreModalShownForRound = 0;
let timerInterval = null;
let titleFlashInterval = null;
let originalTitle = document.title;
let draggedCardId = null;
let lastHandRenderSignature = '';
let lastHandInteractivitySignature = '';
localStorage.removeItem('botswanaCardsFaceDown');
let cardsFaceDown = localStorage.getItem('botswanaCardsFaceDownV2') === 'true';
let lastAnimatedMoveId = null;
let emojiCleanupTimer = null;
let openFloatingPanelId = '';
let mobileStatusTimer = null;

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
const emojiDock = $('emojiDock');
const rankingTrain = $('rankingTrain');
const compactTimerText = $('compactTimerText');
const compactTurnText = $('compactTurnText');
const compactRoundText = $('compactRoundText');
const compactPhaseText = $('compactPhaseText');
const compactVariantText = $('compactVariantText');
const rankingFab = $('rankingFab');
const logFab = $('logFab');
const emojiFab = $('emojiFab');
const rankingOverlay = $('rankingOverlay');
const logOverlay = $('logOverlay');
const emojiOverlay = $('emojiOverlay');
const rankingTable = $('rankingTable');
const mobileLog = $('mobileLog');

const fallbackAnimals = {
  lion: { key: 'lion', name: 'Lion', thai: 'สิงโต', emoji: '🦁' },
  elephant: { key: 'elephant', name: 'Elephant', thai: 'ช้าง', emoji: '🐘' },
  giraffe: { key: 'giraffe', name: 'Giraffe', thai: 'ยีราฟ', emoji: '🦒' },
  zebra: { key: 'zebra', name: 'Zebra', thai: 'ม้าลาย', emoji: '🦓' },
  hippo: { key: 'hippo', name: 'Hippo', thai: 'ฮิปโป', emoji: '🦛' },
  rhino: { key: 'rhino', name: 'Rhino', thai: 'แรด', emoji: '🦏' },
  crocodile: { key: 'crocodile', name: 'Crocodile', thai: 'จระเข้', emoji: '🐊' },
  monkey: { key: 'monkey', name: 'Monkey', thai: 'ลิง', emoji: '🐒' },
  tiger: { key: 'tiger', name: 'Tiger', thai: 'เสือ', emoji: '🐯' },
  panda: { key: 'panda', name: 'Panda', thai: 'แพนด้า', emoji: '🐼' },
  koala: { key: 'koala', name: 'Koala', thai: 'โคอาลา', emoji: '🐨' },
  fox: { key: 'fox', name: 'Fox', thai: 'จิ้งจอก', emoji: '🦊' }
};

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
    localStorage.setItem('botswanaCardsFaceDownV2', String(cardsFaceDown));
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

document.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-emoji]');
  if (!button) return;
  socket.emit('sendReaction', { emoji: button.dataset.emoji });
  if (window.matchMedia('(max-width: 900px)').matches) closeFloatingPanel('emojiOverlay');
});

function toggleFloatingPanel(panelId) {
  const panel = $(panelId);
  if (!panel) return;
  const shouldOpen = openFloatingPanelId !== panelId || panel.classList.contains('hidden');
  closeAllFloatingPanels();
  if (shouldOpen) {
    panel.classList.remove('hidden');
    openFloatingPanelId = panelId;
  }
  syncFloatingFabState();
}

function closeFloatingPanel(panelId) {
  const panel = $(panelId);
  if (!panel) return;
  panel.classList.add('hidden');
  if (openFloatingPanelId === panelId) openFloatingPanelId = '';
  syncFloatingFabState();
}

function closeAllFloatingPanels() {
  [rankingOverlay, logOverlay, emojiOverlay].forEach((panel) => panel?.classList.add('hidden'));
  openFloatingPanelId = '';
  syncFloatingFabState();
}

function syncFloatingFabState() {
  [rankingFab, logFab, emojiFab].forEach((btn) => {
    if (!btn) return;
    const panelId = btn.getAttribute('aria-controls');
    btn.setAttribute('aria-expanded', String(openFloatingPanelId === panelId));
    btn.classList.toggle('active', openFloatingPanelId === panelId);
  });
}

rankingFab?.addEventListener('click', () => toggleFloatingPanel('rankingOverlay'));
logFab?.addEventListener('click', () => toggleFloatingPanel('logOverlay'));
emojiFab?.addEventListener('click', () => toggleFloatingPanel('emojiOverlay'));
document.addEventListener('click', (event) => {
  const closeBtn = event.target.closest('[data-close-floating]');
  if (closeBtn) closeFloatingPanel(closeBtn.dataset.closeFloating);
});

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
  $('variantText').textContent = `${state.ruleSummary || `${state.animals.length} สัตว์`} · ${state.turnLimitSeconds || 30}s`;
  if (compactPhaseText) compactPhaseText.textContent = phaseLabel(state.phase);
  if (compactTurnText) compactTurnText.textContent = state.currentPlayerName || (state.phase === 'lobby' ? 'รอเริ่มเกม' : '-');
  if (compactRoundText) compactRoundText.textContent = state.roundNo || 0;
  if (compactVariantText) compactVariantText.textContent = `${state.animals.length} สัตว์ · ${state.turnLimitSeconds || 30}s`;
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
  renderRankingTrain();
  renderRankingOverlay();
  renderPlayers();
  renderBoard();
  scheduleEmojiReactionCleanup();
  renderHand();
  renderLog();
  renderMobileLog();
  if (isMyActionTurn()) closeAllFloatingPanels();
  runTokenMoveAnimation();
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
  return state.animals.find((a) => a.key === key) || fallbackAnimals[key] || { key, name: key || 'Animal', thai: key || 'Animal', emoji: '🐾' };
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
  startCompactTimerLoop();
  updateCompactTimer();
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
  updateCompactTimer(remainingMs);
}

function updateCompactTimer(remainingMsOverride) {
  if (!compactTimerText || !state) return;
  const showLive = state.phase === 'playing' || state.phase === 'take';
  let remainingMs = Number.isFinite(remainingMsOverride) ? remainingMsOverride : null;
  if (remainingMs == null && showLive) {
    const startRemaining = Number.isFinite(state.turnRemainingMs) ? state.turnRemainingMs : ((state.turnLimitSeconds || 30) * 1000);
    remainingMs = Math.max(0, startRemaining - (Date.now() - stateReceivedAt));
  }
  const seconds = showLive ? Math.ceil((remainingMs || 0) / 1000) : (state.turnLimitSeconds || 30);
  const minutesText = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secondsText = String(seconds % 60).padStart(2, '0');
  compactTimerText.textContent = `${minutesText}:${secondsText}`;
}

function stopTimerInterval() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startCompactTimerLoop() {
  if (mobileStatusTimer) clearInterval(mobileStatusTimer);
  if (!state || (state.phase !== 'playing' && state.phase !== 'take')) {
    mobileStatusTimer = null;
    return;
  }
  mobileStatusTimer = setInterval(() => updateCompactTimer(), 500);
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
    card.className = 'player-card compact-player-card';
    card.dataset.playerId = player.id;
    const isTurn = state.currentPlayerId === player.id || state.pendingTakePlayerId === player.id;
    const tokenText = state.animals
      .map((a) => {
        const count = player.tokens[a.key] || 0;
        return count
          ? `<span class="token-pill"><span class="token-pill-emoji">${a.emoji}</span><span class="token-pill-count">${count}</span></span>`
          : '';
      })
      .join('');

    const reaction = activeReactionForPlayer(player.id);
    card.innerHTML = `
      ${reaction ? `<div class="emoji-bubble" aria-label="emoji reaction">${escapeHtml(reaction.emoji)}</div>` : ''}
      <div class="player-head">
        <span class="player-name">${escapeHtml(player.name)}</span>
        <span class="badge">Seat ${player.seat}</span>
      </div>
      <div class="player-hand-count">การ์ดในมือ <strong>${player.handCount}</strong> ใบ</div>
      <div class="player-tokens">${tokenText || '<span class="token-pill empty">ยังไม่มีสัตว์</span>'}</div>
    `;
    if (isTurn) card.style.outline = '3px solid rgba(255, 183, 3, 0.55)';
    list.appendChild(card);
  }
}

function renderRankingTrain() {
  if (!rankingTrain || !state) return;
  if (!state.players.length) {
    rankingTrain.innerHTML = '<span class="ranking-empty">ยังไม่มีผู้เล่น</span>';
    return;
  }

  const ranking = getRankingData();
  rankingTrain.innerHTML = `
    <div class="ranking-label">Realtime Ranking</div>
    <div class="train-track">
      ${ranking.map((player, index) => `
        <div class="train-car ${index === 0 ? 'leader' : ''}" title="${escapeHtml(player.name)}: ${player.liveScore}">
          <span class="train-rank">${index === 0 ? '👑' : `#${index + 1}`}</span>
          <strong>${escapeHtml(player.name)}</strong>
          <small>${player.liveScore}</small>
        </div>
      `).join('<span class="train-link">→</span>')}
    </div>
  `;
}

function activeReactionForPlayer(playerId) {
  const now = Date.now();
  return (state.reactions || [])
    .filter((reaction) => reaction.playerId === playerId && now - Number(reaction.createdAt || 0) < 4200)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0] || null;
}

function scheduleEmojiReactionCleanup() {
  if (emojiCleanupTimer) clearTimeout(emojiCleanupTimer);
  const now = Date.now();
  const active = (state.reactions || [])
    .map((reaction) => 4200 - (now - Number(reaction.createdAt || 0)))
    .filter((ms) => ms > 0);
  if (!active.length) return;
  emojiCleanupTimer = setTimeout(() => {
    renderPlayers();
    emojiCleanupTimer = null;
  }, Math.min(...active) + 50);
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
    const left = state.availableTokens[animal.key] || 0;
    const hasTokenBank = (state.tokensPerAnimal || 0) > 0;
    const tokenStateClass = hasTokenBank ? (left <= 0 ? 'token-empty' : (left <= 1 ? 'token-low' : '')) : '';
    const row = document.createElement('div');
    row.className = `animal-row ${tokenStateClass}`;
    row.innerHTML = `
      <div class="animal-meta">
        <div class="animal-title"><span class="animal-emoji">${animal.emoji}</span><span>${animal.thai}</span></div>
        <div class="current-value">ค่าปัจจุบัน: <strong>${latest}</strong> · วางแล้ว ${pile.length}/${state.cardsPerAnimal || 6}</div>
      </div>
      <div class="pile" aria-label="${animal.name} pile">
        ${pile.length ? pile.map((card) => cardHtml(card, animal, 'board-card')).join('') : '<div class="empty-state">ยังไม่มีการ์ด</div>'}
      </div>
      <div class="token-bank ${tokenStateClass}" data-token-bank="${animal.key}">
        <div class="big-token">${animal.emoji}</div>
        <div class="token-count">${hasTokenBank ? (left <= 0 ? 'หมดแล้ว' : `เหลือ ${left}/${state.tokensPerAnimal || 0}`) : 'รอเริ่ม'}</div>
      </div>
    `;
    rows.appendChild(row);
  }
}

function handSignatureFromState() {
  if (!state || !Array.isArray(state.myHand)) return `empty|face:${cardsFaceDown ? 'down' : 'up'}`;
  return `${state.myHand.map((card) => card.id).join('|')}|face:${cardsFaceDown ? 'down' : 'up'}`;
}

function handSignatureFromDom() {
  const hand = $('myHand');
  const ids = [...hand.querySelectorAll('.hand-card')].map((el) => el.dataset.cardId).filter(Boolean);
  return `${ids.join('|')}|face:${cardsFaceDown ? 'down' : 'up'}`;
}

function isTouchLikeDevice() {
  return window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
}

function renderHand() {
  const hand = $('myHand');
  const isMyTurn = state.phase === 'playing' && state.currentPlayerId === state.myId;
  $('handHint').textContent = isMyTurn
    ? 'ถึงตาคุณแล้ว แตะ/คลิกการ์ดเพื่อวาง'
    : 'เรียงการ์ดได้บนคอมพิวเตอร์ · มือถือแตะการ์ดได้เสถียรขึ้น';

  hand.ondragover = handleHandDragOver;
  hand.ondrop = handleHandDrop;

  const signature = handSignatureFromState();
  const hasSameCards = signature === lastHandRenderSignature && hand.querySelectorAll('.hand-card').length === state.myHand.length;
  if (hasSameCards) {
    updateHandInteractivity(hand, isMyTurn);
    return;
  }

  lastHandRenderSignature = signature;
  lastHandInteractivitySignature = '';
  hand.innerHTML = '';

  if (!state.myHand.length) {
    hand.innerHTML = '<div class="empty-state">ไม่มีการ์ดในมือ</div>';
    return;
  }

  state.myHand.forEach((card) => {
    const el = createHandCardElement(card, isMyTurn);
    hand.appendChild(el);
  });
  updateHandInteractivity(hand, isMyTurn);
}

function createHandCardElement(card, isMyTurn) {
  const animal = animalMeta(card.animal);
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `hand-card ${isMyTurn ? 'playable' : 'not-playable'}`;
  el.dataset.cardId = card.id;
  el.dataset.cardAnimal = card.animal;
  el.dataset.cardValue = String(card.value);
  el.draggable = !isTouchLikeDevice();
  el.style.background = cardsFaceDown ? '' : cardBackground(animal.key);
  el.setAttribute('aria-disabled', String(!isMyTurn));
  el.title = cardsFaceDown ? 'การ์ดถูกคว่ำอยู่: แตะเพื่อวางเมื่อถึงตา' : 'แตะเพื่อวางเมื่อถึงตา';

  renderHandCardFace(el, card, animal);

  el.addEventListener('click', () => {
    if (!state || !(state.phase === 'playing' && state.currentPlayerId === state.myId)) return;
    socket.emit('playCard', { cardId: card.id });
  });
  el.addEventListener('dragstart', (event) => {
    if (isTouchLikeDevice()) {
      event.preventDefault();
      return;
    }
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
  return el;
}

function renderHandCardFace(el, card, animal) {
  el.classList.toggle('face-down', cardsFaceDown);
  el.style.background = cardsFaceDown ? '' : cardBackground(animal.key);
  if (cardsFaceDown) {
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
}

function updateHandInteractivity(hand, isMyTurn) {
  const signature = `${isMyTurn ? 'turn' : 'wait'}|${cardsFaceDown ? 'down' : 'up'}|${state.currentPlayerId || ''}|${state.phase}`;
  if (signature === lastHandInteractivitySignature) return;
  lastHandInteractivitySignature = signature;
  [...hand.querySelectorAll('.hand-card')].forEach((el) => {
    el.classList.toggle('playable', isMyTurn);
    el.classList.toggle('not-playable', !isMyTurn);
    el.setAttribute('aria-disabled', String(!isMyTurn));
    el.draggable = !isTouchLikeDevice();
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
  if (cardIds.length === state.myHand.length) {
    lastHandRenderSignature = handSignatureFromDom();
    socket.emit('reorderHand', { cardIds });
  }
}


function getRankingData() {
  return [...state.players]
    .map((player) => ({
      ...player,
      liveScore: state.phase === 'round_end' ? player.roundScore : calculateLiveRoundScore(player)
    }))
    .sort((a, b) => (b.liveScore - a.liveScore) || (b.totalScore - a.totalScore) || (a.seat - b.seat));
}

function renderRankingOverlay() {
  if (!rankingTable || !state) return;
  const ranking = getRankingData();
  rankingTable.innerHTML = ranking.map((player, index) => `
    <div class="ranking-row ${index === 0 ? 'leader' : ''}">
      <span class="ranking-rank">${index === 0 ? '👑' : `#${index + 1}`}</span>
      <strong>${escapeHtml(player.name)}</strong>
      <span class="ranking-live">${player.liveScore}</span>
      <small class="ranking-total">รวม ${player.totalScore}</small>
    </div>
  `).join('') || '<div class="empty-state">ยังไม่มีผู้เล่น</div>';
}

function buildLogHtml() {
  if (!state.log.length) return '<div class="empty-state">ยังไม่มี action</div>';
  return state.log.slice().reverse().map((entry) => {
    if (typeof entry === 'string') return `<div class="log-entry">${escapeHtml(entry)}</div>`;
    if (entry.type === 'move') return moveLogHtml(entry);
    if (entry.type === 'card') return cardLogHtml(entry);
    if (entry.type === 'take') return takeLogHtml(entry);
    return `<div class="log-entry text-log"><span class="log-stamp">${escapeHtml(entry.stamp || '')}</span><span class="log-message">${escapeHtml(entry.message || '')}</span></div>`;
  }).join('');
}

function renderMobileLog() {
  if (!mobileLog) return;
  mobileLog.innerHTML = buildLogHtml();
}

function renderLog() {
  const log = $('gameLog');
  log.innerHTML = buildLogHtml();
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


function cardLogHtml(entry) {
  const cardAnimal = animalMeta(entry.card.animal);
  return `
    <div class="log-entry kill-feed card-only">
      <span class="log-stamp">${escapeHtml(entry.stamp || '')}</span>
      <strong class="feed-name">${escapeHtml(entry.playerName)}</strong>
      <span class="feed-action">วาง</span>
      <span class="feed-card" style="background:${cardBackground(entry.card.animal)}">
        <span>${cardAnimal.emoji}</span><b>${entry.card.value}</b>
      </span>
      ${entry.auto ? '<span class="feed-auto">AUTO</span>' : ''}
    </div>
  `;
}

function takeLogHtml(entry) {
  const tokenAnimal = animalMeta(entry.tokenAnimalKey);
  return `
    <div class="log-entry kill-feed take-only">
      <span class="log-stamp">${escapeHtml(entry.stamp || '')}</span>
      <strong class="feed-name">${escapeHtml(entry.playerName)}</strong>
      <span class="feed-action">หยิบ</span>
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
  const result = state.roundResult || null;
  const resultId = result?.id || `round-${state.roundNo}-${state.players.map((p) => `${p.id}:${p.totalScore}`).join('|')}`;
  if (scoreModalShownForRound === resultId) return;
  scoreModalShownForRound = resultId;
  const scores = result?.standings || [...state.players]
    .sort((a, b) => (b.totalScore - a.totalScore) || (b.roundScore - a.roundScore) || (a.seat - b.seat))
    .map((p, index) => ({ ...p, rank: index + 1 }));
  const medals = ['🥇', '🥈', '🥉'];
  const topThree = scores.slice(0, 3);
  const rest = scores.slice(3);
  $('scoreSummary').innerHTML = `
    <div class="scoreboard-head">
      <span class="scoreboard-kicker">Round ${result?.roundNo || state.roundNo} Complete</span>
      <strong>Score Board</strong>
      <small>${escapeHtml(result?.reason || 'สรุปคะแนนท้ายรอบ')} · ${escapeHtml(result?.ruleSummary || state.ruleSummary || '')}</small>
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

function runTokenMoveAnimation() {
  const move = state?.lastTokenMove;
  if (!move || move.id === lastAnimatedMoveId) return;
  lastAnimatedMoveId = move.id;
  window.requestAnimationFrame(() => animateTokenMove(move));
}

function animateTokenMove(move) {
  const animal = animalMeta(move.animalKey);
  if (!animal) return;
  const sourceBank = [...document.querySelectorAll('[data-token-bank]')]
    .find((el) => el.dataset.tokenBank === move.animalKey);
  const targetCard = [...document.querySelectorAll('[data-player-id]')]
    .find((el) => el.dataset.playerId === move.playerId);
  const source = sourceBank?.querySelector('.big-token');
  const target = targetCard?.querySelector('.player-tokens') || targetCard;
  if (!source || !target) return;
  const srcRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const flyer = document.createElement('div');
  flyer.className = 'flying-token';
  flyer.textContent = animal.emoji;
  flyer.style.left = `${srcRect.left + srcRect.width / 2 - 20}px`;
  flyer.style.top = `${srcRect.top + srcRect.height / 2 - 20}px`;
  document.body.appendChild(flyer);
  const dx = targetRect.left + targetRect.width / 2 - (srcRect.left + srcRect.width / 2);
  const dy = targetRect.top + targetRect.height / 2 - (srcRect.top + srcRect.height / 2);
  const animation = flyer.animate([
    { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.45}px, ${dy * 0.35 - 70}px) scale(1.18)`, opacity: 1, offset: 0.55 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.72)`, opacity: 0.2 }
  ], { duration: 820, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
  animation.onfinish = () => flyer.remove();
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
    hippo: 'linear-gradient(145deg, #e8ddff, #b8a1ff)',
    rhino: 'linear-gradient(145deg, #eef3f7, #b7c4cf)',
    crocodile: 'linear-gradient(145deg, #d9f99d, #80c783)',
    monkey: 'linear-gradient(145deg, #f6d7b0, #d6a06b)',
    tiger: 'linear-gradient(145deg, #fed7aa, #f97316)',
    panda: 'linear-gradient(145deg, #ffffff, #d1d5db)',
    koala: 'linear-gradient(145deg, #e2e8f0, #94a3b8)',
    fox: 'linear-gradient(145deg, #fdba74, #fb923c)'
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
