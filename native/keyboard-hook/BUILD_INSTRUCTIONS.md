# Build Native Keyboard Hook Module

Native keyboard hook module ini hanya bisa dikompilasi di **Windows** karena menggunakan Windows API (`SetWindowsHookEx`).

## 🚀 Automatic Build via GitHub Actions

Native module ini **otomatis di-build** oleh GitHub Actions saat membuat release baru. Anda tidak perlu build manual kecuali untuk development/testing.

### Cara Release Baru:
1. Buat tag baru: `git tag v0.2.0`
2. Push tag: `git push origin v0.2.0`
3. GitHub Actions akan otomatis:
   - Build native module di Windows
   - Build installer Windows (.exe)
   - Build package Linux (.deb)
   - Membuat GitHub Release
   - Deploy ke GitHub Pages untuk auto-update

---

## 🔧 Manual Build (untuk Development)

Jika ingin build manual di Windows:

### Prerequisites

1. **Node.js** versi 18+ (sama dengan yang dipakai Electron)
2. **Python** 3.x (untuk node-gyp)
3. **Visual Studio Build Tools** dengan komponen:
   - "Desktop development with C++"
   - Windows 10/11 SDK

### Install Build Tools

```powershell
# Install via npm (akan menginstall build tools jika belum ada)
npm install --global windows-build-tools

# Atau install manual dari:
# https://visualstudio.microsoft.com/visual-cpp-build-tools/
```

### Build Steps

1. Buka **Command Prompt** atau **PowerShell** di folder proyek
2. Jalankan perintah berikut:

```powershell
cd native/keyboard-hook
npm install
npm run rebuild
```

3. Jika berhasil, file `build/Release/keyboard-hook.node` akan terbentuk

### Verifikasi

Setelah build, struktur folder harus seperti ini:

```
native/keyboard-hook/
├── binding.gyp
├── index.js
├── keyboard-hook.cpp
├── package.json
├── BUILD_INSTRUCTIONS.md
└── build/
    └── Release/
        └── keyboard-hook.node  <-- File hasil kompilasi
```

---

## 🛠️ Troubleshooting

### Error: Cannot find module 'node-gyp'
```powershell
npm install -g node-gyp
```

### Error: MSBuild / Visual Studio not found
Install Visual Studio Build Tools dengan komponen C++.

### Error: Python not found
Install Python 3.x dan pastikan ada di PATH.

### Error: Native module not loading in packaged app
Pastikan file `.node` ada di path yang benar setelah packaging:
- `resources/native/keyboard-hook/build/Release/keyboard-hook.node`

---

## 📝 Catatan Penting

- File `.node` adalah binary khusus **Windows x64**
- Jika Electron versi berubah signifikan, perlu rebuild ulang
- Di **Linux/macOS**, native module ini tidak akan dimuat (fallback ke Electron API)
- GitHub Actions menggunakan `windows-latest` runner untuk build

## 🔒 Fitur yang Diblokir

Native keyboard hook memblokir:
- Windows key (bare & combinations: Win+D, Win+R, Win+L, Win+X, dll)
- Alt+Tab, Alt+F4, Alt+Esc
- Ctrl+Shift+Esc (Task Manager)
- F1-F12 (Function keys)
- Ctrl+A sampai Ctrl+Z
- Dan banyak lagi...

