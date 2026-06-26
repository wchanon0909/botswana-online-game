const express = require('express');
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const DEFAULT_TURN_SECONDS = 30;
const MIN_TURN_SECONDS = 5;
const MAX_TURN_SECONDS = 180;
const DEFAULT_PLAYER_LIMIT = 5;
const MAX_PLAYERS = 7;
const BASE_ANIMAL_COUNT = 5;
const EXTRA_ANIMAL_COUNT = 6;
const TOKENS_PER_ANIMAL = 5;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const publicDir = path.join(__dirname, 'public');
const indexFile = path.join(publicDir, 'index.html');

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, service: 'botswana-online-game' });
});

app.use(express.static(publicDir));

app.get('/', (req, res) => {
  if (!fs.existsSync(indexFile)) {
    return res.status(500).send('public/index.html is missing. Please upload the public folder to GitHub.');
  }
  return res.sendFile(indexFile);
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/socket.io')) return next();
  if (!fs.existsSync(indexFile)) {
    return res.status(500).send('public/index.html is missing. Please upload the public folder to GitHub.');
  }
  return res.sendFile(indexFile);
});

const ANIMALS = [
  { key: 'lion', name: 'Lion', thai: 'สิงโต', emoji: '🦁', accent: '#f4a261' },
  { key: 'elephant', name: 'Elephant', thai: 'ช้าง', emoji: '🐘', accent: '#a8dadc' },
  { key: 'giraffe', name: 'Giraffe', thai: 'ยีราฟ', emoji: '🦒', accent: '#e9c46a' },
  { key: 'zebra', name: 'Zebra', thai: 'ม้าลาย', emoji: '🦓', accent: '#e5e5e5' },
  { key: 'hippo', name: 'Hippo', thai: 'ฮิปโป', emoji: '🦛', accent: '#b8a1ff' },
  { key: 'rhino', name: 'Rhino', thai: 'แรด', emoji: '🦏', accent: '#b7c4cf' }
];

const rooms = new Map();
const socketToRoom = new Map();
let logSeq = 1;

function randomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i += 1) code += letters[Math.floor(Math.random() * letters.length)];
  return code;
}

function uniqueCode() {
  let code = randomCode();
  while (rooms.has(code)) code = randomCode();
  return code;
}

function shuffle(array) {
  const cloned = [...array];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}

function activeAnimalsForPlayerCount(playerCount) {
  const count = playerCount > DEFAULT_PLAYER_LIMIT ? EXTRA_ANIMAL_COUNT : BASE_ANIMAL_COUNT;
  return ANIMALS.slice(0, count);
}

function roomAnimals(room) {
  return room.animals || activeAnimalsForPlayerCount(room.players?.length || 0);
}

function syncLobbyAnimals(room) {
  if (!room || room.phase !== 'lobby') return;
  room.animals = activeAnimalsForPlayerCount(room.players.length);
  room.board = initialBoard(room.animals);
  room.availableTokens = Object.fromEntries(room.animals.map((a) => [a.key, 0]));
}

function makeDeck(animals = ANIMALS) {
  const deck = [];
  for (const animal of animals) {
    for (let value = 0; value <= 5; value += 1) {
      deck.push({ id: `${animal.key}-${value}`, animal: animal.key, value });
    }
  }
  return shuffle(deck);
}

function emptyTokenSet(animals = ANIMALS) {
  return Object.fromEntries(animals.map((a) => [a.key, 0]));
}

function initialBoard(animals = ANIMALS) {
  return Object.fromEntries(animals.map((a) => [a.key, []]));
}

function compactPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    seat: player.seat,
    connected: player.connected,
    isHost: player.isHost,
    totalScore: player.totalScore,
    roundScore: player.roundScore,
    handCount: player.hand.length,
    tokens: player.tokens,
    autoPlay: player.autoPlay,
    autoPlayTemporary: player.autoPlayTemporary
  };
}

