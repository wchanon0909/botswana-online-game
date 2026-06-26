const express = require('express');
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
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
  { key: 'hippo', name: 'Hippo', thai: 'ฮิปโป', emoji: '🦛', accent: '#b8a1ff' }
];

const rooms = new Map();
const socketToRoom = new Map();

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

function makeDeck() {
  const deck = [];
  for (const animal of ANIMALS) {
    for (let value = 0; value <= 5; value += 1) {
      deck.push({ id: `${animal.key}-${value}`, animal: animal.key, value });
    }
  }
  return shuffle(deck);
}

function emptyTokenSet() {
  return Object.fromEntries(ANIMALS.map((a) => [a.key, 0]));
}

function initialBoard() {
  return Object.fromEntries(ANIMALS.map((a) => [a.key, []]));
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
    tokens: player.tokens
  };
}

function roomPublicState(room, socketId) {
  const me = room.players.find((p) => p.id === socketId);
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
    lastAction: room.lastAction,
    log: room.log.slice(-8),
    animals: ANIMALS,
    board: room.board,
    availableTokens: room.availableTokens,
    tokensPerAnimal: room.tokensPerAnimal,
    players: room.players.map(compactPlayer),
    myId: socketId,
    myHand: me ? me.hand : [],
    mySeat: me ? me.seat : null,
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

function pushLog(room, message) {
  const stamp = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  room.log.push(`${stamp} · ${message}`);
  room.lastAction = message;
  if (room.log.length > 40) room.log.shift();
}

function createRoom(hostId, hostName) {
  const code = uniqueCode();
  const room = {
    code,
    hostId,
    phase: 'lobby',
    roundNo: 0,
    maxPlayers: 6,
    startedAt: null,
    turnStartedAt: null,
    turnLimitSeconds: 30,
    currentPlayerId: null,
    currentPlayerIndex: 0,
    pendingTakePlayerId: null,
    lastAction: 'ห้องพร้อมแล้ว ชวนเพื่อนเข้า LAN ได้เลย',
    log: [],
    board: initialBoard(),
    availableTokens: Object.fromEntries(ANIMALS.map((a) => [a.key, 0])),
    tokensPerAnimal: 0,
    players: []
  };
  const player = makePlayer(hostId, hostName, 1, true);
  room.players.push(player);
  pushLog(room, `${player.name} สร้างห้อง ${code}`);
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
    tokens: emptyTokenSet()
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

function joinRoom(socketId, roomCode, name) {
  const code = String(roomCode || '').toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) return { error: 'ไม่พบห้องนี้ ลองตรวจ room code อีกครั้ง' };
  if (room.phase !== 'lobby') return { error: 'เกมเริ่มแล้ว ห้องนี้ยังไม่เปิดรับผู้เล่นใหม่' };
  if (room.players.length >= room.maxPlayers) return { error: 'ห้องเต็มแล้ว รองรับสูงสุด 6 คน' };

  const oldCode = socketToRoom.get(socketId);
  if (oldCode && oldCode !== code) leaveCurrentRoom(socketId);

  const seat = availableSeats(room)[0];
  const player = makePlayer(socketId, name, seat, false);
  room.players.push(player);
  socketToRoom.set(socketId, code);
  pushLog(room, `${player.name} เข้าห้อง`);
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
    pushLog(room, `${player.name} ออกจากห้อง`);
  }

  if (room.phase === 'lobby') {
    room.players = room.players.filter((p) => p.id !== socketId);
    if (room.hostId === socketId && room.players.length > 0) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
      pushLog(room, `${room.players[0].name} เป็น host คนใหม่`);
    }
  }

  socketToRoom.delete(socketId);
  if (room.players.length === 0 || room.players.every((p) => !p.connected)) {
    rooms.delete(code);
  } else {
    emitRoom(room);
  }
}

function startRound(room) {
  const playerCount = room.players.length;
  if (playerCount < 2) throw new Error('ต้องมีอย่างน้อย 2 คนถึงเริ่มเกมได้');
  if (playerCount > room.maxPlayers) throw new Error('ห้องนี้รองรับสูงสุด 6 คน');

  room.phase = 'playing';
  room.roundNo += 1;
  room.board = initialBoard();
  room.pendingTakePlayerId = null;
  room.tokensPerAnimal = playerCount <= 5 ? 5 : 6;
  room.availableTokens = Object.fromEntries(ANIMALS.map((a) => [a.key, room.tokensPerAnimal]));

  const deck = makeDeck();
  const handSize = Math.floor(deck.length / playerCount);
  const shuffledPlayers = room.players.sort((a, b) => a.seat - b.seat);
  for (const player of shuffledPlayers) {
    player.hand = [];
    player.tokens = emptyTokenSet();
    player.roundScore = 0;
  }
  for (let i = 0; i < handSize * playerCount; i += 1) {
    shuffledPlayers[i % playerCount].hand.push(deck[i]);
  }
  for (const player of shuffledPlayers) {
    player.hand.sort((a, b) => (a.animal.localeCompare(b.animal) || a.value - b.value));
  }

  if (room.roundNo === 1) {
    room.currentPlayerIndex = 0;
  } else {
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % playerCount;
  }
  room.currentPlayerId = shuffledPlayers[room.currentPlayerIndex].id;
  room.startedAt = Date.now();
  room.turnStartedAt = Date.now();
  const extraNote = playerCount === 6 ? ' โหมด 6 คนใช้ house-rule: เพิ่มสัตว์เป็นชนิดละ 6 ตัว' : '';
  pushLog(room, `เริ่มรอบ ${room.roundNo} แจกการ์ดคนละ ${handSize} ใบ.${extraNote}`);
}

