// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static(__dirname + '/public'));

// BANK DATA: 50 Soal Sesuai Permintaan
const questionBank = [
    { q: "Berapakah jumlah provinsi terbaru di Indonesia saat ini?", a: ["34 provinsi", "36 provinsi", "38 provinsi", "40 provinsi"], s: 2 },
    { q: "Apa nama ibu kota Provinsi Nusa Tenggara Timur?", a: ["Mataram", "Kupang", "Denpasar", "Maumere"], s: 1 },
    { q: "Gunung tertinggi di Indonesia adalah?", a: ["Gunung Kerinci", "Gunung Semeru", "Gunung Rinjani", "Puncak Jaya / Cartensz"], s: 3 },
    { q: "Sungai terpanjang di Indonesia di Pulau Kalimantan bernama?", a: ["Sungai Kapuas", "Sungai Mahakam", "Sungai Barito", "Sungai Musi"], s: 0 },
    { q: "Provinsi termuda yang terbentuk pada tahun 2022 adalah?", a: ["Papua Tengah", "Papua Barat Daya", "Papua Pegunungan", "Papua Selatan"], s: 1 },
    { q: "Pulau manakah yang merupakan pulau terluas di Indonesia?", a: ["Sumandat", "Jawa", "Kalimantan", "Papua"], s: 2 },
    { q: "Kapan Indonesia memproklamasikan kemederkaannya?", a: ["17 Agustus 1943", "17 Agustus 1944", "17 Agustus 1945", "18 Agustus 1945"], s: 2 },
    { q: "Siapakah Presiden pertama Republik Indonesia?", a: ["Ir. Soekarno", "Moh. Hatta", "Soeharto", "B.J. Habibie"], s: 0 },
    { q: "Organisasi pergerakan nasional modern pertama di Indonesia adalah?", a: ["Sarekat Islam", "Budi Utomo", "Perhimpunan Indonesia", "Jong Java"], s: 1 },
    { q: "Siapa tokoh yang memimpin pertempuran besar di Surabaya pada 10 November 1945?", a: ["Jenderal Sudirman", "Bung Tomo", "Pangeran Diponegoro", "Cut Nyak Dien"], s: 1 },
    { q: "Di manakah naskah Proklamasi Kemerdekaan dibacakan secara resmi?", a: ["Jalan Pegangsaan Timur No. 56", "Lapangan Ikada", "Gedung Merdeka", "Istana Negara"], s: 0 },
    { q: "Siapa yang menjabat sebagai wakil presiden pertama Indonesia?", a: ["Ir. Soekarno", "Moh. Hatta", "Soeharto", "Megawati"], s: 1 },
    { q: "Berapakah hasil dari 15 dikali 6?", a: ["80", "85", "90", "95"], s: 2 },
    { q: "Berapakah akar kuadrat dari 144?", a: ["10", "11", "12", "13"], s: 2 },
    { q: "Jika x + 8 = 20, maka nilai x adalah...", a: ["10", "12", "15", "18"], s: 1 },
    { q: "Berapakah 25% dari angka 200?", a: ["25", "40", "50", "75"], s: 2 },
    { q: "Segitiga yang memiliki ketiga sisinya sama panjang disebut?", a: ["Segitiga Sama Kaki", "Segitiga Sama Sisi", "Segitiga Siku-siku", "Segitiga Sembarang"], s: 1 },
    { q: "Hasil dari 100 - 37 + 15 adalah...", a: ["68", "72", "78", "82"], s: 2 },
    { q: "Bilangan bulat terdekat dari angka 3,68 adalah?", a: ["3", "3,5", "3,7", "4"], s: 3 },
    { q: "Berapakah hasil dari 120 dibagi 5?", a: ["20", "22", "24", "26"], s: 2 },
    { q: "Sudut yang besarnya tepat 90 derajat disebut sudut?", a: ["Lancip", "Siku-siku", "Tumpul", "Lurus"], s: 1 },
    { q: "Ekstensi berkas yang benar untuk menyimpan kode sumber Java adalah?", a: [".java", ".class", ".txt", ".exe"], s: 0 },
    { q: "Simbol yang digunakan untuk menuliskan komentar satu baris dalam Java?", a: ["#", "//", "", "## ... ##"], s: 1 },
    { q: "Tipe data untuk menyimpan bilangan desimal (berkoma) dalam Java adalah?", a: ["int", "char", "float", "boolean"], s: 2 },
    { q: "Struktur perulangan yang berjalan selama kondisinya benar memakai kunci?", a: ["FOR", "WHILE", "IF", "SWITCH"], s: 1 },
    { q: "Apa fungsi utama dari kata kunci public static void main(String[] args)?", a: ["Menghapus program", "Sebagai titik awal menjalankan program", "Menghentikan program", "Menyimpan variabel"], s: 1 },
    { q: "Simbol operator yang digunakan untuk mendapatkan sisa hasil bagi adalah?", a: ["/", "*", "%", "#"], s: 2 },
    { q: "Manakah cara pendeklarasian variabel karakter yang benar dalam Java?", a: ["char huruf = 'A';", 'Char huruf = "A";', "string huruf = 'A';", "huruf char = A;"], s: 0 },
    { q: "Dalam pemrograman Java, blok kode biasanya dibatasi menggunakan simbol?", a: ["( )", "{ }", "[ ]", '" "'], s: 1 },
    { q: "Apa kepanjangan dari IDE yang sering digunakan untuk menulis kode?", a: ["Integrated Development Environment", "Internal Data Editor", "Internet Development Engine", "Integrated Design Element"], s: 0 },
    { q: "Nilai maksimal yang bisa disimpan oleh satu variabel bertipe boolean adalah?", a: ["100", "255", "-128 sampai 127", "true atau false"], s: 3 },
    { q: "Cara penulisan pengambilan keputusan 'Jika tidak maka' yang benar adalah?", a: ["IF - THEN", "IF - ELSE", "WHILE - DO", "FOR - NEXT"], s: 1 },
    { q: "Operator yang digunakan untuk menggabungkan dua teks dalam Java adalah?", a: ["&", "+", "*", "|"], s: 1 },
    { q: "Manakah nama kelas utama yang wajib sama dengan nama berkasnya di Java?", a: ["public class Nama { ... }", "class public Nama { ... }", "public Nama class { ... }", "void class Nama { ... }"], s: 0 },
    { q: "Simbol apa yang digunakan untuk operator pembagian dalam Java?", a: [":", "\\", "/", "÷"], s: 2 },
    { q: "Dalam Java, tipe data long digunakan untuk menyimpan?", a: ["Bilangan bulat sangat besar", "Bilangan desimal berkoma", "Satu karakter saja", "Kumpulan teks panjang"], s: 0 },
    { q: "Hasil dari kode program System.out.print(5 + 3); adalah?", a: ["53", "8", "5+3", "Error"], s: 1 },
    { q: "Manakah tipe data desimal dengan kapasitas lebih besar dibanding float?", a: ["int", "char", "double", "byte"], s: 2 },
    { q: "Pernyataan tambahan pada perulangan for untuk menambah nilai penghitung?", a: ["i++", "i--", "**i", "++"], s: 0 },
    { q: "Istilah proses menerjemahkan kode .java menjadi .class disebut?", a: ["Eksekusi", "Mengedit", "Mengompilasi", "Menyalin"], s: 2 }
];