function orderedPlayers(room) {
  return [...room.players].sort((a, b) => (a.seat - b.seat) || a.name.localeCompare(b.name));
}

function roomPublicState(room, socketId) {
  const me = room.players.find((p) => p.id === socketId);
  const playersInTurnOrder = orderedPlayers(room);
  return {
    roomCode: room.code,
    phase: room.phase,
    roundNo: room.roundNo,
    maxPlayers: room.maxPlayers,
    hostId: room.hostId,
    currentPlayerId: room.currentPlayerId,
    currentPlayerName: room.players.find((p) => p.id === room.currentPlayerId)?.name || '',
    pendingTakePlayerId: room.pendingTakePlayerId,
    startedAt: room.startedAt,
    turnStartedAt: room.turnStartedAt,
    turnLimitSeconds: room.turnLimitSeconds,
    turnRemainingMs: getTurnRemainingMs(room),
    lastAction: room.lastAction,
    log: room.log.slice(-12),
    animals: roomAnimals(room),
    board: room.board,
    availableTokens: room.availableTokens,
    tokensPerAnimal: room.tokensPerAnimal,
    players: playersInTurnOrder.map(compactPlayer),
    myId: socketId,
    myHand: me ? me.hand : [],
    mySeat: me ? me.seat : null,
    myAutoPlay: me ? me.autoPlay : false,
    myAutoPlayTemporary: me ? me.autoPlayTemporary : false,
    isHost: socketId === room.hostId,
    error: null
  };
}

function emitRoom(room) {
  for (const player of room.players) {
    const socket = io.sockets.sockets.get(player.id);
    if (socket) socket.emit('state', roomPublicState(room, player.id));
  }
}

function nowStamp() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date());
}

function pushTextLog(room, message) {
  room.log.push({ id: logSeq += 1, type: 'text', stamp: nowStamp(), message });
  room.lastAction = message;
  if (room.log.length > 60) room.log.shift();
}

function pushCardLog(room, player, card, auto = false) {
  const cardAnimal = animalByKey(card.animal);
  const message = `${player.name} วาง ${cardAnimal.thai} ${card.value}${auto ? ' ด้วย Auto Play' : ''}`;
  room.log.push({
    id: logSeq += 1,
    type: 'card',
    stamp: nowStamp(),
    playerName: player.name,
    card,
    auto,
    message
  });
  room.lastAction = message;
  if (room.log.length > 60) room.log.shift();
}

function pushTakeLog(room, player, tokenAnimalKey, auto = false) {
  const tokenAnimal = animalByKey(tokenAnimalKey);
  const message = `${player.name} หยิบ ${tokenAnimal.thai}${auto ? ' ด้วย Auto Play' : ''}`;
  room.log.push({
    id: logSeq += 1,
    type: 'take',
    stamp: nowStamp(),
    playerName: player.name,
    tokenAnimalKey,
    auto,
    message
  });
  room.lastAction = message;
  if (room.log.length > 60) room.log.shift();
}

function animalByKey(key) {
  return ANIMALS.find((a) => a.key === key) || ANIMALS[0];
}

function createRoom(hostId, hostName) {
  const code = uniqueCode();
  const room = {
    code,
    hostId,
    phase: 'lobby',
    roundNo: 0,
    maxPlayers: MAX_PLAYERS,
    startedAt: null,
    turnStartedAt: null,
    turnLimitSeconds: DEFAULT_TURN_SECONDS,
    timerHandle: null,
    timerNonce: 0,
    currentPlayerId: null,
    currentPlayerIndex: 0,
    pendingTakePlayerId: null,
    pendingCard: null,
    lastAction: 'ห้องพร้อมแล้ว ชวนเพื่อนเข้าเล่นออนไลน์ได้เลย',
    log: [],
    animals: activeAnimalsForPlayerCount(1),
    board: initialBoard(activeAnimalsForPlayerCount(1)),
    availableTokens: Object.fromEntries(activeAnimalsForPlayerCount(1).map((a) => [a.key, 0])),
    tokensPerAnimal: 0,
    players: []
  };
  const player = makePlayer(hostId, hostName, 1, true);
  room.players.push(player);
  pushTextLog(room, `${player.name} สร้างห้อง ${code}`);
  rooms.set(code, room);
  socketToRoom.set(hostId, code);
  return room;
}

