// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static(__dirname + '/public'));

let activeRooms = {};

// Struktur data awal Papan Congklak (16 Elemen Array)
// Index 0-6: Lubang Kecil P1 | Index 7: Lubang Induk/Besar P1
// Index 8-14: Lubang Kecil P2 | Index 15: Lubang Induk/Besar P2
function createInitialBoard() {
    let board = new Array(16).fill(4); // Standar awal: 4 biji per lubang kecil
    board[7] = 0;  // Induk P1 awal kosong
    board[15] = 0; // Induk P2 awal kosong
    return board;
}

io.on('connection', (socket) => {
    console.log('Pemain terkoneksi ke Dakron:', socket.id);

    socket.on('joinDakron', ({ username }) => {
        let roomId = null;
        for (let id in activeRooms) {
            if (activeRooms[id].players.length === 1) {
                roomId = id;
                break;
            }
        }

        if (!roomId) {
            roomId = 'dakron_' + Math.random().toString(36).substr(2, 9);
            activeRooms[roomId] = {
                players: [],
                board: createInitialBoard(),
                currentTurn: null,
                status: 'waiting'
            };
        }

        let room = activeRooms[roomId];
        let role = room.players.length === 0 ? 'P1' : 'P2';
        
        room.players.push({ id: socket.id, name: username || `Player ${role}`, role: role });
        socket.join(roomId);

        socket.emit('initRole', { role, roomId });

        if (room.players.length === 2) {
            room.status = 'playing';
            room.currentTurn = 'P1'; // P1 jalan duluan
            io.to(roomId).emit('startGame', {
                board: room.board,
                currentTurn: room.currentTurn,
                players: room.players
            });
        }
    });

    // Jalur Algoritma Utama Pembagian Biji Dakron (Sowing Algorithm)
    socket.on('moveClick', ({ roomId, holeIndex }) => {
        let room = activeRooms[roomId];
        if (!room || room.status !== 'playing') return;

        let player = room.players.find(p => p.id === socket.id);
        if (!player || player.role !== room.currentTurn) return; // Validasi giliran

        // Validasi kepemilikan lubang
        if (player.role === 'P1' && (holeIndex < 0 || holeIndex > 6)) return;
        if (player.role === 'P2' && (holeIndex < 8 || holeIndex > 14)) return;

        let seeds = room.board[holeIndex];
        if (seeds === 0) return; // Lubang kosong tidak bisa diambil

        room.board[holeIndex] = 0; // Ambil semua biji dari lubang terpilih
        let currentIndex = holeIndex;

        // Distribusi memutar searah jarum jam
        while (seeds > 0) {
            currentIndex = (currentIndex + 1) % 16;

            // Aturan Lewati Lubang Besar Lawan
            if (player.role === 'P1' && currentIndex === 15) continue;
            if (player.role === 'P2' && currentIndex === 7) continue;

            room.board[currentIndex]++;
            seeds--;
        }

        // --- CEK KONDISI BIJI TERAKHIR JATUH ---
        let nextTurn = room.currentTurn;
        
        // Kasus 1: Jatuh di Lubang Induk Sendiri -> Bonus jalan lagi
        if ((player.role === 'P1' && currentIndex === 7) || (player.role === 'P2' && currentIndex === 15)) {
            nextTurn = player.role; // Tetap giliran dia
        } 
        // Kasus 2: Jatuh di lubang kecil yang sudah ada isinya -> lanjut putaran (opsional, tapi untuk versi kilat/sempurna: berhenti dan ganti giliran jika jatuh di lubang kosong)
        else if (room.board[currentIndex] === 1) { 
            // Jatuh di lubang kosong sisi sendiri -> Logika Tembak (Capture)
            let isSisiP1 = (currentIndex >= 0 && currentIndex <= 6);
            let isSisiP2 = (currentIndex >= 8 && currentIndex <= 14);

            if ((player.role === 'P1' && isSisiP1) || (player.role === 'P2' && isSisiP2)) {
                let seberangIndex = 14 - currentIndex;
                let bijiTembakan = room.board[seberangIndex];
                
                if (bijiTembakan > 0) {
                    let indukIdx = player.role === 'P1' ? 7 : 15;
                    room.board[indukIdx] += bijiTembakan + 1; // Ambil biji lawan + 1 biji kita
                    room.board[currentIndex] = 0;
                    room.board[seberangIndex] = 0;
                }
            }
            nextTurn = player.role === 'P1' ? 'P2' : 'P1'; // Ganti giliran
        } else {
            // Jatuh di lubang kecil berizin (tidak kosong) -> ganti giliran di versi standar modern
            nextTurn = player.role === 'P1' ? 'P2' : 'P1';
        }

        // Cek Game Over (Jika salah satu sisi lubang kecil habis total)
        if (checkGameOver(room.board)) {
            room.status = 'finished';
            // Bersihkan sisa biji ke masing-masing induk
            for(let i=0; i<=6; i++) { room.board[7] += room.board[i]; room.board[i] = 0; }
            for(let i=8; i<=14; i++) { room.board[15] += room.board[i]; room.board[i] = 0; }
            
            let winner = room.board[7] > room.board[15] ? 'P1' : (room.board[15] > room.board[7] ? 'P2' : 'Seri');
            io.to(roomId).emit('gameOverDakron', { board: room.board, winner });
        } else {
            room.currentTurn = nextTurn;
            io.to(roomId).emit('updateBoard', { board: room.board, currentTurn: room.currentTurn });
        }
    });

    function checkGameOver(board) {
        let side1Empty = board.slice(0, 7).every(val => val === 0);
        let side2Empty = board.slice(8, 15).every(val => val === 0);
        return side1Empty || side2Empty;
    }

    socket.on('disconnect', () => {
        console.log('Pemain keluar:', socket.id);
    });
});

http.listen(3000, () => {
    console.log('Server Game Dakron 3D aktif pada port 3000');
});