import { contextBridge, ipcRenderer } from 'electron';

window.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

window.addEventListener(
  'dragstart',
  (event) => {
    event.preventDefault();
  },
  true
);

window.addEventListener(
  'drop',
  (event) => {
    event.preventDefault();
  },
  true
);

document.addEventListener(
  'copy',
  (event) => {
    event.preventDefault();
  },
  true
);

document.addEventListener(
  'cut',
  (event) => {
    event.preventDefault();
  },
  true
);

document.addEventListener(
  'paste',
  (event) => {
    event.preventDefault();
  },
  true
);

Object.defineProperty(window, 'open', {
  value: () => null,
  writable: false
});

type InfoOverlayPayload = {
  visible: boolean;
  data?: {
    version: string;
    productName: string;
    platform: string;
    arch: string;
    iconDataUrl?: string;
  };
};

const focusListeners = new Set<(payload: { focused: boolean }) => void>();
const warningListeners = new Set<
  (payload: { combo?: string; message: string; source: string; timestamp: string }) => void
>();
let warningOverlay: HTMLDivElement | null = null;
let warningBackdrop: HTMLDivElement | null = null;
let warningMessageEl: HTMLParagraphElement | null = null;
let warningComboInfoEl: HTMLDivElement | null = null;
let warningHideTimer: ReturnType<typeof setTimeout> | null = null;
let infoOverlayElement: HTMLDivElement | null = null;

ipcRenderer.on('exam:focus', (_event, payload) => {
  focusListeners.forEach((listener) => listener(payload));
  window.dispatchEvent(new CustomEvent('exam-focus-change', { detail: payload }));
});

ipcRenderer.on('exam:warning', (_event, payload) => {
  warningListeners.forEach((listener) => listener(payload));
  window.dispatchEvent(new CustomEvent('exam-warning', { detail: payload }));
  showWarningOverlay(payload);
});

ipcRenderer.on('info:overlay', (_event, payload: InfoOverlayPayload) => {
  if (payload.visible && payload.data) {
    showInfoOverlay(payload.data);
  } else {
    hideInfoOverlay();
  }
});

// Expose examLock API
const examLockAPI = {
  onFocusChange(callback: (payload: { focused: boolean }) => void) {
    focusListeners.add(callback);
    return () => focusListeners.delete(callback);
  },
  onWarning(callback: (payload: { combo?: string; message: string }) => void) {
    warningListeners.add(callback);
    return () => warningListeners.delete(callback);
  },
  getNetworkInfo() {
    return ipcRenderer.invoke('network:get-info');
  }
};

contextBridge.exposeInMainWorld('examLock', examLockAPI);

// Juga simpan di global untuk akses langsung (fallback)
(window as any).examLock = examLockAPI;

function showWarningOverlay(payload: { combo?: string; message: string }) {
  if (!document.body) {
    window.setTimeout(() => showWarningOverlay(payload), 50);
    return;
  }

  ensureWarningOverlay();

  if (warningBackdrop) {
    warningBackdrop.style.display = 'flex';
    warningBackdrop.style.animation = 'fadeIn 0.2s ease-out';
  }

  if (warningOverlay) {
    warningOverlay.style.animation = 'slideUp 0.3s ease-out';
  }

  if (warningMessageEl) {
    warningMessageEl.textContent =
      payload.message ?? 'Tindakan ini diblokir. Tetap fokus pada layar ujian.';
  }

  if (warningComboInfoEl) {
    if (payload.combo) {
      warningComboInfoEl.style.display = 'block';
      warningComboInfoEl.innerHTML = `<strong>Pintasan yang diblokir:</strong> <code style="background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${payload.combo}</code>`;
    } else {
      warningComboInfoEl.style.display = 'none';
    }
  }

  if (warningHideTimer) {
    clearTimeout(warningHideTimer);
  }
  warningHideTimer = setTimeout(() => {
    hideWarningOverlay();
  }, 8000);
}

function hideWarningOverlay() {
  if (warningHideTimer) {
    clearTimeout(warningHideTimer);
    warningHideTimer = null;
  }
  if (warningBackdrop) {
    warningBackdrop.style.display = 'none';
  }
}

