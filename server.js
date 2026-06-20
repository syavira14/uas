// ============================================================
//  UNIFIED GAME SERVER - UAS Game Portal
// ============================================================
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: '*' } });
const path = require('path');

// Serve static files untuk setiap game
app.use('/', express.static(path.join(__dirname, 'public')));
app.use('/Ludo/public', express.static(path.join(__dirname, 'Ludo/public')));
app.use('/kuis/public', express.static(path.join(__dirname, 'kuis/public')));
app.use('/congklak/public', express.static(path.join(__dirname, 'congklak/public')));
app.use('/ballpool/public', express.static(path.join(__dirname, 'ballpool/public')));

// Redirect agar /Ludo, /kuis, dll langsung ke index.html game-nya
app.get('/Ludo', (req, res) => res.redirect('/Ludo/public/index.html'));
app.get('/kuis', (req, res) => res.redirect('/kuis/public/index.html'));
app.get('/congklak', (req, res) => res.redirect('/congklak/public/index.html'));
app.get('/ballpool', (req, res) => res.redirect('/ballpool/public/index.html'));

// ============================================================
// LUDO GAME STATE
// ============================================================
let ludoRooms = {};

// Board path: 52 squares (0-51), each player starts at different offset
// Red starts at 0, Blue at 13, Yellow at 26, Green at 39
// Home column: Red 52-57, Blue 58-63, Yellow 64-69, Green 70-75
// Safe squares (star): global positions 8, 13, 21, 26, 34, 39, 47, 0
// Starting squares (colored): Red=0, Blue=13, Yellow=26, Green=39
const LUDO_START = { red: 0, blue: 13, yellow: 26, green: 39 };
const LUDO_HOME_ENTRY = { red: 51, blue: 12, yellow: 25, green: 38 };
const LUDO_HOME_COL_START = { red: 52, blue: 58, yellow: 64, green: 70 };
const LUDO_SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Arrow teleports: { from: to } (tail -> head, grants extra turn)
const LUDO_ARROWS = {
    // Indian Ludo style arrows - 3 per zone
    2: 15, 10: 23, 24: 36, 15: 28, 37: 49, 49: 4
};

function makeLudoTokens() {
    return [
        { id: 0, pos: -1, finished: false }, // pos -1 = in base
        { id: 1, pos: -1, finished: false },
        { id: 2, pos: -1, finished: false },
        { id: 3, pos: -1, finished: false },
    ];
}

function createLudoRoom(mode, numPlayers) {
    const colors = numPlayers === 2 ? ['red','blue'] : ['red','blue','yellow','green'];
    const players = [];
    for (let i = 0; i < numPlayers; i++) {
        players.push({ colorIdx: i, color: colors[i], tokens: makeLudoTokens(), username: '', id: null, isBot: false, finished: false });
    }
    return {
        mode, numPlayers, status: 'waiting',
        players, currentTurn: 0,
        consecutiveSixes: 0,
        diceVal: null,
        botThinkTimer: null,
    };
}

function ludoAbsPos(color, localPos) {
    // localPos: 0-51 on outer track, 52-57 in home col
    if (localPos < 0) return -1;
    if (localPos >= 52) return LUDO_HOME_COL_START[color] + (localPos - 52);
    const start = LUDO_START[color];
    return (start + localPos) % 52;
}

function ludoCanMove(room, playerIdx, tokenIdx, dice) {
    const p = room.players[playerIdx];
    const tok = p.tokens[tokenIdx];
    if (tok.finished) return false;
    if (tok.pos === -1) return dice === 6; // need 6 to exit base
    const newLocal = tok.pos + dice;
    if (newLocal > 57) return false; // overshoot home col
    return true;
}

