# Deployment & Operasional Lab

## 1. Persiapan build

1. Isi `.env` berdasarkan `env.example`.
2. Jalankan `npm install`.
3. Build: `npm run build`.
4. Ambil installer dari `out/SIMAK Exam Browser-Setup-x.y.z.exe`.

## 2. Instalasi di Windows (lab)

1. Jalankan installer sebagai admin.
2. Pilih mode *Per machine* agar terpasang untuk semua user.
3. Biarkan opsi “Run after install” tercentang untuk uji langsung.
4. Tambahkan shortcut aplikasi ke **Startup** jika ingin otomatis berjalan saat login.

## 3. Konfigurasi kebijakan OS

- Nonaktifkan akses ke browser lain melalui kebijakan lokal / AppLocker.
- Pastikan user standar tidak punya hak install software tambahan.
- Kunci Task Manager bila diperlukan lewat Group Policy.

## 4. Auto-update

`electron-updater` siap digunakan jika Anda menyediakan feed (S3, server HTTP, dsb). Set `GH_TOKEN` atau `WIN_PUBLISHER_URL` saat build untuk mengaktifkan update otomatis. Jika tidak memakai feed, distribusikan installer baru secara manual.

## 5. SOP Pengawas

1. Pastikan jaringan sekolah stabil sebelum membuka lab.
2. Jalankan SIMAK Exam Browser di semua PC. Splash screen memastikan server siap.
3. Pengawas memegang PIN admin.
4. Jika peserta keluar fokus, UI Vue akan menampilkan peringatan dan server menerima webhook.
5. Untuk menghentikan sesi: tekan `Ctrl+Alt+Shift+A`, masukkan PIN, aplikasi akan tertutup.

## 6. Pemulihan & logging

- Log audit berada di `%APPDATA%/SIMAK Exam Browser/logs/`.
- Jika ada gangguan jaringan, aplikasi menampilkan pesan kesalahan & instruksi restart.
- Gunakan `npm run dev` pada mesin pengembangan untuk debugging (DevTools aktif).

## 7. Checklist QA

- [ ] Uji kombinasi shortcut yang diblok (Ctrl+W, Alt+F4, F11, Ctrl+Shift+I).
- [ ] Uji skenario multi-monitor (cabut / pasang monitor eksternal).
- [ ] Uji panel admin dan PIN salah / benar.
- [ ] Putuskan jaringan selama ujian dan pastikan notifikasi tampil.
- [ ] Validasi webhook menerima payload blur/focus.