function ensureWarningOverlay() {
  if (warningOverlay && warningBackdrop) {
    return;
  }

  // Buat backdrop
  warningBackdrop = document.createElement('div');
  warningBackdrop.id = 'exam-warning-backdrop';
  Object.assign(warningBackdrop.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    background: 'rgba(0, 0, 0, 0.6)',
    zIndex: '2147483646',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'fadeIn 0.2s ease-out'
  });

  // Buat dialog
  warningOverlay = document.createElement('div');
  warningOverlay.id = 'exam-warning-overlay';
  warningOverlay.style.cssText = `
    background: #ffffff;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-width: 480px;
    width: 90%;
    z-index: 2147483647;
    animation: slideUp 0.3s ease-out;
    overflow: hidden;
  `;

  // Header dengan icon
  const header = document.createElement('div');
  header.style.cssText = `
    background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%);
    color: white;
    padding: 24px;
    text-align: center;
  `;
  const icon = document.createElement('div');
  icon.style.cssText = `
    font-size: 48px;
    margin-bottom: 12px;
  `;
  icon.textContent = '⚠️';
  const title = document.createElement('h2');
  title.style.cssText = `
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;
  title.textContent = 'Aksi Diblokir';
  header.appendChild(icon);
  header.appendChild(title);

  // Content
  const content = document.createElement('div');
  content.style.cssText = `
    padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;
  warningMessageEl = document.createElement('p');
  warningMessageEl.style.cssText = `
    margin: 0 0 16px 0;
    font-size: 16px;
    color: #333;
    line-height: 1.6;
  `;
  warningMessageEl.textContent = 'Tindakan ini diblokir. Tetap fokus pada layar ujian.';

  warningComboInfoEl = document.createElement('div');
  warningComboInfoEl.style.cssText = `
    background: #f8f9fa;
    padding: 12px;
    border-radius: 8px;
    margin-top: 12px;
    font-size: 14px;
    color: #666;
  `;
  warningComboInfoEl.style.display = 'none';

  const info = document.createElement('p');
  info.style.cssText = `
    margin: 0;
    font-size: 14px;
    color: #666;
    line-height: 1.5;
  `;
  info.textContent =
    'Aplikasi ini dirancang untuk menjaga integritas ujian. Silakan tutup dialog ini dan lanjutkan ujian.';
  content.appendChild(warningMessageEl);
  content.appendChild(warningComboInfoEl);
  content.appendChild(info);

  // Footer dengan tombol
  const footer = document.createElement('div');
  footer.style.cssText = `
    padding: 16px 24px;
    background: #f8f9fa;
    border-top: 1px solid #e9ecef;
    display: flex;
    justify-content: center;
  `;
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Mengerti';
  closeBtn.style.cssText = `
    background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%);
    color: white;
    border: none;
    padding: 10px 32px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 4px 12px rgba(46, 125, 50, 0.4);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;
  closeBtn.onmouseenter = () => {
    closeBtn.style.transform = 'translateY(-2px)';
    closeBtn.style.boxShadow = '0 6px 16px rgba(46, 125, 50, 0.5)';
  };
  closeBtn.onmouseleave = () => {
    closeBtn.style.transform = 'translateY(0)';
    closeBtn.style.boxShadow = '0 4px 12px rgba(46, 125, 50, 0.4)';
  };
  closeBtn.onclick = () => {
    hideWarningOverlay();
  };

  footer.appendChild(closeBtn);

  warningOverlay.appendChild(header);
  warningOverlay.appendChild(content);
  warningOverlay.appendChild(footer);
  warningBackdrop.appendChild(warningOverlay);
  document.body.appendChild(warningBackdrop);

  warningBackdrop.addEventListener('click', (event) => {
    if (event.target === warningBackdrop) {
      hideWarningOverlay();
    }
  });

  // Tambahkan animasi CSS jika belum ada
  if (!document.getElementById('exam-warning-styles')) {
    const style = document.createElement('style');
    style.id = 'exam-warning-styles';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
  }
}

function showInfoOverlay(data: NonNullable<InfoOverlayPayload['data']>) {
  hideInfoOverlay();

  const overlay = document.createElement('div');
  overlay.id = 'app-info-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    z-index: 2147483646;
    animation: fadeIn 0.25s ease-out;
  `;

  const panel = document.createElement('div');
  panel.id = 'app-info-panel';
  panel.style.cssText = `
    width: min(700px, 92vw);
    background: #f8fafc;
    border-radius: 24px;
    box-shadow: 0 30px 90px rgba(15, 23, 42, 0.45);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    animation: slideUp 0.25s ease-out;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%);
    color: #fff;
    text-align: center;
    padding: 36px 24px 32px 24px;
  `;

  const iconContainer = document.createElement('div');
  iconContainer.style.cssText = `
    width: 110px;
    height: 110px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.95);
    border: 3px solid rgba(255, 255, 255, 0.45);
    margin: 0 auto 18px auto;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.25);
  `;

  if (data.iconDataUrl) {
    const iconImg = document.createElement('img');
    iconImg.src = data.iconDataUrl;
    iconImg.alt = 'SIMAK Icon';
    iconImg.style.cssText = `
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: contain;
    `;
    iconContainer.appendChild(iconImg);
  } else {
    const iconFallback = document.createElement('div');
    iconFallback.textContent = 'ℹ️';
    iconFallback.style.cssText = `
      font-size: 48px;
    `;
    iconContainer.appendChild(iconFallback);
  }

  const title = document.createElement('h1');
  title.textContent = 'SIMAK Exam Browser';
  title.style.cssText = `
    margin: 0;
    font-size: 30px;
    font-weight: 700;
    letter-spacing: 0.5px;
  `;

  const subtitle = document.createElement('p');
  subtitle.textContent = 'Simak KHAS Kempek Cirebon';
  subtitle.style.cssText = `
    margin: 10px 0 0 0;
    font-size: 16px;
    color: rgba(255, 255, 255, 0.85);
    letter-spacing: 0.3px;
  `;

  header.appendChild(iconContainer);
  header.appendChild(title);
  header.appendChild(subtitle);

  const content = document.createElement('div');
  content.style.cssText = `
    padding: 32px;
    display: flex;
    flex-direction: column;
    gap: 28px;
    background: #fff;
  `;

  const versionSection = document.createElement('section');
  versionSection.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 16px;
  `;

  const versionTitle = document.createElement('h2');
  versionTitle.textContent = 'Informasi Versi';
  versionTitle.style.cssText = `
    margin: 0;
    font-size: 18px;
    color: #0f172a;
  `;

  const infoGrid = document.createElement('div');
  infoGrid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 18px;
  `;

  infoGrid.appendChild(createInfoGridItem('Versi Aplikasi', data.version));
  infoGrid.appendChild(createInfoGridItem('Nama Produk', data.productName));
  infoGrid.appendChild(createInfoGridItem('Platform', data.platform));
  infoGrid.appendChild(createInfoGridItem('Arsitektur', data.arch));

  versionSection.appendChild(versionTitle);
  versionSection.appendChild(infoGrid);

  const supportSection = document.createElement('section');
  supportSection.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 10px;
  `;

  const supportTitle = document.createElement('h2');
  supportTitle.textContent = 'Kontak & Dukungan';
  supportTitle.style.cssText = versionTitle.style.cssText;

  const supportText = document.createElement('p');
  supportText.textContent = 'Untuk bantuan atau pertanyaan, hubungi administrator sistem.';
  supportText.style.cssText = `
    margin: 0;
    font-size: 14px;
    color: #475569;
    line-height: 1.6;
  `;

  supportSection.appendChild(supportTitle);
  supportSection.appendChild(supportText);

  const footer = document.createElement('div');
  footer.style.cssText = `
    display: flex;
    justify-content: center;
    padding: 22px 32px 32px 32px;
    background: #fff;
  `;

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Tutup';
  closeBtn.style.cssText = `
    padding: 12px 36px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%);
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 15px 38px rgba(46, 125, 50, 0.4);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  `;
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.transform = 'translateY(-1px)';
    closeBtn.style.boxShadow = '0 18px 40px rgba(46, 125, 50, 0.45)';
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.transform = 'translateY(0)';
    closeBtn.style.boxShadow = '0 15px 38px rgba(46, 125, 50, 0.4)';
  });
  closeBtn.addEventListener('click', () => {
    ipcRenderer.send('info:close');
  });

  footer.appendChild(closeBtn);

  content.appendChild(versionSection);
  content.appendChild(supportSection);

  panel.appendChild(header);
  panel.appendChild(content);
  panel.appendChild(footer);

  overlay.appendChild(panel);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      ipcRenderer.send('info:close');
    }
  });

  const target = document.body || document.documentElement;
  target.appendChild(overlay);
  infoOverlayElement = overlay;
}

function hideInfoOverlay() {
  if (infoOverlayElement) {
    infoOverlayElement.remove();
    infoOverlayElement = null;
  }
}

function createInfoGridItem(label: string, value: string) {
  const item = document.createElement('div');
  item.style.cssText = `
    background: #f1f5f9;
    border-radius: 12px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border: 1px solid rgba(15, 23, 42, 0.06);
  `;

  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  labelEl.style.cssText = `
    font-size: 12px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  `;

  const valueEl = document.createElement('span');
  valueEl.textContent = value;
  valueEl.style.cssText = `
    font-size: 17px;
    color: #0f172a;
    font-weight: 600;
  `;

  item.appendChild(labelEl);
  item.appendChild(valueEl);
  return item;
}

// Network Info Overlay
let networkOverlay: HTMLDivElement | null = null;
let networkUpdateInterval: ReturnType<typeof setInterval> | null = null;
let isNetworkOverlayExpanded = true; // Default expanded

function createNetworkOverlay() {
  if (networkOverlay) return;

  networkOverlay = document.createElement('div');
  networkOverlay.id = 'network-info-overlay';
  networkOverlay.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(15, 23, 42, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 16px 20px;
    min-width: 300px;
    max-width: 350px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    z-index: 2147483645;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.1);
    animation: slideInRight 0.3s ease-out;
    transition: border-color 0.3s ease;
  `;

  const title = document.createElement('div');
  title.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
    color: #e2e8f0;
    cursor: pointer;
    user-select: none;
  `;
  
  const titleLeft = document.createElement('div');
  titleLeft.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  titleLeft.innerHTML = '<span style="font-size: 18px;">🌐</span> <span>Status Jaringan</span>';
  
  const toggleButton = document.createElement('div');
  toggleButton.id = 'network-toggle-btn';
  toggleButton.style.cssText = `
    font-size: 16px;
    color: #94a3b8;
    cursor: pointer;
    transition: transform 0.3s ease, color 0.2s ease;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  toggleButton.innerHTML = '▼'; // Down arrow = expanded
  toggleButton.title = 'Klik untuk menyembunyikan/menampilkan detail';
  
  // Toggle functionality
  const toggleOverlay = () => {
    isNetworkOverlayExpanded = !isNetworkOverlayExpanded;
    const content = document.getElementById('network-info-content');
    
    if (isNetworkOverlayExpanded) {
      // Show full content
      toggleButton.innerHTML = '▼';
      toggleButton.style.transform = 'rotate(0deg)';
      if (content) {
        // Pastikan content visible
        content.style.display = 'flex';
        content.style.visibility = 'visible';
        content.style.opacity = '1';
        
        // Jika ada lastNetworkInfo, render langsung
        if (lastNetworkInfo) {
          renderNetworkInfo(content, lastNetworkInfo, networkOverlay);
        } else {
          // Jika belum ada data, update
          updateNetworkInfo();
        }
      }
    } else {
      // Hide content, show only status
      toggleButton.innerHTML = '▶';
      toggleButton.style.transform = 'rotate(0deg)';
      if (content) {
        content.style.display = 'none';
        content.style.visibility = 'hidden';
      }
      // Update title dengan status indicator
      updateCollapsedStatus();
    }
  };
  
  toggleButton.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleOverlay();
  });
  
  titleLeft.addEventListener('click', toggleOverlay);
  
  title.appendChild(titleLeft);
  title.appendChild(toggleButton);
  networkOverlay.appendChild(title);

  const content = document.createElement('div');
  content.id = 'network-info-content';
  content.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 12px;
    transition: opacity 0.3s ease;
  `;
  // Tampilkan loading state saat pertama kali
  content.innerHTML = `
    <div style="color: #94a3b8; font-size: 11px; text-align: center; padding: 8px;">
      Memuat informasi jaringan...
    </div>
  `;
  networkOverlay.appendChild(content);
  
  // Store toggle function untuk digunakan nanti
  (networkOverlay as any).toggleOverlay = toggleOverlay;

  document.body.appendChild(networkOverlay);

  // Update network info setiap 3 detik (lebih responsif)
  // Delay sedikit untuk memastikan examLock sudah tersedia
  setTimeout(() => {
    updateNetworkInfo();
  }, 500);
  networkUpdateInterval = setInterval(updateNetworkInfo, 3000);
  
  // Listen to online/offline events
  window.addEventListener('online', () => {
    updateNetworkInfo();
  });
  
  window.addEventListener('offline', () => {
    updateNetworkInfo();
  });
}

// Counter untuk retry
let networkInfoRetryCount = 0;
const MAX_RETRY_COUNT = 10;
let lastNetworkInfo: any = null; // Store last network info untuk collapsed view

// Update collapsed status (hanya icon dan status)
function updateCollapsedStatus() {
  if (!networkOverlay) return;
  
  // Cari titleLeft element dengan berbagai cara
  let titleLeft: HTMLElement | null = null;
  
  // Coba cari dengan struktur yang benar
  const title = networkOverlay.firstElementChild as HTMLElement;
  if (title && title.firstElementChild) {
    titleLeft = title.firstElementChild as HTMLElement;
  }
  
  // Fallback: cari dengan querySelector
  if (!titleLeft) {
    titleLeft = networkOverlay.querySelector('div:first-child > div:first-child') as HTMLElement;
  }
  
  if (!titleLeft) return;
  
  // Jika belum ada data, tampilkan default
  if (!lastNetworkInfo) {
    titleLeft.innerHTML = '<span style="font-size: 18px;">🌐</span> <span>Status Jaringan</span>';
    return;
  }
  
  const networkStatusColor = lastNetworkInfo.status === 'online' ? '#4ade80' : '#f87171';
  const networkStatusIcon = lastNetworkInfo.status === 'online' ? '🟢' : '🔴';
  const networkStatusText = lastNetworkInfo.status === 'online' ? 'Online' : 'Offline';
  
  titleLeft.innerHTML = `
    <span style="font-size: 18px;">🌐</span> 
    <span>Status Jaringan</span>
    <span style="color: ${networkStatusColor}; font-weight: 600; margin-left: 8px; display: flex; align-items: center; gap: 4px;">
      ${networkStatusIcon} ${networkStatusText}
    </span>
  `;
}

// Helper function untuk render network info
function renderNetworkInfo(content: HTMLElement, info: any, networkOverlayElement?: HTMLDivElement | null) {
  if (!info) return;

  // Status koneksi jaringan
  const networkStatusColor = info.status === 'online' ? '#4ade80' : '#f87171';
  const networkStatusIcon = info.status === 'online' ? '🟢' : '🔴';
  const networkStatusText = info.status === 'online' ? 'Online' : 'Offline';

  // Status server
  const serverStatusColor = info.serverStatus === 'connected' ? '#4ade80' : info.serverStatus === 'checking' ? '#fbbf24' : '#f87171';
  const serverStatusIcon = info.serverStatus === 'connected' ? '🟢' : info.serverStatus === 'checking' ? '🟡' : '🔴';
  const serverStatusText = info.serverStatus === 'connected' ? 'Terhubung' : info.serverStatus === 'checking' ? 'Memeriksa...' : 'Terputus';

  // Update border color berdasarkan status
  if (networkOverlayElement) {
    if (info.serverStatus === 'disconnected' || info.status === 'offline') {
      networkOverlayElement.style.borderColor = 'rgba(248, 113, 113, 0.5)';
      networkOverlayElement.style.boxShadow = '0 8px 24px rgba(248, 113, 113, 0.3)';
    } else if (info.serverStatus === 'connected') {
      networkOverlayElement.style.borderColor = 'rgba(74, 222, 128, 0.5)';
      networkOverlayElement.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
    } else {
      networkOverlayElement.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      networkOverlayElement.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
    }
  }

  // Tampilkan error message jika ada (hanya pesan sederhana, tanpa detail teknis)
  const errorSection = info.errorMessage ? `
    <div style="margin-top: 8px; padding: 10px; background: rgba(248, 113, 113, 0.15); border-left: 3px solid #f87171; border-radius: 4px;">
      <div style="color: #f87171; font-size: 11px; font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
        <span>⚠️</span>
        <span>Gagal memuat jaringan</span>
      </div>
    </div>
  ` : '';

  // Warning jika IP tidak tersedia
  const ipWarning = info.ipAddress === 'Tidak tersedia' ? `
    <div style="margin-top: 8px; padding: 8px; background: rgba(251, 191, 36, 0.15); border-left: 3px solid #fbbf24; border-radius: 4px;">
      <div style="color: #fbbf24; font-size: 10px;">⚠️ Tidak ada koneksi jaringan aktif</div>
    </div>
  ` : '';

  // Tentukan keterangan status yang lebih jelas
  let statusDescription = '';
  if (info.status === 'online') {
    statusDescription = 'Ada IP valid dan bisa connect ke server';
  } else {
    // Offline: hanya tampilkan pesan sederhana tanpa detail error
    statusDescription = 'Gagal memuat jaringan';
  }

  content.innerHTML = `
    <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span style="color: #94a3b8; font-size: 11px; font-weight: 500;">Status Jaringan:</span>
        <span style="color: ${networkStatusColor}; font-weight: 600; font-size: 12px; display: flex; align-items: center; gap: 4px;">
          ${networkStatusIcon} ${networkStatusText}
        </span>
      </div>
      ${statusDescription ? `
      <div style="margin-top: 6px; padding: 8px; background: ${info.status === 'online' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)'}; border-left: 3px solid ${networkStatusColor}; border-radius: 4px;">
        <div style="color: ${info.status === 'online' ? '#86efac' : '#fca5a5'}; font-size: 10px; line-height: 1.5;">
          <strong style="color: ${networkStatusColor}; display: block; margin-bottom: 2px;">${info.status === 'online' ? 'Online:' : 'Offline:'}</strong>
          <span>${statusDescription}</span>
        </div>
      </div>
      ` : ''}
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <span style="color: #94a3b8; font-size: 11px; font-weight: 500;">Server:</span>
      <span style="color: ${serverStatusColor}; font-weight: 600; font-size: 12px; display: flex; align-items: center; gap: 4px;">
        ${serverStatusIcon} ${serverStatusText}
      </span>
    </div>
    ${info.latency ? `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <span style="color: #94a3b8; font-size: 11px;">Latency:</span>
      <span style="color: #e2e8f0; font-weight: 500; font-size: 11px;">${info.latency}ms</span>
    </div>
    ` : ''}
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <span style="color: #94a3b8; font-size: 11px;">IP Address:</span>
      <span style="color: ${info.ipAddress === 'Tidak tersedia' ? '#f87171' : '#e2e8f0'}; font-weight: 500; font-family: monospace; font-size: 10px;">${info.ipAddress}</span>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <span style="color: #94a3b8; font-size: 11px;">Interface:</span>
      <span style="color: ${info.interfaceName === 'N/A' ? '#f87171' : '#e2e8f0'}; font-weight: 500; font-size: 10px;">${info.interfaceName}</span>
    </div>
    ${ipWarning}
    ${errorSection}
    ${info.lastChecked ? `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
      <span style="color: #64748b; font-size: 10px;">Terakhir diperiksa:</span>
      <span style="color: #94a3b8; font-size: 10px; font-weight: 500;">${info.lastChecked}</span>
    </div>
    ` : ''}
  `;
}

function updateNetworkInfo() {
  if (!networkOverlay) return;

  const content = document.getElementById('network-info-content');
  if (!content) return;

  // Cek apakah examLock tersedia - coba beberapa cara
  let examLock = (window as any).examLock;
  
  // Jika tidak ditemukan, coba akses langsung dari global
  if (!examLock) {
    examLock = (globalThis as any).examLock;
  }
  
  if (!examLock || typeof examLock.getNetworkInfo !== 'function') {
    networkInfoRetryCount++;
    
    // Jika sudah retry terlalu banyak, coba langsung panggil IPC
    if (networkInfoRetryCount >= MAX_RETRY_COUNT) {
      // Coba langsung panggil IPC sebagai fallback
      try {
        ipcRenderer.invoke('network:get-info').then((info: any) => {
          if (info && content) {
            // Store last info
            lastNetworkInfo = info;
            
            // Selalu update collapsed status di title
            updateCollapsedStatus();
            
            // Render full info jika expanded
            if (isNetworkOverlayExpanded) {
              renderNetworkInfo(content, info, networkOverlay);
            }
          }
        }).catch((error: any) => {
          if (content) {
            content.innerHTML = `
              <div style="color: #f87171; font-size: 11px; text-align: center; padding: 8px; margin-bottom: 8px;">
                ⚠️ Gagal memuat informasi jaringan
              </div>
            `;
          }
        });
        return;
      } catch (e) {
        // IPC juga tidak tersedia
        if (content) {
          content.innerHTML = `
            <div style="color: #f87171; font-size: 11px; text-align: center; padding: 8px; margin-bottom: 8px;">
              ⚠️ Gagal memuat informasi jaringan
            </div>
          `;
        }
        return;
      }
    }
    
    // Retry setelah 500ms jika belum tersedia
    setTimeout(() => {
      updateNetworkInfo();
    }, 500);
    
    // Tampilkan loading state dengan counter
    const currentContent = content.innerHTML;
    if (!currentContent.includes('Menunggu') && !currentContent.includes('Gagal')) {
      content.innerHTML = `
        <div style="color: #fbbf24; font-size: 11px; text-align: center; padding: 8px;">
          ⏳ Menunggu Jaringan siap... (${networkInfoRetryCount}/${MAX_RETRY_COUNT})
        </div>
      `;
    } else if (currentContent.includes('Menunggu')) {
      // Update counter jika sudah ada pesan menunggu
      content.innerHTML = `
        <div style="color: #fbbf24; font-size: 11px; text-align: center; padding: 8px;">
          ⏳ Menunggu Jaringan siap... (${networkInfoRetryCount}/${MAX_RETRY_COUNT})
        </div>
      `;
    }
    return;
  }

  // Reset counter jika berhasil
  networkInfoRetryCount = 0;

  examLock.getNetworkInfo().then((info: any) => {
    if (!info) return;
    
    // Store last info untuk collapsed view dan expanded view
    lastNetworkInfo = info;
    
    // Selalu update collapsed status di title (untuk collapsed mode)
    updateCollapsedStatus();
    
    // Render full info jika expanded
    if (isNetworkOverlayExpanded) {
      renderNetworkInfo(content, info, networkOverlay);
    }
  }).catch((error: any) => {
    console.error('Failed to get network info:', error);
    // Update border untuk error state
    if (networkOverlay) {
      networkOverlay.style.borderColor = 'rgba(248, 113, 113, 0.5)';
      networkOverlay.style.boxShadow = '0 8px 24px rgba(248, 113, 113, 0.3)';
    }
    if (content) {
      const now = new Date().toLocaleTimeString('id-ID');
      content.innerHTML = `
        <div style="color: #f87171; font-size: 12px; margin-bottom: 8px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
          <span>⚠️</span>
          <span>Gagal memuat informasi jaringan</span>
        </div>
        <div style="color: #64748b; font-size: 10px; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
          Terakhir diperiksa: ${now}
        </div>
      `;
    }
  });
}

// Initialize network overlay when DOM is ready
// Tunggu sampai preload script benar-benar selesai dan examLock tersedia
function initializeNetworkOverlay() {
  // examLock seharusnya sudah tersedia karena ini preload script
  // Tapi kita tetap cek untuk memastikan
  const checkAndCreate = () => {
    if ((window as any).examLock && typeof (window as any).examLock.getNetworkInfo === 'function') {
      createNetworkOverlay();
      return true;
    }
    return false;
  };

  // Coba langsung
  if (checkAndCreate()) {
    return;
  }

  // Jika belum tersedia, tunggu window load
  if (document.readyState === 'complete') {
    // Window sudah loaded, coba lagi
    setTimeout(() => {
      if (!checkAndCreate()) {
        // Jika masih belum, buat overlay anyway (akan retry di updateNetworkInfo)
        createNetworkOverlay();
      }
    }, 100);
  } else {
    // Tunggu window load
    window.addEventListener('load', () => {
      setTimeout(() => {
        if (!checkAndCreate()) {
          createNetworkOverlay();
        }
      }, 100);
    });
  }
}

if (document.body) {
  initializeNetworkOverlay();
} else {
  window.addEventListener('DOMContentLoaded', () => {
    initializeNetworkOverlay();
  });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (networkUpdateInterval) {
    clearInterval(networkUpdateInterval);
    networkUpdateInterval = null;
  }
  if (networkOverlay) {
    networkOverlay.remove();
    networkOverlay = null;
  }
  hideInfoOverlay();
});

// Add animation styles
if (!document.getElementById('network-overlay-styles')) {
  const style = document.createElement('style');
  style.id = 'network-overlay-styles';
  style.textContent = `
    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
  `;
  document.head.appendChild(style);
}