function makePlayer(socketId, name, seat, isHost = false) {
  return {
    id: socketId,
    name: cleanName(name),
    seat,
    connected: true,
    isHost,
    totalScore: 0,
    roundScore: 0,
    hand: [],
    tokens: emptyTokenSet(),
    autoPlay: false,
    autoPlayTemporary: false
  };
}

function cleanName(name) {
  const cleaned = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 22);
  return cleaned || 'Safari Friend';
}

function availableSeats(room) {
  const used = new Set(room.players.map((p) => p.seat));
  const seats = [];
  for (let i = 1; i <= room.maxPlayers; i += 1) if (!used.has(i)) seats.push(i);
  return seats;
}

function shuffleSeats(room) {
  const shuffled = shuffle(room.players);
  shuffled.forEach((player, index) => {
    player.seat = index + 1;
  });
  room.players = orderedPlayers(room);
  room.currentPlayerIndex = 0;
  const orderText = room.players.map((p, index) => `${index + 1}. ${p.name}`).join(' → ');
  pushTextLog(room, `สุ่มลำดับการเล่นใหม่: ${orderText}`);
}

function joinRoom(socketId, roomCode, name) {
  const code = String(roomCode || '').toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) return { error: 'ไม่พบห้องนี้ ลองตรวจ room code อีกครั้ง' };
  if (room.phase !== 'lobby') return { error: 'เกมเริ่มแล้ว ห้องนี้ยังไม่เปิดรับผู้เล่นใหม่' };
  if (room.players.length >= room.maxPlayers) return { error: 'ห้องเต็มแล้ว รองรับสูงสุด 7 คน' };

  const oldCode = socketToRoom.get(socketId);
  if (oldCode && oldCode !== code) leaveCurrentRoom(socketId);

  const seat = availableSeats(room)[0];
  const player = makePlayer(socketId, name, seat, false);
  room.players.push(player);
  socketToRoom.set(socketId, code);
  syncLobbyAnimals(room);
  pushTextLog(room, `${player.name} เข้าห้อง`);
  return { room };
}

function leaveCurrentRoom(socketId) {
  const code = socketToRoom.get(socketId);
  if (!code) return;
  const room = rooms.get(code);
  if (!room) return;
  const player = room.players.find((p) => p.id === socketId);
  if (player) {
    player.connected = false;
    pushTextLog(room, `${player.name} ออกจากห้อง`);
  }

  if (room.phase === 'lobby') {
    room.players = room.players.filter((p) => p.id !== socketId);
    if (room.hostId === socketId && room.players.length > 0) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
      pushTextLog(room, `${room.players[0].name} เป็น host คนใหม่`);
    }
    syncLobbyAnimals(room);
  }

  socketToRoom.delete(socketId);
  if (room.players.length === 0 || room.players.every((p) => !p.connected)) {
    clearRoomTimer(room);
    rooms.delete(code);
  } else {
    afterRoomChange(room);
  }
}

