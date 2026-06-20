// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static(__dirname + '/public'));

let activeRooms = {};

// Fungsi membuat formasi bola biliar (X, Z) di meja biliar
function createInitialBalls() {
    let balls = [{ id: 0, color: '#ffffff', x: 0, z: 1.5, type: 'cue', active: true }]; // Bola Putih
    
    // Posisi awal tumpukan bola target (segitiga/rack)
    const startX = 0, startZ = -1.5, spacing = 0.16;
    let ballId = 1;
    const colors = [
        '#f1c40f', '#3498db', '#e74c3c', '#9b59b6', '#e67e22', '#2ecc71', '#78281f', // 1-7 Solid
        '#000000', // 8 Ball (Hitam)
        '#f1c40f', '#3498db', '#e74c3c', '#9b59b6', '#e67e22', '#2ecc71', '#78281f'  // 9-15 Stripes (diwakili warna sama untuk simplifikasi visual)
    ];

    // Mengatur posisi segitiga 5 baris
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col <= row; col++) {
            let xOffset = (col - row / 2) * spacing;
            let zOffset = -row * (spacing * 0.86);
            
            // Penentuan warna khusus bola hitam di tengah
            let color = colors[ballId - 1];
            if (row === 2 && col === 1) color = '#000000'; // Bola 8 di tengah

            balls.push({
                id: ballId,
                color: color,
                type: ballId === 8 ? 'black' : (ballId < 8 ? 'solid' : 'striped'),
                x: startX + xOffset,
                z: startZ + zOffset,
                active: true
            });
            ballId++;
        }
    }
    return balls;
}

io.on('connection', (socket) => {
    console.log('Pemain terhubung:', socket.id);

    socket.on('startMatchmaking', () => {
        let roomId = null;

        // Cari ruang yang butuh 1 pemain lagi (Maksimal 2 orang)
        for (let id in activeRooms) {
            if (activeRooms[id].players.length === 1) {
                roomId = id;
                break;
            }
        }

        if (!roomId) {
            roomId = 'pool_' + Math.random().toString(36).substr(2, 9);
            activeRooms[roomId] = {
                players: [],
                balls: createInitialBalls(),
                currentTurn: null,
                state: 'waiting'
            };
        }

        let room = activeRooms[roomId];
        let role = room.players.length === 0 ? 'Player 1' : 'Player 2';
        room.players.push({ id: socket.id, role: role });
        socket.join(roomId);

        socket.emit('matchFound', { roomId, role });

        if (room.players.length === 2) {
            room.state = 'playing';
            room.currentTurn = room.players[0].id; // Player 1 jalan duluan
            io.to(roomId).emit('initGame', {
                balls: room.balls,
                turn: room.currentTurn,
                player1: room.players[0].id,
                player2: room.players[1].id
            });
        }
    });

    // Sinkronisasi saat bola putih dipukul
    socket.on('shootBall', ({ roomId, force, angle }) => {
        let room = activeRooms[roomId];
        if (!room || room.currentTurn !== socket.id) return;

        // Kirim perintah ke semua client di room tersebut untuk mensimulasikan tembakan secara lokal
        io.to(roomId).emit('ballShotSynced', { force, angle });
    });

    // Sinkronisasi keadaan akhir bola setelah semua bola berhenti bergerak
    socket.on('syncBallPositions', ({ roomId, updatedBalls, pocketedBallId }) => {
        let room = activeRooms[roomId];
        if (!room) return;

        room.balls = updatedBalls;

        // Logika pergantian giliran sederhana
        let nextTurnPlayer = room.players.find(p => p.id !== room.currentTurn).id;
        room.currentTurn = nextTurnPlayer;

        io.to(roomId).emit('updateGameState', {
            balls: room.balls,
            turn: room.currentTurn
        });
    });

    socket.on('disconnect', () => {
        console.log('Pemain terputus:', socket.id);
        // Pembersihan room jika pemain keluar
    });
});

http.listen(3000, () => {
    console.log('Server Billiard 8-Ball berjalan pada port 3000');
});