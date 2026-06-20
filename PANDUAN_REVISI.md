# Panduan Revisi — Kuis, Ludo, Congklak (Main Bareng via OpenVPN)

## File yang direvisi
| File yang dikirim          | Letakkan/ganti di                  | Apa yang diperbaiki |
|-----------------------------|-------------------------------------|----------------------|
| `server.js`                 | `UAS/server.js` (timpa file lama)   | Matchmaking online utk Kuis dibuat otomatis (tidak perlu kode room manual), server eksplisit listen di `0.0.0.0`, log alamat akses saat start |
| `congklak_index.html`       | `UAS/congklak/public/index.html`    | **Bug fatal**: library `socket.io.js` tidak pernah di-load, jadi mode Online selalu gagal ("Server tidak tersedia"). Sudah ditambahkan + pesan error lebih jelas |
| `kuis_index.html`           | `UAS/kuis/public/index.html`        | Kuis sebelumnya **bukan multiplayer jaringan** (hanya gilir-gantian di 1 HP). Sekarang ditambah mode **🌐 Online** yang benar-benar tersambung ke server lewat socket.io, sehingga bisa dimainkan dari HP/laptop berbeda |

Ludo **tidak diubah** — fitur chat & multiplayer online di Ludo sudah berfungsi dengan benar di kode aslinya (cek `Ludo/server.js` bagian `ludo_chat` dan `Ludo/public/index.html`).

## Cara pakai (skenario OpenVPN seperti yang diminta)

1. **Di komputer Anda (pemilik game, IP VPN 10.8.0.30):**
   ```
   cd UAS
   npm install      # jika belum
   npm start        # atau: node server.js
   ```
   Server akan tampil seperti ini dan otomatis listen ke semua interface (`0.0.0.0`), termasuk IP VPN:
   ```
   🎮 Game Portal berjalan di:
      - Lokal      : http://localhost:3000
      - VPN/LAN    : http://10.8.0.30:3000
   ```

2. **Nyalakan aplikasi OpenVPN** di komputer Anda dan di komputer/HP teman Anda, sampai semua terhubung ke VPN yang sama.

3. **Di komputer teman, buka terminal lalu ping dulu** ke IP Anda untuk memastikan jalur VPN sudah tersambung:
   ```
   ping 10.8.0.30
   ```
   Kalau sudah ada balasan (reply), lanjut ke langkah 4.

4. **Di browser komputer teman**, buka:
   ```
   http://10.8.0.30:3000
   ```
   (port `3000` mengikuti `PORT` di server; ganti jika Anda set `PORT` lain)

5. Dari beranda, pilih game:
   - **Ludo** → pilih mode *2 Pemain* / *4 Pemain* (Online). Pemain yang join dengan mode sama akan otomatis dipasangkan dalam 1 room. Box chat ada di bagian bawah layar — semua pemain dalam room yang sama bisa saling chat dan terbaca bersama.
   - **Congklak/Dakron** → pilih **Online**, akan otomatis dicarikan lawan yang juga klik Online.
   - **Kuis** → di layar awal pilih toggle **🌐 Online**, isi nama Anda, pilih jumlah pemain (2/3/4), klik **CARI LAWAN**. Setelah semua pemain target sudah join, kuis otomatis mulai (countdown → soal → reveal jawaban → skor akhir), semua tersinkron lewat server, bukan lagi gilir 1 HP.

## Catatan teknis penting
- Semua game memakai `io()` **tanpa** alamat host (relative), artinya otomatis menyambung ke alamat & port yang sama dengan yang dibuka di browser. Jadi selama semua pemain membuka `http://10.8.0.30:3000`, mereka akan berada di server (dan room) yang sama — tidak perlu setting IP manual di kode.
- Jika firewall di komputer Anda memblokir port 3000, izinkan koneksi masuk (inbound) untuk port tersebut agar teman via VPN bisa mengaksesnya.
- IP `10.8.0.30` di atas hanya contoh sesuai yang Anda sebutkan; jika IP VPN Anda berubah, gunakan IP yang baru saat membuka browser di sisi teman.
