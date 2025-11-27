import { networkInterfaces } from 'os';
import fetch from 'node-fetch';
import { appConfig } from '../config';

export interface NetworkInfo {
  status: 'online' | 'offline';
  ipAddress: string;
  interfaceName: string;
  serverStatus: 'connected' | 'disconnected' | 'checking';
  latency?: number;
  lastChecked?: string;
  errorMessage?: string;
}

export async function getNetworkInfo(): Promise<NetworkInfo> {
  const interfaces = networkInterfaces();
  let ipAddress = 'Tidak tersedia';
  let interfaceName = 'N/A';

  // Cari IP address yang aktif (bukan loopback)
  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name];
    if (!nets) continue;

    for (const net of nets) {
      // Skip internal (i.e. 127.0.0.1) dan non-IPv4
      if (net.family === 'IPv4' && !net.internal) {
        ipAddress = net.address;
        interfaceName = name;
        break;
      }
    }
    if (ipAddress !== 'Tidak tersedia') break;
  }

  // Cek status server dan latency
  let serverStatus: 'connected' | 'disconnected' | 'checking' = 'checking';
  let latency: number | undefined;
  let errorMessage: string | undefined;
  let isNetworkActuallyOnline = false;

  try {
    const startTime = Date.now();
    const response = await fetch(appConfig.examUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000) // 3 detik timeout
    });
    const endTime = Date.now();
    
    if (response.ok) {
      serverStatus = 'connected';
      latency = endTime - startTime;
      isNetworkActuallyOnline = true;
    } else {
      serverStatus = 'disconnected';
      errorMessage = `HTTP ${response.status}`;
    }
  } catch (error: any) {
    serverStatus = 'disconnected';
    
    // Deteksi jenis error untuk menentukan apakah benar-benar offline
    if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
      // DNS tidak bisa resolve = tidak ada koneksi internet
      errorMessage = 'Tidak ada koneksi internet';
      isNetworkActuallyOnline = false;
    } else if (error.code === 'ECONNREFUSED') {
      // Connection refused = server tidak bisa dijangkau (mungkin firewall/offline)
      errorMessage = 'Server tidak dapat dijangkau';
      isNetworkActuallyOnline = false;
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH') {
      // Network unreachable = tidak ada koneksi
      errorMessage = 'Jaringan tidak dapat dijangkau';
      isNetworkActuallyOnline = false;
    } else if (error.name === 'AbortError') {
      // Timeout bisa berarti offline atau server lambat
      errorMessage = 'Timeout - Server tidak merespons';
      // Jika tidak ada IP, kemungkinan offline
      isNetworkActuallyOnline = ipAddress !== 'Tidak tersedia';
    } else if (error.message) {
      errorMessage = error.message;
      // Default: anggap offline jika ada error
      isNetworkActuallyOnline = false;
    } else {
      errorMessage = 'Koneksi gagal';
      isNetworkActuallyOnline = false;
    }
  }

  // Cek status online: 
  // 1. Harus ada IP address YANG VALID (bukan loopback)
  // 2. DAN harus bisa connect ke server (atau setidaknya ada IP yang valid)
  // Jika server disconnected dengan error ENOTFOUND/ENETUNREACH, pasti offline
  const hasValidIP = ipAddress !== 'Tidak tersedia' && 
                     ipAddress !== '127.0.0.1' && 
                     !ipAddress.startsWith('169.254'); // Link-local address (tidak ada DHCP)
  
  const status: 'online' | 'offline' = hasValidIP && isNetworkActuallyOnline ? 'online' : 'offline';
  
  // Jika status offline tapi masih ada IP, kemungkinan IP dari cache atau interface tidak aktif
  if (status === 'offline' && ipAddress !== 'Tidak tersedia') {
    // Update IP menjadi "Tidak tersedia" jika memang tidak ada koneksi
    if (!isNetworkActuallyOnline && (errorMessage?.includes('Tidak ada koneksi') || 
                                     errorMessage?.includes('tidak dapat dijangkau'))) {
      ipAddress = 'Tidak tersedia';
      interfaceName = 'N/A';
    }
  }

  return {
    status,
    ipAddress,
    interfaceName,
    serverStatus,
    latency,
    lastChecked: new Date().toLocaleTimeString('id-ID'),
    errorMessage
  };
}