// Pilihan warna unik untuk penanda masing-masing player (Maks 4 orang)
const avatarColors = ["#3498db", "#e74c3c", "#f1c40f", "#2ecc71"]; 

let lobby = {
    players: [],
    selectedQuestions: [],
    currentQuestionIndex: 0,
    status: "waiting", // waiting, playing, finished
    answersReceived: {},
    timer: null,
    timeLeft: 10
};

// Fungsi Mengacak Soal (Mengambil 15 dari 50 Soal)
function prepareQuizQuestions() {
    let shuffled = [...questionBank].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 15);
}

io.on('connection', (socket) => {
    console.log('User terhubung:', socket.id);

    socket.on('joinQuiz', ({ name }) => {
        if (lobby.status !== "waiting") {
            socket.emit('errorMsg', 'Game kuis sudah berjalan.');
            return;
        }
        if (lobby.players.length >= 4) {
            socket.emit('errorMsg', 'Kamar kuis sudah penuh (Maks 4 pemain).');
            return;
        }

        let pColor = avatarColors[lobby.players.length];
        let newPlayer = { id: socket.id, name: name, color: pColor, score: 0 };
        lobby.players.push(newPlayer);

        socket.emit('initLocalPlayer', { color: pColor });
        io.emit('updateLobby', lobby.players);
    });

    socket.on('requestStart', () => {
        if (lobby.players.length > 0 && lobby.status === "waiting") {
            lobby.status = "playing";
            lobby.selectedQuestions = prepareQuizQuestions();
            lobby.currentQuestionIndex = 0;
            sendQuestion();
        }
    });

    socket.on('submitAnswer', ({ optionIndex }) => {
        if (lobby.status !== "playing") return;
        
        // Catat jawaban pemain
        if (!lobby.answersReceived[socket.id]) {
            let p = lobby.players.find(p => p.id === socket.id);
            let currentQuestion = lobby.selectedQuestions[lobby.currentQuestionIndex];
            let isCorrect = (optionIndex === currentQuestion.s);

            if (isCorrect) {
                p.score += 100; // Beri poin jika benar
            }

            lobby.answersReceived[socket.id] = {
                optionIndex: optionIndex,
                color: p.color,
                isCorrect: isCorrect
            };

            // Beritahu semua sisi player untuk menandai tombol jawaban dengan warna player ini
            io.emit('playerAnsweredEffect', {
                playerId: socket.id,
                optionIndex: optionIndex,
                playerColor: p.color
            });

            // Jika semua player aktif sudah menjawab sebelum 10 detik, percepat ke review
            if (Object.keys(lobby.answersReceived).length === lobby.players.length) {
                clearInterval(lobby.timer);
                revealAnswersAndNext();
            }
        }
    });

    function sendQuestion() {
        lobby.answersReceived = {};
        lobby.timeLeft = 10;
        
        let questionData = lobby.selectedQuestions[lobby.currentQuestionIndex];
        
        // Kirim data soal tanpa membocorkan indeks kunci jawaban asli ke client
        io.emit('nextQuestionDeliver', {
            index: lobby.currentQuestionIndex + 1,
            total: 15,
            question: questionData.q,
            options: questionData.a,
            timeLeft: lobby.timeLeft
        });

        clearInterval(lobby.timer);
        lobby.timer = setInterval(() => {
            lobby.timeLeft--;
            io.emit('timerSync', lobby.timeLeft);

            if (lobby.timeLeft <= 0) {
                clearInterval(lobby.timer);
                revealAnswersAndNext();
            }
        }, 1000);
    }

    function revealAnswersAndNext() {
        let currentQuestion = lobby.selectedQuestions[lobby.currentQuestionIndex];
        
        // Kirim kunci jawaban yang benar ke semua sisi user
        io.emit('revealCorrectAnswer', { correctIndex: currentQuestion.s, scores: lobby.players });

        // Beri jeda 3 detik untuk review warna (Hijau/Merah) ala Quizizz sebelum lanjut
        setTimeout(() => {
            lobby.currentQuestionIndex++;
            if (lobby.currentQuestionIndex < 15) {
                sendQuestion();
            } else {
                lobby.status = "finished";
                io.emit('quizGameOver', lobby.players.sort((a,b) => b.score - a.score));
                // Reset lobby untuk sesi berikutnya
                lobby = { players: [], selectedQuestions: [], currentQuestionIndex: 0, status: "waiting", answersReceived: {}, timer: null, timeLeft: 10 };
            }
        }, 3000);
    }

    socket.on('disconnect', () => {
        lobby.players = lobby.players.filter(p => p.id !== socket.id);
        io.emit('updateLobby', lobby.players);
        if (lobby.players.length === 0 && lobby.status !== "waiting") {
            clearInterval(lobby.timer);
            lobby.status = "waiting";
        }
    });
});

http.listen(3000, () => {
    console.log('Server Game Kuis Kilat berjalan di port 3000');
});