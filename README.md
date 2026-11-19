# Sistem Pemeliharaan UNS — migrasi V2

## Status

Branch migrasi bertahap dari aplikasi satu berkas ke Vue 3 + TypeScript + Vite. Fitur lama dipertahankan sebagai baseline kompatibilitas pada `src/legacy-main.js`; tahap awal ini memindahkan entrypoint ke Vite dan mengganti CDN runtime Vue/Firebase dengan dependensi npm yang dipatok versinya.

## Menjalankan

- Node.js 20 LTS direkomendasikan.
- `npm install`
- `npm run dev`
- `npm run typecheck`
- `npm test`
- `npm run build`

## Batasan migrasi tahap awal

- Firebase project tetap `uns-fleet-service`, RTDB tetap `https://uns-fleet-service-default-rtdb.asia-southeast1.firebasedatabase.app`, dan path data `artifacts/uns-fleet-service/public/data_v2` tidak diubah.
- Autentikasi Email/Password dan Anonymous Auth tetap menggunakan Firebase Auth.
- Komponen, domain logic, dan repository Firebase belum seluruhnya dipisah; itu adalah pekerjaan tahap berikutnya dan harus diuji per modul sebelum menghapus baseline lama.
- Tailwind CDN, Font Awesome CDN, Google Fonts, dan integrasi FCM Capacitor masih dipertahankan untuk menghindari perubahan tampilan/perilaku yang tidak perlu pada langkah pertama.
- Token bot/AI dan konfigurasi sensitif yang saat ini dibaca klien perlu audit keamanan terpisah. Jangan menganggap secret aman hanya karena aplikasi sudah dibundel.

## Aturan keselamatan data

Jangan mengubah Firebase Rules, struktur RTDB, nama node, atau memigrasikan data produksi sebagai bagian dari build frontend. Selalu uji pada salinan/staging. Jangan deploy atau mengganti branch produksi sebelum seluruh acceptance test selesai.

## Kemajuan ekstraksi modul

- Firebase bootstrap dipisahkan di `src/services/firebase.ts`; Auth Email/Password dan Anonymous Auth tetap memakai project lama.
- Path RTDB dipusatkan di `src/services/paths.js`; nama node dan root database tidak berubah.
- Listener kendaraan, pengemudi, log, koneksi, dan konfigurasi admin kini menyimpan fungsi unsubscribe dan dapat dilepas saat komponen root dihancurkan.
- Aturan interval servis dipisahkan di `src/domain/service-rules.js` dan diuji di `tests/service-rules.test.js`.

## Rencana ekstraksi berikutnya

1. Repositories kendaraan, pengemudi, dan histori servis dengan kontrak data kompatibel.
2. Modul notifikasi Telegram/FCM, Google Sheets, dan AI; pindahkan token/API key ke backend sebelum mengubah alur kirim.
3. Vue components, stores, lazy routes, dan virtualisasi histori bila diperlukan.
4. Automated regression tests dan pengujian integrasi RTDB pada project staging.