function startRound(room) {
  const playerCount = room.players.length;
  if (playerCount < 2) throw new Error('ต้องมีอย่างน้อย 2 คนถึงเริ่มเกมได้');
  if (playerCount > room.maxPlayers) throw new Error('ห้องนี้รองรับสูงสุด 7 คน');

  if (room.roundNo === 0) shuffleSeats(room);

  room.phase = 'playing';
  room.roundNo += 1;
  room.animals = activeAnimalsForPlayerCount(playerCount);
  room.board = initialBoard(room.animals);
  room.pendingTakePlayerId = null;
  room.pendingCard = null;
  room.tokensPerAnimal = TOKENS_PER_ANIMAL;
  room.availableTokens = Object.fromEntries(room.animals.map((a) => [a.key, room.tokensPerAnimal]));

  const deck = makeDeck(room.animals);
  const handSize = Math.floor(deck.length / playerCount);
  room.players = orderedPlayers(room);
  const sortedPlayers = room.players;
  for (const player of sortedPlayers) {
    player.hand = [];
    player.tokens = emptyTokenSet(room.animals);
    player.roundScore = 0;
    if (player.autoPlayTemporary) {
      player.autoPlay = false;
      player.autoPlayTemporary = false;
    }
  }
  for (let i = 0; i < handSize * playerCount; i += 1) {
    sortedPlayers[i % playerCount].hand.push(deck[i]);
  }
  for (const player of sortedPlayers) {
    player.hand.sort((a, b) => (a.animal.localeCompare(b.animal) || a.value - b.value));
  }

  if (room.roundNo === 1) {
    room.currentPlayerIndex = 0;
  } else {
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % playerCount;
  }
  room.currentPlayerId = sortedPlayers[room.currentPlayerIndex].id;
  room.startedAt = Date.now();
  room.turnStartedAt = Date.now();
  const animalNote = room.animals.length > BASE_ANIMAL_COUNT ? ' ใช้สัตว์ 6 ชนิดสำหรับผู้เล่น 6–7 คน' : ' ใช้สัตว์ 5 ชนิด';
  pushTextLog(room, `เริ่มรอบ ${room.roundNo} แจกการ์ดคนละ ${handSize} ใบ.${animalNote}`);
}

function playCard(room, socketId, cardId, auto = false) {
  if (room.phase !== 'playing') throw new Error('ตอนนี้ยังวางการ์ดไม่ได้');
  if (room.currentPlayerId !== socketId) throw new Error('ยังไม่ใช่ตาของคุณ');
  const player = room.players.find((p) => p.id === socketId);
  if (!player) throw new Error('ไม่พบผู้เล่น');
  const index = player.hand.findIndex((c) => c.id === cardId);
  if (index < 0) throw new Error('ไม่มีการ์ดใบนี้ในมือ');
  const [card] = player.hand.splice(index, 1);
  room.board[card.animal].push(card);
  room.pendingTakePlayerId = socketId;
  room.pendingCard = { playerId: socketId, card, auto };
  room.phase = 'take';
  room.turnStartedAt = Date.now();
  pushCardLog(room, player, card, auto);

  if (totalAvailableTokens(room) <= 0) {
    endRound(room, 'สัตว์ในกองกลางหมดแล้ว');
  }
}

function takeToken(room, socketId, animalKey, auto = false) {
  if (room.phase !== 'take') throw new Error('ตอนนี้ยังหยิบสัตว์ไม่ได้');
  if (room.pendingTakePlayerId !== socketId) throw new Error('ผู้เล่นที่วางการ์ดต้องเป็นคนหยิบสัตว์');
  if (!roomAnimals(room).some((a) => a.key === animalKey)) throw new Error('ชนิดสัตว์ไม่ถูกต้อง');
  if ((room.availableTokens[animalKey] || 0) <= 0) throw new Error('สัตว์ชนิดนี้หมดแล้ว');

  const player = room.players.find((p) => p.id === socketId);
  if (!player) throw new Error('ไม่พบผู้เล่น');
  player.tokens[animalKey] += 1;
  room.availableTokens[animalKey] -= 1;
  const moveAuto = auto || Boolean(room.pendingCard?.auto) || player.autoPlay;
  pushTakeLog(room, player, animalKey, moveAuto);
  room.pendingCard = null;

  const roundEndAnimal = roomAnimals(room).find((a) => room.board[a.key].length >= 6);
  if (roundEndAnimal) {
    resetTemporaryAutoPlay(player);
    endRound(room, `${roundEndAnimal.thai} ถูกวางครบ 6 ใบ`);
    return;
  }
  if (totalAvailableTokens(room) <= 0) {
    resetTemporaryAutoPlay(player);
    endRound(room, 'สัตว์ในกองกลางหมดแล้ว');
    return;
  }
  if (room.players.every((p) => p.hand.length === 0)) {
    resetTemporaryAutoPlay(player);
    endRound(room, 'การ์ดทุกคนหมดมือ');
    return;
  }

  resetTemporaryAutoPlay(player);
  room.phase = 'playing';
  room.pendingTakePlayerId = null;
  moveToNextPlayer(room);
}

