# Build Native Keyboard Hook Module

Native keyboard hook module ini hanya bisa dikompilasi di **Windows** karena menggunakan Windows API (`SetWindowsHookEx`).

## Prerequisites (di Windows)

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

## Build Steps

1. Buka **Command Prompt** atau **PowerShell** di folder proyek
2. Jalankan perintah berikut:

```powershell
cd native/keyboard-hook
npm install
npm run rebuild
```

3. Jika berhasil, file `build/Release/keyboard-hook.node` akan terbentuk
4. Commit file tersebut ke Git:

```powershell
git add build/Release/keyboard-hook.node
git commit -m "chore: add prebuilt Windows native keyboard hook"
git push
```

## Verifikasi

Setelah commit, struktur folder harus seperti ini:

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

## Troubleshooting

### Error: Cannot find module 'node-gyp'
```powershell
npm install -g node-gyp
```

### Error: MSBuild / Visual Studio not found
Install Visual Studio Build Tools dengan komponen C++.

### Error: Python not found
Install Python 3.x dan pastikan ada di PATH.

## Catatan

- File `.node` adalah binary khusus Windows x64
- Jika Electron versi berubah signifikan, mungkin perlu rebuild ulang
- Di Linux/macOS, native module ini tidak akan dimuat (fallback ke Electron API)