function ludoDoMove(room, playerIdx, tokenIdx, dice) {
    const p = room.players[playerIdx];
    const tok = p.tokens[tokenIdx];
    let extraTurn = false;

    if (tok.pos === -1 && dice === 6) {
        tok.pos = 0; // enter board
        extraTurn = true;
    } else {
        tok.pos += dice;
        if (tok.pos === 57) {
            tok.finished = true;
            extraTurn = true; // bonus for finishing token
        }
    }

    // Arrow check (only on outer track 0-51)
    if (!tok.finished && tok.pos < 52) {
        const absPos = ludoAbsPos(p.color, tok.pos);
        if (LUDO_ARROWS[absPos] !== undefined) {
            const arrowHead = LUDO_ARROWS[absPos];
            // Convert arrow head back to local for this color
            const start = LUDO_START[p.color];
            tok.pos = ((arrowHead - start) + 52) % 52;
            extraTurn = true;
        }
    }

    // Capture check (only outer track)
    let captured = [];
    if (!tok.finished && tok.pos < 52) {
        const absPos = ludoAbsPos(p.color, tok.pos);
        if (!LUDO_SAFE.has(absPos) && absPos !== LUDO_START[p.color]) {
            for (let oi = 0; oi < room.players.length; oi++) {
                if (oi === playerIdx) continue;
                const opp = room.players[oi];
                for (let ot = 0; ot < opp.tokens.length; ot++) {
                    const otok = opp.tokens[ot];
                    if (otok.pos < 0 || otok.finished || otok.pos >= 52) continue;
                    const oAbs = ludoAbsPos(opp.color, otok.pos);
                    if (oAbs === absPos) {
                        otok.pos = -1; // send back to base
                        captured.push({ player: oi, token: ot });
                        extraTurn = true;
                    }
                }
            }
        }
    }

    return { extraTurn, captured };
}

function ludoCheckWin(room, playerIdx) {
    return room.players[playerIdx].tokens.every(t => t.finished);
}

function ludoNextTurn(room) {
    room.consecutiveSixes = 0;
    room.diceVal = null;
    let next = (room.currentTurn + 1) % room.numPlayers;
    // skip finished players
    let attempts = 0;
    while (room.players[next].finished && attempts < room.numPlayers) {
        next = (next + 1) % room.numPlayers;
        attempts++;
    }
    room.currentTurn = next;
}

function ludoBotMove(roomId) {
    const room = ludoRooms[roomId];
    if (!room || room.status !== 'playing') return;
    const pIdx = room.currentTurn;
    const p = room.players[pIdx];
    if (!p.isBot) return;

    // Roll dice
    const dice = Math.floor(Math.random() * 6) + 1;
    room.diceVal = dice;

    if (dice === 6) {
        room.consecutiveSixes++;
        if (room.consecutiveSixes >= 3) {
            // 3 consecutive sixes: forfeit turn
            io.to(roomId).emit('ludo_diceRolled', { playerIdx: pIdx, dice, forfeit: true, gameState: room });
            ludoNextTurn(room);
            setTimeout(() => {
                if (room.players[room.currentTurn].isBot) ludoBotMove(roomId);
                else io.to(roomId).emit('ludo_yourTurn', { playerIdx: room.currentTurn, gameState: room });
            }, 1200);
            return;
        }
    } else {
        room.consecutiveSixes = 0;
    }

    // Find moveable tokens
    const moveable = [];
    for (let ti = 0; ti < 4; ti++) {
        if (ludoCanMove(room, pIdx, ti, dice)) moveable.push(ti);
    }

    io.to(roomId).emit('ludo_diceRolled', { playerIdx: pIdx, dice, moveable, gameState: room });

    if (moveable.length === 0) {
        // No valid move: pass turn
        setTimeout(() => {
            ludoNextTurn(room);
            if (room.players[room.currentTurn].isBot) ludoBotMove(roomId);
            else io.to(roomId).emit('ludo_yourTurn', { playerIdx: room.currentTurn, gameState: room });
        }, 1200);
        return;
    }

    // Bot AI: prefer capture > advance furthest > exit base
    let chosen = moveable[0];
    let bestScore = -1;
    for (const ti of moveable) {
        const tok = p.tokens[ti];
        let score = tok.pos; // prefer further token
        if (tok.pos === -1) score = 0; // exit base is ok
        // bonus if can capture
        const testPos = tok.pos === -1 ? 0 : tok.pos + dice;
        if (testPos < 52) {
            const absPos = ludoAbsPos(p.color, testPos);
            for (let oi = 0; oi < room.players.length; oi++) {
                if (oi === pIdx) continue;
                const opp = room.players[oi];
                for (const otok of opp.tokens) {
                    if (otok.pos < 0 || otok.finished || otok.pos >= 52) continue;
                    if (ludoAbsPos(opp.color, otok.pos) === absPos && !LUDO_SAFE.has(absPos)) {
                        score += 100; // capture bonus
                    }
                }
            }
        }
        if (score > bestScore) { bestScore = score; chosen = ti; }
    }

    setTimeout(() => {
        const result = ludoDoMove(room, pIdx, chosen, dice);
        const won = ludoCheckWin(room, pIdx);
        if (won) {
            room.status = 'finished';
            io.to(roomId).emit('ludo_gameOver', { winner: pIdx, winnerName: p.username, gameState: room });
            return;
        }
        io.to(roomId).emit('ludo_tokenMoved', { playerIdx: pIdx, tokenIdx: chosen, result, gameState: room });
        if (result.extraTurn && dice !== 6) {
            setTimeout(() => ludoBotMove(roomId), 1000);
        } else if (dice === 6 && room.consecutiveSixes < 3) {
            setTimeout(() => ludoBotMove(roomId), 1000);
        } else {
            ludoNextTurn(room);
            setTimeout(() => {
                if (room.players[room.currentTurn].isBot) ludoBotMove(roomId);
                else io.to(roomId).emit('ludo_yourTurn', { playerIdx: room.currentTurn, gameState: room });
            }, 800);
        }
    }, 900);
}