function resetTemporaryAutoPlay(player) {
  if (player.autoPlayTemporary) {
    player.autoPlay = false;
    player.autoPlayTemporary = false;
  }
}

function moveToNextPlayer(room) {
  const count = room.players.length;
  for (let i = 1; i <= count; i += 1) {
    const nextIndex = (room.currentPlayerIndex + i) % count;
    const nextPlayer = room.players[nextIndex];
    if (nextPlayer.connected && nextPlayer.hand.length > 0) {
      room.currentPlayerIndex = nextIndex;
      room.currentPlayerId = nextPlayer.id;
      room.turnStartedAt = Date.now();
      return;
    }
  }
  endRound(room, 'ไม่มีผู้เล่นที่มีการ์ดเหลือ');
}

function totalAvailableTokens(room) {
  return Object.values(room.availableTokens).reduce((sum, n) => sum + n, 0);
}

function scoreValues(room) {
  const values = {};
  for (const animal of roomAnimals(room)) {
    const pile = room.board[animal.key];
    values[animal.key] = pile.length ? pile[pile.length - 1].value : 0;
  }
  return values;
}

function endRound(room, reason) {
  const values = scoreValues(room);
  for (const player of room.players) {
    let score = 0;
    for (const animal of roomAnimals(room)) score += (player.tokens[animal.key] || 0) * values[animal.key];
    player.roundScore = score;
    player.totalScore += score;
    if (player.autoPlayTemporary) {
      player.autoPlay = false;
      player.autoPlayTemporary = false;
    }
  }
  room.phase = 'round_end';
  room.pendingTakePlayerId = null;
  room.pendingCard = null;
  room.currentPlayerId = null;
  room.turnStartedAt = null;
  clearRoomTimer(room);
  pushTextLog(room, `จบรอบ ${room.roundNo}: ${reason}`);
}

function resetRoom(room) {
  clearRoomTimer(room);
  room.phase = 'lobby';
  room.roundNo = 0;
  room.currentPlayerId = null;
  room.turnStartedAt = null;
  room.currentPlayerIndex = 0;
  room.pendingTakePlayerId = null;
  room.pendingCard = null;
  room.animals = activeAnimalsForPlayerCount(room.players.length);
  room.board = initialBoard(room.animals);
  room.availableTokens = Object.fromEntries(room.animals.map((a) => [a.key, 0]));
  room.tokensPerAnimal = 0;
  for (const player of room.players) {
    player.totalScore = 0;
    player.roundScore = 0;
    player.hand = [];
    player.tokens = emptyTokenSet(room.animals);
    player.autoPlay = false;
    player.autoPlayTemporary = false;
  }
  pushTextLog(room, 'รีเซ็ตเกม กลับสู่ lobby');
}

function actionPlayerId(room) {
  if (room.phase === 'playing') return room.currentPlayerId;
  if (room.phase === 'take') return room.pendingTakePlayerId;
  return null;
}

function getTurnRemainingMs(room) {
  if (!room || !actionPlayerId(room) || !room.turnStartedAt) return 0;
  return Math.max(0, (room.turnLimitSeconds * 1000) - (Date.now() - room.turnStartedAt));
}

function clearRoomTimer(room) {
  if (room.timerHandle) clearTimeout(room.timerHandle);
  room.timerHandle = null;
}

