# Sistem Pemeliharaan UNS — migrasi V2

## Status

Branch migrasi bertahap dari aplikasi satu berkas ke Vue 3 + TypeScript + Vite. Fitur lama dipertahankan sebagai baseline kompatibilitas pada `src/legacy-main.ts`; tahap awal ini memindahkan entrypoint ke Vite dan mengganti CDN runtime Vue/Firebase dengan dependensi npm yang dipatok versinya.

## Menjalankan

- Node.js 20 LTS direkomendasikan.
- `npm install`
- `npm run dev`
- `npm run typecheck`
- `npm run build`

## Batasan migrasi tahap awal

- Firebase project tetap `uns-fleet-service`, RTDB tetap `https://uns-fleet-service-default-rtdb.asia-southeast1.firebasedatabase.app`, dan path data `artifacts/uns-fleet-service/public/data_v2` tidak diubah.
- Autentikasi Email/Password dan Anonymous Auth tetap menggunakan Firebase Auth.
- Komponen, domain logic, dan repository Firebase belum seluruhnya dipisah; itu adalah pekerjaan tahap berikutnya dan harus diuji per modul sebelum menghapus baseline lama.
- Tailwind CDN, Font Awesome CDN, Google Fonts, dan integrasi FCM Capacitor masih dipertahankan untuk menghindari perubahan tampilan/perilaku yang tidak perlu pada langkah pertama.
- Token bot/AI dan konfigurasi sensitif yang saat ini dibaca klien perlu audit keamanan terpisah. Jangan menganggap secret aman hanya karena aplikasi sudah dibundel.

## Aturan keselamatan data

Jangan mengubah Firebase Rules, struktur RTDB, nama node, atau memigrasikan data produksi sebagai bagian dari build frontend. Selalu uji pada salinan/staging. Jangan deploy atau mengganti branch produksi sebelum seluruh acceptance test selesai.

## Rencana ekstraksi modul

1. Firebase bootstrap, Auth lifecycle, dan listener disposer.
2. Repositories kendaraan, pengemudi, dan histori servis.
3. Domain services untuk interval servis, komponen, dan perhitungan status.
4. Modul notifikasi Telegram/FCM, Google Sheets, dan AI.
5. Vue components, stores, lazy routes, dan virtualisasi histori bila diperlukan.
6. Automated tests dan pengujian integrasi RTDB.
