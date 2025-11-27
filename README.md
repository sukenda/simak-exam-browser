# SIMAK Exam Browser

Exam browser berbasis Electron untuk membungkus aplikasi SIMAK (Vue) agar aman digunakan di laboratorium ujian Windows.

## 📋 Deskripsi

SIMAK Exam Browser adalah aplikasi desktop yang dirancang khusus untuk mengamankan lingkungan ujian online. Aplikasi ini membungkus aplikasi web SIMAK dengan berbagai fitur keamanan untuk mencegah kecurangan selama ujian berlangsung.

## ✨ Fitur Utama

- ✅ **Mode Kiosk & Fullscreen** - Aplikasi berjalan dalam mode fullscreen tanpa akses ke desktop
- ✅ **Blokir Shortcut Keyboard** - Mencegah penggunaan shortcut seperti Alt+Tab, Ctrl+C, Ctrl+V, dll
- ✅ **Blokir Context Menu** - Klik kanan tidak berfungsi
- ✅ **Blokir Copy/Paste** - Clipboard diblokir untuk mencegah salin-tempel
- ✅ **Monitoring Fokus Window** - Mendeteksi dan melaporkan kehilangan fokus
- ✅ **Auto Update** - Update otomatis dari GitLab Releases
- ✅ **Dialog Peringatan** - Notifikasi visual saat user mencoba aksi terlarang
- ✅ **Admin Panel** - Panel admin tersembunyi untuk keluar aplikasi
- ✅ **Info Aplikasi** - Tekan F12 untuk melihat informasi aplikasi

## 🚀 Instalasi

### Persyaratan Sistem

- **OS**: Windows 10/11 (64-bit)
- **RAM**: Minimal 4GB
- **Disk**: Minimal 200MB ruang kosong
- **Koneksi Internet**: Diperlukan untuk koneksi ke server ujian dan auto-update

### Cara Instalasi

#### 1. Download Installer