// ============================================================
// CONGKLAK GAME STATE
// ============================================================
let congklakRooms = {};
function initCongklakBoard() { return [7,7,7,7,7,7,7, 0, 7,7,7,7,7,7,7, 0]; }

// ============================================================
// BALLPOOL GAME STATE
// ============================================================
let ballpoolRooms = {};
function initPoolBalls() {
    const balls = [{ id:0, x:0, z:1.2, color:'#f0f0f0', active:true, type:'cue', vx:0, vz:0 }];
    const colors = ['#e74c3c','#f39c12','#8e44ad','#2980b9','#e67e22','#2ecc71','#c0392b',
                    '#000000','#f1c40f','#1abc9c','#d35400','#2471a3','#cb4335','#28b463','#884ea0'];
    const types = ['solid','solid','solid','solid','solid','solid','solid','eight',
                   'striped','striped','striped','striped','striped','striped','striped'];
    let bi = 0;
    const rows = [[0],[1,2],[3,4,5],[6,7,8],[9,10,11,12]];
    let startZ = -0.5;
    rows.forEach((row, ri) => {
        row.forEach((_, ci) => {
            const xOff = (ci - row.length/2 + 0.5) * 0.16;
            balls.push({ id:bi+1, x:xOff, z:startZ - ri*0.14, color:colors[bi], active:true, type:types[bi], vx:0, vz:0 });
            bi++;
        });
    });
    return balls;
}

// ============================================================
// KUIS GAME STATE
// ============================================================
let kuisRooms = {};
const KUIS_WAKTU = 10; // detik per soal

function kirimSoal(roomId) {
    const room = kuisRooms[roomId];
    if (!room) return;
    if (room.soalIdx >= room.soalList.length) {
        // Game over
        clearTimeout(room.timerHandle);
        const hasil = room.players.map(p => ({
            socketId: p.id,
            username: p.username,
            score: room.scores[p.id].score,
            correctCount: room.scores[p.id].correctCount,
        })).sort((a, b) => b.score - a.score);
        io.to(roomId).emit('kuis_gameOver', { hasil });
        delete kuisRooms[roomId];
        return;
    }
    room.timerSisa = KUIS_WAKTU;
    const soal = room.soalList[room.soalIdx];
    io.to(roomId).emit('kuis_newSoal', {
        soalIdx: room.soalIdx,
        total: room.soalList.length,
        soal: { k: soal.k, q: soal.q, a: soal.a },
        waktu: KUIS_WAKTU,
        scores: room.scores,
        players: room.players,
    });

    // Countdown timer server-side
    const countdown = setInterval(() => {
        room.timerSisa--;
        if (room.timerSisa <= 0) {
            clearInterval(countdown);
            revealJawaban(roomId, -1); // waktu habis
        }
    }, 1000);
    room.timerHandle = countdown;
}