function scheduleRoomTimer(room) {
  clearRoomTimer(room);
  const playerId = actionPlayerId(room);
  if (!playerId) return;
  const player = room.players.find((p) => p.id === playerId);
  if (!player || player.autoPlay) return;
  room.timerNonce += 1;
  const nonce = room.timerNonce;
  const delay = Math.max(1000, getTurnRemainingMs(room) || (room.turnLimitSeconds * 1000));
  room.timerHandle = setTimeout(() => handleTurnTimeout(room.code, nonce), delay + 150);
}

function handleTurnTimeout(roomCode, nonce) {
  const room = rooms.get(roomCode);
  if (!room || room.timerNonce !== nonce) return;
  const playerId = actionPlayerId(room);
  if (!playerId) return;
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return;
  if (!player.autoPlay) {
    player.autoPlay = true;
    player.autoPlayTemporary = true;
    pushTextLog(room, `⏱️ ${player.name} หมดเวลา เปิด Auto Play ชั่วคราว`);
  }
  afterRoomChange(room);
}

function selectLeastAvailableAnimal(room) {
  return roomAnimals(room)
    .map((animal, index) => ({ animal, index, left: room.availableTokens[animal.key] || 0 }))
    .filter((item) => item.left > 0)
    .sort((a, b) => (a.left - b.left) || (a.index - b.index))[0]?.animal.key;
}

function resolveAutoActions(room) {
  let guard = 0;
  while ((room.phase === 'playing' || room.phase === 'take') && guard < 80) {
    guard += 1;
    if (room.phase === 'playing') {
      const player = room.players.find((p) => p.id === room.currentPlayerId);
      if (!player || !player.connected || player.hand.length === 0) break;
      if (!player.autoPlay) break;
      const card = player.hand[0];
      playCard(room, player.id, card.id, true);
      continue;
    }

    if (room.phase === 'take') {
      const player = room.players.find((p) => p.id === room.pendingTakePlayerId);
      if (!player || !player.connected) break;
      if (!player.autoPlay) break;
      const animalKey = selectLeastAvailableAnimal(room);
      if (!animalKey) {
        endRound(room, 'สัตว์ในกองกลางหมดแล้ว');
        break;
      }
      takeToken(room, player.id, animalKey, true);
      continue;
    }
  }
}

function afterRoomChange(room) {
  resolveAutoActions(room);
  emitRoom(room);
  scheduleRoomTimer(room);
}

function roomOf(socketId) {
  const code = socketToRoom.get(socketId);
  return code ? rooms.get(code) : null;
}

function emitError(socket, message) {
  socket.emit('toast', { type: 'error', message });
}

function clampTurnSeconds(value) {
  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric)) return DEFAULT_TURN_SECONDS;
  return Math.max(MIN_TURN_SECONDS, Math.min(MAX_TURN_SECONDS, numeric));
}

