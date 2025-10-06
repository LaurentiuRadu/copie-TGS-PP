// Custom storage pentru iOS PWA - folosește IndexedDB ca fallback pentru localStorage
const DB_NAME = 'timetrack_storage';
const STORE_NAME = 'auth_storage';

class IOSStorage {
  private db: IDBDatabase | null = null;
  private useLocalStorage = true;

  async init() {
    // Verifică dacă este iOS PWA
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = (window.navigator as any).standalone === true || 
                         window.matchMedia('(display-mode: standalone)').matches;

    if (isIOS && isStandalone) {
      // Folosește IndexedDB pentru iOS PWA
      this.useLocalStorage = false;
      await this.openDB();
    }
  }

  private openDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onerror = () => {
        console.error('IndexedDB error, falling back to localStorage');
        this.useLocalStorage = true;
        resolve();
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });
  }

  async getItem(key: string): Promise<string | null> {
    if (this.useLocalStorage) {
      return localStorage.getItem(key);
    }

    if (!this.db) await this.init();
    if (!this.db) return localStorage.getItem(key);

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        resolve(localStorage.getItem(key));
      };
    });
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.useLocalStorage) {
      localStorage.setItem(key, value);
      return;
    }

    if (!this.db) await this.init();
    if (!this.db) {
      localStorage.setItem(key, value);
      return;
    }

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);

      request.onsuccess = () => {
        // Backup în localStorage
        try {
          localStorage.setItem(key, value);
        } catch (e) {
          // Ignoră eroarea
        }
        resolve();
      };

      request.onerror = () => {
        localStorage.setItem(key, value);
        resolve();
      };
    });
  }

  async removeItem(key: string): Promise<void> {
    if (this.useLocalStorage) {
      localStorage.removeItem(key);
      return;
    }

    if (!this.db) await this.init();
    if (!this.db) {
      localStorage.removeItem(key);
      return;
    }

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => {
        localStorage.removeItem(key);
        resolve();
      };

      request.onerror = () => {
        localStorage.removeItem(key);
        resolve();
      };
    });
  }
}

export const iosStorage = new IOSStorage();