function revealJawaban(roomId, lastPilihan) {
    const room = kuisRooms[roomId];
    if (!room) return;
    const soal = room.soalList[room.soalIdx];
    const answers = room.answers[room.soalIdx] || {};
    io.to(roomId).emit('kuis_reveal', {
        soalIdx: room.soalIdx,
        correct: soal.j,
        answers,          // { socketId: pilihanIdx }
        scores: room.scores,
    });
    room.soalIdx++;
    setTimeout(() => kirimSoal(roomId), 2000);
}


io.on('connection', (socket) => {
    console.log('[Connected]', socket.id);

    // =========================================================
    // --- LUDO ---
    // =========================================================
    socket.on('ludo_join', ({ mode, username }) => {
        // mode: 'bot' | '2player' | '4player'
        const numPlayers = mode === '4player' ? 4 : 2;

        if (mode === 'bot') {
            // Solo vs bot: private room, instant start
            const roomId = 'ludo_bot_' + socket.id;
            const room = createLudoRoom('bot', 2);
            room.players[0].username = username || 'Pemain';
            room.players[0].id = socket.id;
            room.players[1].username = 'Bot';
            room.players[1].isBot = true;
            room.players[1].id = 'bot';
            room.status = 'playing';
            ludoRooms[roomId] = room;
            socket.join(roomId);
            socket.data.ludoRoom = roomId;
            socket.emit('ludo_start', { roomId, playerIdx: 0, gameState: room });
            // If bot goes first (randomize later — always player first for now)
            io.to(roomId).emit('ludo_yourTurn', { playerIdx: 0, gameState: room });
            return;
        }

        // Multiplayer: find or create room
        let roomId = null;
        for (let id in ludoRooms) {
            const r = ludoRooms[id];
            if (r.mode === mode && r.status === 'waiting' && r.players.filter(p=>p.id).length < numPlayers) {
                roomId = id; break;
            }
        }
        if (!roomId) {
            roomId = 'ludo_' + Date.now();
            ludoRooms[roomId] = createLudoRoom(mode, numPlayers);
        }
        const room = ludoRooms[roomId];
        const slot = room.players.find(p => !p.id);
        if (!slot) { socket.emit('ludo_error', { msg: 'Room penuh' }); return; }
        slot.username = username || 'Pemain';
        slot.id = socket.id;
        socket.join(roomId);
        socket.data.ludoRoom = roomId;

        const filled = room.players.filter(p => p.id).length;
        io.to(roomId).emit('ludo_waiting', { current: filled, target: numPlayers, players: room.players, roomId });

        if (filled === numPlayers) {
            room.status = 'playing';
            room.players.forEach((p, i) => {
                io.to(p.id).emit('ludo_start', { roomId, playerIdx: i, gameState: room });
            });
            io.to(roomId).emit('ludo_yourTurn', { playerIdx: 0, gameState: room });
        }
    });

    socket.on('ludo_rollDice', ({ roomId }) => {
        const room = ludoRooms[roomId];
        if (!room || room.status !== 'playing') return;
        const pIdx = room.currentTurn;
        const p = room.players[pIdx];
        if (p.id !== socket.id) return; // not your turn

        const dice = Math.floor(Math.random() * 6) + 1;
        room.diceVal = dice;

        if (dice === 6) {
            room.consecutiveSixes++;
            if (room.consecutiveSixes >= 3) {
                io.to(roomId).emit('ludo_diceRolled', { playerIdx: pIdx, dice, forfeit: true, gameState: room });
                ludoNextTurn(room);
                io.to(roomId).emit('ludo_yourTurn', { playerIdx: room.currentTurn, gameState: room });
                return;
            }
        } else {
            room.consecutiveSixes = 0;
        }

        const moveable = [];
        for (let ti = 0; ti < 4; ti++) {
            if (ludoCanMove(room, pIdx, ti, dice)) moveable.push(ti);
        }
        io.to(roomId).emit('ludo_diceRolled', { playerIdx: pIdx, dice, moveable, gameState: room });

        if (moveable.length === 0) {
            ludoNextTurn(room);
            const nextP = room.players[room.currentTurn];
            if (nextP.isBot) {
                setTimeout(() => ludoBotMove(roomId), 800);
            } else {
                io.to(roomId).emit('ludo_yourTurn', { playerIdx: room.currentTurn, gameState: room });
            }
        }
    });

    socket.on('ludo_chat', ({ roomId, msg }) => {
        const room = ludoRooms[roomId];
        if (!room) return;
        const p = room.players.find(pl => pl.id === socket.id);
        if (!p) return;
        io.to(roomId).emit('ludo_chat', { username: p.username, msg: String(msg).substring(0,100), color: p.color });
    });

    socket.on('ludo_moveToken', ({ roomId, tokenIdx }) => {
        const room = ludoRooms[roomId];
        if (!room || room.status !== 'playing') return;
        const pIdx = room.currentTurn;
        const p = room.players[pIdx];
        if (p.id !== socket.id) return;
        if (!ludoCanMove(room, pIdx, tokenIdx, room.diceVal)) return;

        const result = ludoDoMove(room, pIdx, tokenIdx, room.diceVal);
        const won = ludoCheckWin(room, pIdx);
        if (won) {
            room.status = 'finished';
            io.to(roomId).emit('ludo_gameOver', { winner: pIdx, winnerName: p.username, gameState: room });
            return;
        }
        io.to(roomId).emit('ludo_tokenMoved', { playerIdx: pIdx, tokenIdx, result, gameState: room });

        const dice = room.diceVal;
        if (result.extraTurn && dice !== 6) {
            io.to(roomId).emit('ludo_yourTurn', { playerIdx: pIdx, gameState: room });
        } else if (dice === 6 && room.consecutiveSixes < 3) {
            io.to(roomId).emit('ludo_yourTurn', { playerIdx: pIdx, gameState: room });
        } else {
            ludoNextTurn(room);
            const nextP = room.players[room.currentTurn];
            if (nextP.isBot) setTimeout(() => ludoBotMove(roomId), 800);
            else io.to(roomId).emit('ludo_yourTurn', { playerIdx: room.currentTurn, gameState: room });
        }
    });

    // --- CONGKLAK ---
    socket.on('joinDakron', ({ username }) => {
        let roomId = null;
        for (let id in congklakRooms) {
            if (congklakRooms[id].status === 'waiting') { roomId = id; break; }
        }
        if (!roomId) {
            roomId = 'dakron_' + Date.now();
            congklakRooms[roomId] = { status:'waiting', players:[], board: initCongklakBoard(), currentTurn:'P1' };
        }
        const room = congklakRooms[roomId];
        socket.join(roomId);
        const role = room.players.length === 0 ? 'P1' : 'P2';
        room.players.push({ id: socket.id, role, username });
        socket.data.dakronRoom = roomId;
        socket.emit('initRole', { role, roomId });
        if (room.players.length === 2) {
            room.status = 'playing';
            io.to(roomId).emit('startGame', { board: room.board, currentTurn: room.currentTurn });
        }
    });

    socket.on('moveClick', ({ roomId, holeIndex }) => {
        const room = congklakRooms[roomId];
        if (!room || room.status !== 'playing') return;
        const player = room.players.find(p => p.id === socket.id);
        if (!player || player.role !== room.currentTurn) return;
        if (room.board[holeIndex] === 0) return;
        if (player.role === 'P1' && (holeIndex < 0 || holeIndex > 6)) return;
        if (player.role === 'P2' && (holeIndex < 8 || holeIndex > 14)) return;

        let seeds = room.board[holeIndex];
        room.board[holeIndex] = 0;
        let cur = holeIndex;
        let extraTurn = false;

        while (seeds > 0) {
            cur = (cur + 1) % 16;
            if (player.role === 'P1' && cur === 15) cur = 0;
            if (player.role === 'P2' && cur === 7) cur = (cur + 1) % 16;
            if (cur >= 16) cur = 0;
            room.board[cur]++;
            seeds--;
        }

        if ((player.role === 'P1' && cur === 7) || (player.role === 'P2' && cur === 15)) extraTurn = true;

        if (!extraTurn) {
            const isOwn = (player.role === 'P1' && cur >= 0 && cur <= 6) || (player.role === 'P2' && cur >= 8 && cur <= 14);
            if (isOwn && room.board[cur] === 1) {
                const opp = 14 - cur;
                if (room.board[opp] > 0) {
                    const store = player.role === 'P1' ? 7 : 15;
                    room.board[store] += room.board[opp] + 1;
                    room.board[opp] = 0; room.board[cur] = 0;
                }
            }
        }

        const p1Empty = room.board.slice(0,7).every(v => v === 0);
        const p2Empty = room.board.slice(8,15).every(v => v === 0);
        if (p1Empty || p2Empty) {
            for (let i=0;i<7;i++) { room.board[7] += room.board[i]; room.board[i] = 0; }
            for (let i=8;i<15;i++) { room.board[15] += room.board[i]; room.board[i] = 0; }
            const winner = room.board[7] > room.board[15] ? 'P1' : (room.board[15] > room.board[7] ? 'P2' : 'Seri');
            io.to(roomId).emit('gameOverDakron', { board: room.board, winner });
            delete congklakRooms[roomId]; return;
        }

        if (!extraTurn) room.currentTurn = room.currentTurn === 'P1' ? 'P2' : 'P1';
        io.to(roomId).emit('updateBoard', { board: room.board, currentTurn: room.currentTurn });
    });

    // --- BALLPOOL ---
    socket.on('startMatchmaking', () => {
        let roomId = null;
        for (let id in ballpoolRooms) {
            if (ballpoolRooms[id].status === 'waiting') { roomId = id; break; }
        }
        if (!roomId) {
            roomId = 'pool_' + Date.now();
            ballpoolRooms[roomId] = { status:'waiting', players:[], balls: initPoolBalls(), turn: null };
        }
        const room = ballpoolRooms[roomId];
        socket.join(roomId);
        room.players.push(socket.id);
        socket.data.poolRoom = roomId;
        socket.emit('matchFound', { roomId, role: room.players.length === 1 ? 'Player 1' : 'Player 2' });
        if (room.players.length === 2) {
            room.status = 'playing';
            room.turn = room.players[0];
            io.to(roomId).emit('initGame', { balls: room.balls, turn: room.turn, player1: room.players[0], player2: room.players[1] });
        }
    });

    socket.on('shootBall', ({ roomId, force, angle }) => {
        const room = ballpoolRooms[roomId];
        if (!room || room.turn !== socket.id) return;
        io.to(roomId).emit('ballShotSynced', { force, angle });
    });

    socket.on('syncBallPositions', ({ roomId, updatedBalls }) => {
        const room = ballpoolRooms[roomId];
        if (!room) return;
        room.balls = updatedBalls;
        const idx = room.players.indexOf(room.turn);
        room.turn = room.players[(idx + 1) % 2];
        io.to(roomId).emit('updateGameState', { balls: room.balls, turn: room.turn });
    });

    // =========================================================
    // --- KUIS (Quiz) ---
    // =========================================================
    socket.on('kuis_join', ({ username, numPlayers }) => {
        // Matchmaking otomatis: cari room kuis yang masih 'waiting' dgn target pemain sama
        let roomId = null;
        for (let id in kuisRooms) {
            const r = kuisRooms[id];
            if (r.status === 'waiting' && r.numPlayers === numPlayers && r.players.length < numPlayers) {
                roomId = id; break;
            }
        }
        if (!roomId) {
            roomId = 'kuis_' + Date.now();
            kuisRooms[roomId] = {
                status: 'waiting',
                numPlayers,
                players: [],
                soalList: [],
                soalIdx: 0,
                answers: {},      // soalIdx -> { socketId: pilihanIdx }
                scores: {},       // socketId -> { score, correctCount }
                timerHandle: null,
            };
        }
        const room = kuisRooms[roomId];
        if (room.players.length >= room.numPlayers) {
            socket.emit('kuis_error', { msg: 'Room sudah penuh.' });
            return;
        }
        socket.join(roomId);
        room.players.push({ id: socket.id, username: username || 'Pemain' });
        room.scores[socket.id] = { score: 0, correctCount: 0 };
        socket.data.kuisRoom = roomId;

        io.to(roomId).emit('kuis_playerList', {
            roomId,
            players: room.players,
            current: room.players.length,
            target: room.numPlayers,
            hostId: room.players[0].id,
        });

        if (room.players.length === room.numPlayers) {
            // Pilih 15 soal acak — list soal dikirim dari host saat create
            room.status = 'countdown';
            io.to(roomId).emit('kuis_startCountdown');
        }
    });

    socket.on('kuis_setSoal', ({ roomId, soalList }) => {
        const room = kuisRooms[roomId];
        if (!room) return;
        room.soalList = soalList;
    });

    socket.on('kuis_countdownDone', ({ roomId }) => {
        const room = kuisRooms[roomId];
        if (!room || room.status !== 'countdown') return;
        room.status = 'playing';
        room.soalIdx = 0;
        room.answers = {};
        kirimSoal(roomId);
    });

    socket.on('kuis_answer', ({ roomId, soalIdx, pilihanIdx }) => {
        const room = kuisRooms[roomId];
        if (!room || room.status !== 'playing') return;
        if (soalIdx !== room.soalIdx) return;
        if (!room.answers[soalIdx]) room.answers[soalIdx] = {};
        if (room.answers[soalIdx][socket.id] !== undefined) return; // sudah jawab

        room.answers[soalIdx][socket.id] = pilihanIdx;

        const soal = room.soalList[soalIdx];
        const benar = pilihanIdx === soal.j;
        const sisaWaktu = room.timerSisa || 0;
        const poin = benar ? Math.max(100, 100 + sisaWaktu * 10) : 0;
        if (benar) {
            room.scores[socket.id].score       += poin;
            room.scores[socket.id].correctCount += 1;
        }

        // Beritahu semua: siapa sudah jawab (tapi belum reveal jawaban)
        io.to(roomId).emit('kuis_playerAnswered', {
            socketId: socket.id,
            answeredCount: Object.keys(room.answers[soalIdx]).length,
            totalPlayers: room.players.length,
        });

        // Jika semua sudah jawab → reveal
        if (Object.keys(room.answers[soalIdx]).length === room.players.length) {
            clearTimeout(room.timerHandle);
            revealJawaban(roomId, pilihanIdx);
        }
    });

    socket.on('disconnect', () => {
        console.log('[Disconnected]', socket.id);
        // Beritahu room kuis jika ada yang disconnect
        const kuisRoom = socket.data.kuisRoom;
        if (kuisRoom && kuisRooms[kuisRoom]) {
            const room = kuisRooms[kuisRoom];
            room.players = room.players.filter(p => p.id !== socket.id);
            if (room.players.length === 0) {
                clearTimeout(room.timerHandle);
                delete kuisRooms[kuisRoom];
            } else {
                io.to(kuisRoom).emit('kuis_playerLeft', { players: room.players });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🎮 Game Portal berjalan di:`);
    console.log(`   - Lokal      : http://localhost:${PORT}`);
    console.log(`   - VPN/LAN    : http://10.8.0.30:${PORT}  (sesuaikan dgn IP OpenVPN Anda)`);
    console.log(`\n   Pastikan OpenVPN aktif di semua perangkat, lalu pemain lain cek koneksi dgn:`);
    console.log(`   ping 10.8.0.30`);
    console.log(`   Setelah ping berhasil, buka browser ke alamat VPN di atas.\n`);
});