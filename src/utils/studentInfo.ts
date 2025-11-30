import { BrowserWindow } from 'electron';
import { logger } from '../logger';

export interface StudentInfo {
  id?: string | number;
  name?: string;
  namaLengkap?: string; // Nama lengkap dari localStorage
  [key: string]: any; // Untuk field tambahan dari localStorage
}

// Cache untuk student info (untuk fallback jika window tidak tersedia)
let cachedStudentInfo: StudentInfo | null = null;
let lastCheckTime: number = 0;
const CHECK_COOLDOWN = 5000; // 5 seconds cooldown between checks

/**
 * Read student info from Vue app's localStorage
 * Key: 'siswa'
 * Expected structure: {"data": {"id": 4562, "namaLengkap": "..."}, "expiration": ...}
 * Will cache the result for fallback use
 */
export async function getStudentInfoFromStorage(window: BrowserWindow, forceCheck: boolean = false): Promise<StudentInfo | null> {
  try {
    // Rate limiting: don't check too frequently if we already have cached data
    const now = Date.now();
    if (!forceCheck && cachedStudentInfo && (now - lastCheckTime) < CHECK_COOLDOWN) {
      logger.debug('Using cached student info (within cooldown period)');
      return cachedStudentInfo;
    }
    lastCheckTime = now;
    
    const rawData = await window.webContents.executeJavaScript(`
      (function() {
        try {
          const siswaData = localStorage.getItem('siswa');
          if (siswaData) {
            const parsed = JSON.parse(siswaData);
            return {
              raw: parsed,
              hasData: !!parsed.data,
              hasId: !!(parsed.data && parsed.data.id),
              hasNamaLengkap: !!(parsed.data && parsed.data.namaLengkap),
              dataStructure: parsed
            };
          }
          return { raw: null, hasData: false, hasId: false, hasNamaLengkap: false, dataStructure: null };
        } catch (e) {
          return { raw: null, hasData: false, hasId: false, hasNamaLengkap: false, error: e.message, dataStructure: null };
        }
      })();
    `);
    
    // Log untuk debugging (only if no cached data or force check)
    if (!rawData || !rawData.hasData) {
      // If localStorage is empty, student might have logged out
      // BUT: Don't clear cache! We need cached data for report even after logout
      // The cache represents the student who was logged in during the session
      if (forceCheck && !cachedStudentInfo) {
        logger.debug('No student info found in localStorage', {
          hasRawData: !!rawData,
          hasData: rawData?.hasData,
          error: rawData?.error
        });
      } else if (cachedStudentInfo) {
        logger.debug('Student info removed from localStorage (logout detected), but keeping cache for report', {
          cachedStudentId: cachedStudentInfo.id,
          cachedStudentName: cachedStudentInfo.name
        });
      }
      // Return cached data if available (for report), or null if never cached
      return cachedStudentInfo;
    }
    
    if (!rawData.hasId || !rawData.hasNamaLengkap) {
      // If localStorage data is incomplete, don't update cache
      // But keep existing cache if available (for report)
      if (forceCheck) {
        logger.debug('Student info found but incomplete, keeping existing cache if available', {
          hasId: rawData.hasId,
          hasNamaLengkap: rawData.hasNamaLengkap,
          hasCachedData: !!cachedStudentInfo,
          dataKeys: rawData.dataStructure?.data ? Object.keys(rawData.dataStructure.data) : null
        });
      }
      // Return cached data if available, or null if never cached
      return cachedStudentInfo;
    }
    
    // Extract only id and namaLengkap from data object
    const studentInfo: StudentInfo = {
      id: rawData.dataStructure.data.id,
      name: rawData.dataStructure.data.namaLengkap,
      namaLengkap: rawData.dataStructure.data.namaLengkap
    };
    
    // Cache student info for fallback use
    const wasCached = !!cachedStudentInfo;
    cachedStudentInfo = studentInfo;
    
    if (!wasCached) {
      logger.info('Student info retrieved from localStorage', { 
        studentId: studentInfo.id, 
        studentName: studentInfo.name 
      });
    } else {
      logger.debug('Student info updated from localStorage', { 
        studentId: studentInfo.id, 
        studentName: studentInfo.name 
      });
    }
    return studentInfo;
  } catch (error) {
    logger.error('Failed to read student info from localStorage', error);
    // Only return cached if error is not related to window being destroyed
    // If window is destroyed, we might still need cached data for report
    if (cachedStudentInfo) {
      logger.debug('Returning cached student info due to error reading localStorage');
      return cachedStudentInfo;
    }
    return null;
  }
}

/**
 * Get cached student info (fallback when window is not available)
 */
export function getCachedStudentInfo(): StudentInfo | null {
  return cachedStudentInfo;
}

/**
 * Clear cached student info
 */
export function clearCachedStudentInfo(): void {
  cachedStudentInfo = null;
}

/**
 * Check if student is logged in (has 'siswa' in localStorage)
 */
export async function isStudentLoggedIn(window: BrowserWindow): Promise<boolean> {
  try {
    const hasSiswa = await window.webContents.executeJavaScript(`
      (function() {
        return localStorage.getItem('siswa') !== null;
      })();
    `);
    return hasSiswa === true;
  } catch (error) {
    logger.error('Failed to check student login status', error);
    return false;
  }
}

