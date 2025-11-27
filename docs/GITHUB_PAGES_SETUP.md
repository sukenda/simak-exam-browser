# Setup GitHub Pages untuk Auto-Update

GitHub Pages digunakan untuk hosting file update (`latest.yml` dan `latest-linux.yml`) yang diperlukan untuk auto-update aplikasi.

## ⚠️ Penting: Enable GitHub Pages

Sebelum workflow bisa deploy ke GitHub Pages, Anda **harus** mengaktifkan GitHub Pages di repository settings terlebih dahulu.

## 📋 Langkah-langkah Setup

### 1. Buat Repository Public (PENTING!)

**GitHub Pages hanya tersedia untuk:**
- ✅ **Public repository** (gratis)
- ❌ Private repository (hanya dengan GitHub Enterprise - berbayar)

**Jika repository Anda masih private:**

1. Buka repository di GitHub: `https://github.com/sukenda/simak-exam-browser`
2. Klik **Settings** (di bagian atas repository)
3. Scroll ke bagian paling bawah → **Danger Zone**
4. Klik **Change visibility** → **Make public**
5. Konfirmasi dengan mengetik nama repository

**Catatan:** File yang di-deploy ke GitHub Pages akan **public** dan bisa diakses siapa saja. Ini normal untuk file update (`latest.yml`).

### 2. Enable GitHub Pages

Setelah repository menjadi **public**:

1. Buka repository di GitHub: `https://github.com/sukenda/simak-exam-browser`
2. Klik **Settings** (di bagian atas repository)
3. Scroll ke bagian **Pages** (di sidebar kiri)
4. Di bagian **Source**, pilih **GitHub Actions** (bukan "Deploy from a branch")
5. Klik **Save**

### 2. Verifikasi

Setelah enable GitHub Pages:
- Workflow akan otomatis deploy ke GitHub Pages saat membuat release baru (tag `v*`)
- URL GitHub Pages akan tersedia di: `https://sukenda.github.io/simak-exam-browser/`

### 3. Test Auto-Update

Setelah deploy pertama:
- File `latest.yml` dan `latest-linux.yml` akan tersedia di GitHub Pages
- Aplikasi akan otomatis mengecek update dari URL ini saat dibuka

## 🔧 Troubleshooting

### Error: "Upgrade or make this repository public to enable Pages"

**Penyebab:**
- Repository masih **private**
- GitHub Pages hanya tersedia untuk public repository (gratis) atau private dengan GitHub Enterprise (berbayar)

**Solusi:**
1. **Buat repository menjadi public** (lihat langkah 1 di atas)
2. Atau gunakan alternatif: host file update di server lain (lihat bagian "Alternatif" di bawah)

### Error: "Get Pages site failed"

**Penyebab:**
- GitHub Pages belum di-enable
- GitHub Pages tidak dikonfigurasi untuk menggunakan GitHub Actions

**Solusi:**
1. Pastikan repository sudah **public**
2. Pastikan GitHub Pages sudah di-enable (lihat langkah 2 di atas)
3. Pastikan Source di-set ke **GitHub Actions** (bukan branch)
4. Re-run workflow setelah enable GitHub Pages

### Error: "Not Found"

**Penyebab:**
- Repository tidak memiliki akses write untuk Pages
- Workflow permissions tidak cukup

**Solusi:**
1. Pastikan workflow memiliki permission `pages: write` (sudah ada di workflow)
2. Pastikan repository settings > Actions > General > Workflow permissions di-set ke "Read and write permissions"

### Alternatif: Jika Repository Harus Tetap Private

Jika repository **harus tetap private** dan tidak ingin upgrade ke GitHub Enterprise, Anda bisa:

#### Opsi 1: Host File Update di Server Sendiri

1. Host file `latest.yml` dan `latest-linux.yml` di server web Anda
2. Update `AUTO_UPDATE_URL` di GitHub Secrets:
   - Buka: Settings → Secrets and variables → Actions
   - Tambahkan secret: `AUTO_UPDATE_URL` = `https://your-server.com/updates/`
3. Update workflow untuk upload file ke server tersebut

#### Opsi 2: Gunakan GitHub Releases (Tanpa Pages)

Auto-update masih bisa bekerja dengan GitHub Releases, tapi perlu konfigurasi tambahan:

1. File `latest.yml` akan tersedia di GitHub Releases
2. Update `AUTO_UPDATE_URL` ke URL GitHub Releases API
3. Aplikasi akan download dari Releases (perlu GitHub token)

#### Opsi 3: Buat Repository Public (Disarankan)

**Ini adalah solusi termudah dan gratis:**
- File update akan public (ini normal dan aman)
- Tidak perlu server tambahan
- Auto-update bekerja otomatis

## 📝 Catatan

- GitHub Pages **gratis** untuk public repository
- File yang di-deploy akan tersedia secara public
- Auto-update akan bekerja otomatis setelah setup selesai