function playCard(room, socketId, cardId) {
  if (room.phase !== 'playing') throw new Error('ตอนนี้ยังวางการ์ดไม่ได้');
  if (room.currentPlayerId !== socketId) throw new Error('ยังไม่ใช่ตาของคุณ');
  const player = room.players.find((p) => p.id === socketId);
  if (!player) throw new Error('ไม่พบผู้เล่น');
  const index = player.hand.findIndex((c) => c.id === cardId);
  if (index < 0) throw new Error('ไม่มีการ์ดใบนี้ในมือ');
  const [card] = player.hand.splice(index, 1);
  room.board[card.animal].push(card);
  room.pendingTakePlayerId = socketId;
  room.phase = 'take';
  room.turnStartedAt = Date.now();
  const animalName = ANIMALS.find((a) => a.key === card.animal)?.thai || card.animal;
  pushLog(room, `${player.name} วางการ์ด ${animalName} ค่า ${card.value}`);

  if (totalAvailableTokens(room) <= 0) {
    endRound(room, 'สัตว์ในกองกลางหมดแล้ว');
  }
}

function takeToken(room, socketId, animalKey) {
  if (room.phase !== 'take') throw new Error('ตอนนี้ยังหยิบสัตว์ไม่ได้');
  if (room.pendingTakePlayerId !== socketId) throw new Error('ผู้เล่นที่วางการ์ดต้องเป็นคนหยิบสัตว์');
  if (!ANIMALS.some((a) => a.key === animalKey)) throw new Error('ชนิดสัตว์ไม่ถูกต้อง');
  if ((room.availableTokens[animalKey] || 0) <= 0) throw new Error('สัตว์ชนิดนี้หมดแล้ว');

  const player = room.players.find((p) => p.id === socketId);
  if (!player) throw new Error('ไม่พบผู้เล่น');
  player.tokens[animalKey] += 1;
  room.availableTokens[animalKey] -= 1;
  const animalName = ANIMALS.find((a) => a.key === animalKey)?.thai || animalKey;
  pushLog(room, `${player.name} หยิบ ${animalName}`);

  const roundEndAnimal = ANIMALS.find((a) => room.board[a.key].length >= 6);
  if (roundEndAnimal) {
    endRound(room, `${roundEndAnimal.thai} ถูกวางครบ 6 ใบ`);
    return;
  }
  if (totalAvailableTokens(room) <= 0) {
    endRound(room, 'สัตว์ในกองกลางหมดแล้ว');
    return;
  }
  if (room.players.every((p) => p.hand.length === 0)) {
    endRound(room, 'การ์ดทุกคนหมดมือ');
    return;
  }

  room.phase = 'playing';
  room.pendingTakePlayerId = null;
  moveToNextPlayer(room);
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
  for (const animal of ANIMALS) {
    const pile = room.board[animal.key];
    values[animal.key] = pile.length ? pile[pile.length - 1].value : 0;
  }
  return values;
}

function endRound(room, reason) {
  const values = scoreValues(room);
  for (const player of room.players) {
    let score = 0;
    for (const animal of ANIMALS) score += (player.tokens[animal.key] || 0) * values[animal.key];
    player.roundScore = score;
    player.totalScore += score;
  }
  room.phase = 'round_end';
  room.pendingTakePlayerId = null;
  room.currentPlayerId = null;
  room.turnStartedAt = null;
  pushLog(room, `จบรอบ ${room.roundNo}: ${reason}`);
}

function resetRoom(room) {
  room.phase = 'lobby';
  room.roundNo = 0;
  room.currentPlayerId = null;
  room.turnStartedAt = null;
  room.currentPlayerIndex = 0;
  room.pendingTakePlayerId = null;
  room.board = initialBoard();
  room.availableTokens = Object.fromEntries(ANIMALS.map((a) => [a.key, 0]));
  room.tokensPerAnimal = 0;
  for (const player of room.players) {
    player.totalScore = 0;
    player.roundScore = 0;
    player.hand = [];
    player.tokens = emptyTokenSet();
  }
  pushLog(room, 'รีเซ็ตเกม กลับสู่ lobby');
}

function roomOf(socketId) {
  const code = socketToRoom.get(socketId);
  return code ? rooms.get(code) : null;
}

function emitError(socket, message) {
  socket.emit('toast', { type: 'error', message });
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ name }) => {
    leaveCurrentRoom(socket.id);
    const room = createRoom(socket.id, name);
    socket.join(room.code);
    emitRoom(room);
  });

  socket.on('joinRoom', ({ roomCode, name }) => {
    const result = joinRoom(socket.id, roomCode, name);
    if (result.error) {
      emitError(socket, result.error);
      return;
    }
    socket.join(result.room.code);
    emitRoom(result.room);
  });

  socket.on('startGame', () => {
    const room = roomOf(socket.id);
    if (!room) return emitError(socket, 'ยังไม่ได้อยู่ในห้อง');
    if (room.hostId !== socket.id) return emitError(socket, 'เฉพาะ host เท่านั้นที่เริ่มเกมได้');
    try {
      startRound(room);
      emitRoom(room);
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
      emitRoom(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('resetGame', () => {
    const room = roomOf(socket.id);
    if (!room) return emitError(socket, 'ยังไม่ได้อยู่ในห้อง');
    if (room.hostId !== socket.id) return emitError(socket, 'เฉพาะ host เท่านั้นที่รีเซ็ตเกมได้');
    resetRoom(room);
    emitRoom(room);
  });

  socket.on('playCard', ({ cardId }) => {
    const room = roomOf(socket.id);
    if (!room) return emitError(socket, 'ยังไม่ได้อยู่ในห้อง');
    try {
      playCard(room, socket.id, cardId);
      emitRoom(room);
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
      emitRoom(room);
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
