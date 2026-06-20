// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});

app.use(express.static(__dirname + '/public'));

let rooms = {}; // Menyimpan data ruangan game

io.on('connection', (socket) => {
    console.log('User terhubung:', socket.id);

    // Event saat pemain memilih mode di menu awal (2 Player atau 4 Player)
    socket.on('joinGame', ({ mode, username }) => {
        let roomId = findOrCreateRoom(mode);
        socket.join(roomId);

        let room = rooms[roomId];
        let playerColor = assignColor(room, mode);

        let player = {
            id: socket.id,
            username: username || "Pemain " + (room.players.length + 1),
            color: playerColor,
            tokens: [0, 0, 0, 0] // Posisi awal 4 bidak (0 = di markas)
        };

        room.players.push(player);
        socket.emit('initPlayer', { color: playerColor, roomId: roomId });

        // Mulai game jika kuota pemain terpenuhi sesuai mode yang dipilih
        let targetPlayers = (mode === '2player') ? 2 : 4;
        if (room.players.length === targetPlayers) {
            room.status = 'playing';
            room.currentTurn = room.players[0].color;
            io.to(roomId).emit('startGame', { players: room.players, turn: room.currentTurn });
        } else {
            io.to(roomId).emit('waitingPlayers', { current: room.players.length, target: targetPlayers });
        }
    });

    // Sinkronisasi Lempar Dadu
    socket.on('rollDice', ({ roomId }) => {
        let room = rooms[roomId];
        if (!room || room.currentTurnPlayer().id !== socket.id) return;

        let diceValue = Math.floor(Math.random() * 6) + 1;
        io.to(roomId).emit('diceRolled', { value: diceValue, turn: room.currentTurn });
    });

    // Sinkronisasi Gerakan Bidak
    socket.on('moveToken', ({ roomId, tokenIndex, steps }) => {
        let room = rooms[roomId];
        if (!room || room.currentTurnPlayer().id !== socket.id) return;

        let player = room.players.find(p => p.id === socket.id);
        
        // Logika jalur Ludo: Batas maksimum langkah (misal 57 untuk sampai ke segitiga kemenangan)
        if (player.tokens[tokenIndex] + steps <= 57) {
            player.tokens[tokenIndex] += steps;
            
            // Cek jika pemain menang (semua 4 bidak mencapai posisi 57)
            let isWin = player.tokens.every(pos => pos === 57);
            if (isWin) {
                io.to(roomId).emit('gameOver', { winner: player.color, username: player.username });
                room.status = 'finished';
                return;
            }
        }

        io.to(roomId).emit('tokenMoved', { players: room.players });

        // Ganti giliran ke pemain berikutnya jika status masih bermain
        if (room.status === 'playing') {
            room.nextTurn();
            io.to(roomId).emit('changeTurn', { turn: room.currentTurn });
        }
    });

    socket.on('disconnect', () => {
        console.log('User terputus:', socket.id);
        // Menghapus player dari room jika mereka terputus saat menunggu
        for (let id in rooms) {
            let room = rooms[id];
            let index = room.players.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                room.players.splice(index, 1);
                if (room.status === 'waiting') {
                    let targetPlayers = (room.mode === '2player') ? 2 : 4;
                    io.to(id).emit('waitingPlayers', { current: room.players.length, target: targetPlayers });
                }
                if (room.players.length === 0) {
                    delete rooms[id];
                }
                break;
            }
        }
    });
});

// Helper Functions
function findOrCreateRoom(mode) {
    for (let id in rooms) {
        let max = (mode === '2player') ? 2 : 4;
        if (rooms[id].mode === mode && rooms[id].players.length < max && rooms[id].status === 'waiting') {
            return id;
        }
    }
    let newId = 'room_' + Math.random().toString(36).substr(2, 9);
    rooms[newId] = {
        mode: mode,
        status: 'waiting',
        players: [],
        currentTurn: null,
        nextTurn: function() {
            let idx = this.players.findIndex(p => p.color === this.currentTurn);
            idx = (idx + 1) % this.players.length;
            this.currentTurn = this.players[idx].color;
        },
        currentTurnPlayer: function() {
            return this.players.find(p => p.color === this.currentTurn);
        }
    };
    return newId;
}

function assignColor(room, mode) {
    if (mode === '2player') {
        // Untuk 2 Player, kita pakai Merah (P1) dan Kuning (P2) agar berseberangan secara diagonal/simetris
        const colors2P = ['red', 'yellow'];
        let usedColors = room.players.map(p => p.color);
        return colors2P.find(c => !usedColors.includes(c));
    } else {
        // Untuk 4 Player, urutannya Merah, Biru, Yellow, Hijau
        const colors4P = ['red', 'blue', 'yellow', 'green'];
        let usedColors = room.players.map(p => p.color);
        return colors4P.find(c => !usedColors.includes(c));
    }
}

http.listen(3000, () => {
    console.log('Server Ludo beroperasi di port 3000');
});