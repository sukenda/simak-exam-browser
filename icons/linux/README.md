# Linux Icons

Untuk aplikasi Linux, taruh file icon PNG di folder ini dengan format:

## Opsi 1: Single Icon (Recommended)
Taruh satu file `icon.png` dengan ukuran minimal 512x512 pixel.

```
icons/linux/
  └── icon.png (512x512 atau lebih besar)
```

## Opsi 2: Multiple Sizes
Taruh berbagai ukuran icon:

```
icons/linux/
  ├── 16x16.png
  ├── 32x32.png
  ├── 48x48.png
  ├── 64x64.png
  ├── 128x128.png
  ├── 256x256.png
  └── 512x512.png
```

## Convert dari ICO (Windows)

Jika hanya punya file `.ico`, bisa convert menggunakan:

### Menggunakan ImageMagick:
```bash
convert icons/win/simak-icon-circle.ico -resize 512x512 icons/linux/icon.png
```

### Menggunakan online converter:
- https://convertio.co/ico-png/
- https://cloudconvert.com/ico-to-png

## Note

Jika folder ini kosong, electron-builder akan menggunakan icon default.