function reorderHand(room, socketId, cardIds) {
  const player = room.players.find((p) => p.id === socketId);
  if (!player) throw new Error('ไม่พบผู้เล่น');
  if (!Array.isArray(cardIds) || cardIds.length !== player.hand.length) throw new Error('ลำดับการ์ดไม่ถูกต้อง');
  const current = new Map(player.hand.map((card) => [card.id, card]));
  const uniqueIds = new Set(cardIds);
  if (uniqueIds.size !== player.hand.length) throw new Error('ลำดับการ์ดซ้ำหรือขาดหาย');
  for (const id of cardIds) {
    if (!current.has(id)) throw new Error('พบการ์ดที่ไม่ได้อยู่ในมือ');
  }
  player.hand = cardIds.map((id) => current.get(id));
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ name }) => {
    leaveCurrentRoom(socket.id);
    const room = createRoom(socket.id, name);
    socket.join(room.code);
    afterRoomChange(room);
  });

  socket.on('joinRoom', ({ roomCode, name }) => {
    const result = joinRoom(socket.id, roomCode, name);
    if (result.error) {
      emitError(socket, result.error);
      return;
    }
    socket.join(result.room.code);
    afterRoomChange(result.room);
  });

  socket.on('setTurnLimit', ({ seconds }) => {
    const room = roomOf(socket.id);
    if (!room) return emitError(socket, 'ยังไม่ได้อยู่ในห้อง');
    if (room.hostId !== socket.id) return emitError(socket, 'เฉพาะ host เท่านั้นที่ตั้งเวลาได้');
    if (room.phase !== 'lobby') return emitError(socket, 'ตั้งเวลาได้ก่อนเริ่มเกมเท่านั้น');
    room.turnLimitSeconds = clampTurnSeconds(seconds);
    pushTextLog(room, `ตั้งเวลาต่อรอบเป็น ${room.turnLimitSeconds} วินาที`);
    afterRoomChange(room);
  });

  socket.on('setAutoPlay', ({ enabled }) => {
    const room = roomOf(socket.id);
    if (!room) return emitError(socket, 'ยังไม่ได้อยู่ในห้อง');
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return emitError(socket, 'ไม่พบผู้เล่น');
    player.autoPlay = Boolean(enabled);
    player.autoPlayTemporary = false;
    pushTextLog(room, `${player.name} ${player.autoPlay ? 'เปิด' : 'ปิด'} Auto Play`);
    afterRoomChange(room);
  });

  socket.on('reorderHand', ({ cardIds }) => {
    const room = roomOf(socket.id);
    if (!room) return emitError(socket, 'ยังไม่ได้อยู่ในห้อง');
    try {
      reorderHand(room, socket.id, cardIds);
      // Hand order is a personal preference. Save it for Auto Play, but do not
      // broadcast a room refresh to other players.
      socket.emit('state', roomPublicState(room, socket.id));
    } catch (error) {
      emitError(socket, error.message);
      socket.emit('state', roomPublicState(room, socket.id));
    }
  });

  socket.on('startGame', () => {
    const room = roomOf(socket.id);
    if (!room) return emitError(socket, 'ยังไม่ได้อยู่ในห้อง');
    if (room.hostId !== socket.id) return emitError(socket, 'เฉพาะ host เท่านั้นที่เริ่มเกมได้');
    try {
      startRound(room);
      afterRoomChange(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('nextRound', () => {
    const room = roomOf(socket.id);
    if (!room) return emitError(socket, 'ยังไม่ได้อยู่ในห้อง');
    if (room.hostId !== socket.id) return emitError(socket, 'เฉพาะ host เท่านั้นที่เริ่มรอบใหม่ได้');
    if (room.phase !== 'round_end') return emitError(socket, 'ต้องจบรอบก่อน');
    try {
      startRound(room);
      afterRoomChange(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('resetGame', () => {
    const room = roomOf(socket.id);
    if (!room) return emitError(socket, 'ยังไม่ได้อยู่ในห้อง');
    if (room.hostId !== socket.id) return emitError(socket, 'เฉพาะ host เท่านั้นที่รีเซ็ตเกมได้');
    resetRoom(room);
    afterRoomChange(room);
  });

  socket.on('playCard', ({ cardId }) => {
    const room = roomOf(socket.id);
    if (!room) return emitError(socket, 'ยังไม่ได้อยู่ในห้อง');
    try {
      playCard(room, socket.id, cardId);
      afterRoomChange(room);
    } catch (error) {
      emitError(socket, error.message);
      emitRoom(room);
    }
  });

  socket.on('takeToken', ({ animalKey }) => {
    const room = roomOf(socket.id);
    if (!room) return emitError(socket, 'ยังไม่ได้อยู่ในห้อง');
    try {
      takeToken(room, socket.id, animalKey);
      afterRoomChange(room);
    } catch (error) {
      emitError(socket, error.message);
      emitRoom(room);
    }
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom(socket.id);
  });
});

function getLanAddresses() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) results.push(net.address);
    }
  }
  return results;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Botswana Online Game running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  for (const ip of getLanAddresses()) console.log(`LAN: http://${ip}:${PORT}`);
});
