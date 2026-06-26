const socket = io();
let state = null;
let scoreModalShownForRound = 0;

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

const savedName = localStorage.getItem('botswanaPlayerName');
if (savedName) playerName.value = savedName;

const params = new URLSearchParams(window.location.search);
const roomFromUrl = params.get('room');
if (roomFromUrl) roomCode.value = roomFromUrl.toUpperCase();

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
  $('variantText').textContent = state.players.length === 6 ? '6P House-rule' : 'Classic style';
  $('playerCountText').textContent = `${state.players.length}/${state.maxPlayers}`;
  $('lastActionText').textContent = state.lastAction || 'พร้อมเล่น';

  startBtn.classList.toggle('hidden', !(state.isHost && state.phase === 'lobby'));
  nextRoundBtn.classList.toggle('hidden', !(state.isHost && state.phase === 'round_end'));
  resetBtn.classList.toggle('hidden', !(state.isHost && state.phase !== 'lobby'));

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

function renderPlayers() {
  const list = $('playersList');
  list.innerHTML = '';
  for (const player of state.players) {
    const card = document.createElement('div');
    card.className = 'player-card';
    const isTurn = state.currentPlayerId === player.id;
    const tokenText = state.animals
      .map((a) => (player.tokens[a.key] ? `<span class="token-pill">${a.emoji} ${player.tokens[a.key]}</span>` : ''))
      .join('');

    card.innerHTML = `
      <div class="player-head">
        <span class="player-name">${escapeHtml(player.name)}</span>
        <span class="badge">${player.isHost ? 'Host' : `Seat ${player.seat}`}</span>
      </div>
      <div class="score-line"><span>${player.connected ? '🟢 Online' : '⚪ Offline'}</span><span>การ์ด ${player.handCount}</span></div>
      <div class="score-line"><span>รอบนี้ ${player.roundScore}</span><strong>รวม ${player.totalScore}</strong></div>
      <div class="player-tokens">${tokenText || '<span class="token-pill">ยังไม่มีสัตว์</span>'}</div>
    `;
    if (isTurn) card.style.outline = '3px solid rgba(255, 183, 3, 0.55)';
    list.appendChild(card);
  }
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
  $('handHint').textContent = isMyTurn ? 'ถึงตาคุณแล้ว คลิกการ์ดเพื่อวาง' : 'รอถึงตาคุณก่อน';

  if (!state.myHand.length) {
    hand.innerHTML = '<div class="empty-state">ไม่มีการ์ดในมือ</div>';
    return;
  }

  state.myHand.forEach((card, index) => {
    const animal = animalMeta(card.animal);
    const el = document.createElement('button');
    el.className = `hand-card ${isMyTurn ? 'playable' : 'not-playable'}`;
    el.style.background = cardBackground(animal.key);
    el.style.animationDelay = `${Math.min(index * 0.035, 0.5)}s`;
    el.disabled = !isMyTurn;
    el.innerHTML = `
      <span class="card-label">${animal.name}</span>
      <span class="card-emoji">${animal.emoji}</span>
      <span class="card-value">${card.value}</span>
    `;
    el.addEventListener('click', () => {
      if (!isMyTurn) return;
      socket.emit('playCard', { cardId: card.id });
    });
    hand.appendChild(el);
  });
}

function renderLog() {
  const log = $('gameLog');
  if (!state.log.length) {
    log.innerHTML = '<div class="empty-state">ยังไม่มี action</div>';
    return;
  }
  log.innerHTML = state.log.slice().reverse().map((entry) => `<div class="log-entry">${escapeHtml(entry)}</div>`).join('');
}

function renderTokenModal() {
  const shouldShow = state.phase === 'take' && state.pendingTakePlayerId === state.myId;
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
  const scores = [...state.players].sort((a, b) => b.totalScore - a.totalScore);
  $('scoreSummary').innerHTML = scores.map((p, index) => `
    <div class="score-row">
      <span>${index === 0 ? '🏆 ' : ''}${escapeHtml(p.name)}</span>
      <span>รอบนี้ ${p.roundScore}</span>
      <strong>${p.totalScore}</strong>
    </div>
  `).join('');
  scoreModal.classList.remove('hidden');
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