Download file installer dari [GitLab Releases](https://gitlab.com/simak-khas-kempek/simak-exam-browser/-/releases) atau dari sumber yang disediakan administrator.

File installer memiliki format: `simak-exam-browser-Setup-{version}.exe`

#### 2. Jalankan Installer

1. Klik dua kali file installer yang telah didownload
2. Jika muncul **Windows Defender SmartScreen**, klik **More info** → **Run anyway** (karena aplikasi belum ditandatangani)
3. Ikuti wizard instalasi:
   - Pilih lokasi instalasi (default: `C:\Program Files\simak-exam-browser`)
   - Klik **Install** untuk memulai instalasi
   - Tunggu hingga proses instalasi selesai
   - Klik **Finish** untuk menutup wizard

#### 3. Verifikasi Instalasi

Setelah instalasi selesai, aplikasi akan tersedia di:
- **Start Menu**: `SIMAK Exam Browser`
- **Desktop**: Shortcut `SIMAK Exam Browser` (jika dipilih saat instalasi)
- **Lokasi Instalasi**: `C:\Program Files\simak-exam-browser\`

#### 4. Konfigurasi Awal (Opsional)

Aplikasi menggunakan konfigurasi default yang sudah diset. Jika perlu mengubah konfigurasi:

1. Buka folder instalasi: `C:\Program Files\simak-exam-browser\`
2. Edit file konfigurasi (jika ada) atau hubungi administrator

### Instalasi untuk Development

Jika Anda ingin mengembangkan atau memodifikasi aplikasi:

#### Prasyarat Development

- **Node.js**: Versi 18 atau lebih tinggi
- **npm**: Terpasang bersama Node.js
- **Git**: Untuk clone repository

#### Langkah-langkah

1. **Clone Repository**
   ```bash
   git clone https://gitlab.com/simak-khas-kempek/simak-exam-browser.git
   cd simak-exam-browser
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Setup Environment Variables**
   ```bash
   cp env.example .env
   ```
   
   Edit file `.env` dan sesuaikan dengan kebutuhan:
   ```env
   EXAM_APP_URL=https://simak.example.sch.id/exam
   ATTENTION_WEBHOOK_URL=https://simak.example.sch.id/api/exam/attention
   ADMIN_PIN=123456
   ADMIN_SHORTCUT=Ctrl+Alt+Shift+A
   AUTO_UPDATE_URL=https://gitlab+deploy-token-xxx:token@gitlab.com/group/project/-/releases/
   ```

4. **Jalankan Development Mode**
   ```bash
   npm run dev
   ```

5. **Build Native Module (Opsional)**
   
   Native keyboard hook module memberikan blokir OS-level yang lebih kuat. Untuk build:
   ```bash
   cd native/keyboard-hook
   npm install
   npm run rebuild
   cd ../..
   ```
   
   **Catatan**: Native module adalah opsional. Aplikasi akan tetap berfungsi dengan Electron API jika native module tidak tersedia.

6. **Build untuk Production**
   ```bash
   npm run build
   ```
   
   File installer akan tersedia di folder `out/`
   
   **Catatan**: Build script akan otomatis mencoba build native module. Jika gagal (misalnya karena tidak ada Visual Studio Build Tools), build akan tetap lanjut tanpa native module.

## 🔄 Auto Update

Aplikasi mendukung auto-update otomatis dari GitLab Releases. Fitur ini memungkinkan aplikasi untuk memperbarui dirinya sendiri tanpa perlu instalasi manual.

### Cara Kerja Auto Update

1. **Saat Aplikasi Dibuka**: Aplikasi secara otomatis mengecek update dari GitLab Releases
2. **Deteksi Update**: Jika ada versi baru, aplikasi akan mengunduh installer di background
3. **Instalasi Otomatis**: Setelah download selesai, aplikasi akan restart dan menginstal versi baru
4. **Transparan untuk User**: Proses update berjalan otomatis tanpa intervensi user

### Konfigurasi Auto Update

#### Untuk Administrator

Auto update dikonfigurasi melalui environment variable `AUTO_UPDATE_URL`:

```env
AUTO_UPDATE_URL=https://gitlab+deploy-token-USERNAME:TOKEN@gitlab.com/group/project/-/releases/
```

**Format URL:**
- `gitlab+deploy-token-USERNAME`: Username dari GitLab Deploy Token
- `TOKEN`: Token dari GitLab Deploy Token
- `group/project`: Group dan nama project di GitLab
- `/-/releases/`: Path ke releases (harus diakhiri dengan `/`)

#### Membuat GitLab Deploy Token

1. Buka project di GitLab
2. Pergi ke **Settings** → **Repository** → **Deploy tokens**
3. Klik **Add token**
4. Isi:
   - **Name**: `exam-browser-updater`
   - **Scopes**: Centang `read_repository`
5. Klik **Create token**
6. Salin **Username** dan **Token** yang diberikan
7. Gunakan untuk membuat `AUTO_UPDATE_URL`

#### Testing Auto Update

1. **Buat Release Baru di GitLab**:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
   
   GitLab CI/CD akan otomatis build dan membuat release

2. **Jalankan Aplikasi Versi Lama**:
   - Aplikasi akan otomatis mendeteksi update
   - Update akan diunduh di background
   - Aplikasi akan restart dan menginstal versi baru

3. **Verifikasi Update**:
   - Tekan **F12** untuk membuka info aplikasi
   - Periksa versi aplikasi

### Troubleshooting Auto Update

#### Update Tidak Terdeteksi

1. **Periksa Koneksi Internet**: Pastikan komputer terhubung ke internet
2. **Periksa URL Feed**: Pastikan `AUTO_UPDATE_URL` benar dan dapat diakses
3. **Periksa Token**: Pastikan Deploy Token masih valid dan memiliki akses `read_repository`
4. **Periksa Log**: Log aplikasi tersedia di `%APPDATA%\SIMAK Exam Browser\logs\`

#### Update Gagal

1. **Periksa Permission**: Pastikan aplikasi memiliki permission untuk menulis ke folder instalasi
2. **Periksa Antivirus**: Beberapa antivirus mungkin memblokir proses update
3. **Restart Aplikasi**: Coba restart aplikasi untuk memicu pengecekan update ulang

#### Update Manual

Jika auto-update tidak berfungsi, Anda dapat melakukan update manual:

1. Download installer versi terbaru dari GitLab Releases
2. Jalankan installer (akan otomatis mengupgrade instalasi yang ada)
3. Atau uninstall versi lama terlebih dahulu, lalu install versi baru

## 📝 Konfigurasi

### Environment Variables

Aplikasi menggunakan environment variables untuk konfigurasi. File `.env` digunakan untuk development, sedangkan untuk production dapat dikonfigurasi melalui:

- File konfigurasi di folder instalasi
- System environment variables
- Build-time configuration

**Variabel yang Tersedia:**

| Variable | Deskripsi | Default | Required |
|----------|-----------|---------|----------|
| `EXAM_APP_URL` | URL aplikasi Vue yang akan dibungkus | `https://localhost:4173` | ✅ |
| `ATTENTION_WEBHOOK_URL` | Endpoint untuk melaporkan kehilangan fokus | - | ❌ |
| `ADMIN_PIN` | PIN untuk membuka panel admin | `123456` | ✅ |
| `ADMIN_SHORTCUT` | Shortcut keyboard untuk membuka panel admin | `Ctrl+Alt+Shift+A` | ✅ |
| `AUTO_UPDATE_URL` | URL feed untuk auto-update | - | ❌ |
| `SENTRY_DSN` | Sentry DSN untuk crash reporting | - | ❌ |

## 🛠️ Penggunaan

### Menjalankan Aplikasi

1. Klik shortcut **SIMAK Exam Browser** dari Start Menu atau Desktop
2. Aplikasi akan menampilkan splash screen
3. Aplikasi akan otomatis membuka URL ujian yang dikonfigurasi

### Shortcut Keyboard

- **F12**: Menampilkan informasi aplikasi
- **Ctrl+Alt+Shift+A**: Membuka panel admin (default, dapat diubah)

### Panel Admin

Panel admin digunakan untuk keluar dari aplikasi:

1. Tekan shortcut admin (default: `Ctrl+Alt+Shift+A`)
2. Masukkan PIN admin
3. Klik **Verifikasi & Keluar**

### Dialog Peringatan

Jika user mencoba menggunakan shortcut yang diblokir, akan muncul dialog peringatan:
- Menampilkan shortcut yang diblokir
- Pesan peringatan
- Tombol **Mengerti** untuk menutup dialog
- Dialog akan otomatis tertutup setelah 8 detik

## 🔒 Keamanan

### Native Keyboard Hook (OS-Level Blocking)

Aplikasi mendukung **native keyboard hook** untuk blokir OS-level yang lebih kuat. Fitur ini:

- ✅ **Blokir Windows Key 100%** - Tombol Windows benar-benar tidak berfungsi
- ✅ **Blokir Alt+Tab** - Tidak bisa switch window
- ✅ **Blokir Ctrl+Shift+Esc** - Task Manager tidak bisa dibuka
- ✅ **Blokir Alt+F4** - Tidak bisa close window
- ✅ **Blokir Win+X, Win+L, Win+D, Win+R** - Semua kombinasi Windows key diblokir

**Catatan Penting**:
- Native module adalah **opsional** - aplikasi tetap berfungsi tanpa native module
- Jika native module tidak tersedia, aplikasi menggunakan Electron API (fallback)
- Native module memerlukan build dengan Visual Studio Build Tools (Windows)
- Auto-update tetap berfungsi normal meskipun native module tidak terpasang

### Shortcut yang Diblokir

Aplikasi memblokir berbagai shortcut keyboard untuk mencegah kecurangan:

- **Alt+Tab** - Switch window (butuh Mode Kiosk untuk efektif)
- **Alt+F4** - Close window
- **Ctrl+C, Ctrl+V, Ctrl+X** - Copy/Paste/Cut
- **Ctrl+W** - Close tab
- **Ctrl+R** - Refresh
- **F11** - Fullscreen toggle
- **Escape** - Escape key
- **Windows Key** - Start menu (butuh Mode Kiosk untuk efektif)
- **Ctrl+Alt+Del** - Task Manager (butuh Mode Kiosk untuk efektif)

### Rekomendasi Keamanan Tambahan

Untuk keamanan maksimal, disarankan:

1. **Windows Kiosk Mode**: Aktifkan Windows Assigned Access untuk mode kiosk
2. **Group Policy**: Konfigurasi GPO untuk menonaktifkan Task Manager dan shortcut sistem
3. **Network Monitoring**: Monitor koneksi jaringan untuk mendeteksi aktivitas mencurigakan
4. **Proctoring**: Gunakan sistem proctoring tambahan jika diperlukan

## 🐛 Crash Reporting

Aplikasi menggunakan **Sentry** untuk crash reporting dan error tracking. Fitur ini membantu developer mengidentifikasi dan memperbaiki bug dengan cepat.

### Konfigurasi Sentry

1. **Dapatkan Sentry DSN**:
   - Buat akun di [sentry.io](https://sentry.io)
   - Buat project baru untuk aplikasi ini
   - Salin DSN dari project settings

2. **Setup di Development**:
   - Tambahkan `SENTRY_DSN` ke file `.env`:
     ```env
     SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
     ```

3. **Setup di Production (GitLab CI)**:
   - Buka GitLab Project → Settings → CI/CD → Variables
   - Tambahkan variable `SENTRY_DSN` dengan value DSN dari Sentry
   - Set sebagai **Protected** dan **Masked** untuk keamanan
   - Variable akan otomatis ditambahkan ke `.env` saat build

### Fitur Crash Reporting

- ✅ **Automatic Crash Detection** - Mendeteksi crash dan unhandled exceptions
- ✅ **Error Context** - Menyertakan informasi platform, versi, dan environment
- ✅ **Performance Monitoring** - Tracking performance issues
- ✅ **Release Tracking** - Melacak error per versi aplikasi
- ✅ **Fallback to Electron crashReporter** - Jika Sentry tidak dikonfigurasi, menggunakan Electron crashReporter

### Fallback Mechanism

Jika `SENTRY_DSN` tidak dikonfigurasi, aplikasi akan menggunakan **Electron crashReporter** sebagai fallback. Crash report akan disimpan lokal di:
- Windows: `%AppData%/simak-exam-browser/Crash Reports/`

## 📊 Logging

Aplikasi menyimpan log untuk audit trail. Log tersedia di:

```
%APPDATA%\SIMAK Exam Browser\logs\
```

Log mencakup:
- Event aplikasi (start, stop, error)
- Shortcut yang diblokir
- Kehilangan fokus window
- Update events
- Error dan warning

## 🐛 Troubleshooting

### Aplikasi Tidak Bisa Dibuka

1. Periksa apakah aplikasi sudah terinstall dengan benar
2. Coba jalankan sebagai Administrator
3. Periksa log di `%APPDATA%\SIMAK Exam Browser\logs\`
4. Pastikan tidak ada konflik dengan antivirus

### Server Tidak Bisa Dihubungi

1. Periksa koneksi internet
2. Periksa URL di konfigurasi (`EXAM_APP_URL`)
3. Pastikan server ujian sedang berjalan
4. Periksa firewall dan proxy settings

### Shortcut Tidak Terblokir

Beberapa shortcut (seperti Alt+Tab, Windows Key) memerlukan konfigurasi OS-level:
- Aktifkan Windows Kiosk Mode
- Konfigurasi Group Policy
- Lihat dokumentasi Windows untuk detail

## 📚 Dokumentasi Tambahan

- [Deployment Guide](docs/DEPLOYMENT.md) - Panduan deployment untuk lab ujian
- [GitLab CI/CD](.gitlab-ci.yml) - Konfigurasi CI/CD untuk build otomatis

## 📄 License

MIT License

## 👥 Kontributor

SIMAK KHAS Kempek Cirebon

---

**Catatan**: Aplikasi ini dirancang khusus untuk lingkungan ujian yang terkontrol. Pastikan untuk menguji aplikasi di lingkungan yang sesuai sebelum digunakan di produksi.
