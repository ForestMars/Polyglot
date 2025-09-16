// src/utils/debugUtils.ts - Utilities for debugging IndexedDB issues

export class DatabaseDebugger {
  
    // List all IndexedDB databases
    static async listDatabases(): Promise<string[]> {
      try {
        if ('databases' in indexedDB) {
          const databases = await indexedDB.databases();
          return databases.map(db => db.name || 'unnamed');
        }
        return ['Feature not supported'];
      } catch (error) {
        console.error('Failed to list databases:', error);
        return [];
      }
    }
  
    // Delete all app databases (for debugging)
    static async clearAllDatabases(): Promise<void> {
      const dbNames = ['PolyglotDB', 'polyglot-chat-db', 'chat-storage']; // Add any other possible names
      
      for (const dbName of dbNames) {
        try {
          const deleteReq = indexedDB.deleteDatabase(dbName);
          await new Promise<void>((resolve, reject) => {
            deleteReq.onsuccess = () => {
              console.log(`Deleted database: ${dbName}`);
              resolve();
            };
            deleteReq.onerror = () => reject(deleteReq.error);
            deleteReq.onblocked = () => {
              console.warn(`Database deletion blocked: ${dbName}`);
              resolve(); // Don't fail on blocked
            };
          });
        } catch (error) {
          console.log(`Database ${dbName} doesn't exist or couldn't be deleted:`, error);
        }
      }
      
      console.log('Database cleanup complete. Please refresh the page.');
    }
  
    // Check IndexedDB support and quota
    static async checkIndexedDBStatus(): Promise<{
      supported: boolean;
      quota?: number;
      usage?: number;
      persistent?: boolean;
    }> {
      const result = { supported: false };
      
      try {
        if (!('indexedDB' in window)) {
          return result;
        }
        
        result.supported = true;
        
        // Check storage quota
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate();
          result.quota = estimate.quota;
          result.usage = estimate.usage;
        }
        
        // Check if storage is persistent
        if ('storage' in navigator && 'persisted' in navigator.storage) {
          result.persistent = await navigator.storage.persisted();
        }
        
      } catch (error) {
        console.error('Failed to check IndexedDB status:', error);
      }
      
      return result;
    }
  
    // Inspect database schema
    static async inspectDatabase(dbName: string): Promise<any> {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);
        
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          const info = {
            name: db.name,
            version: db.version,
            objectStores: Array.from(db.objectStoreNames).map(name => {
              const transaction = db.transaction([name], 'readonly');
              const store = transaction.objectStore(name);
              
              return {
                name: store.name,
                keyPath: store.keyPath,
                autoIncrement: store.autoIncrement,
                indexNames: Array.from(store.indexNames)
              };
            })
          };
          
          db.close();
          resolve(info);
        };
        
        request.onerror = () => reject(request.error);
      });
    }
  }
  
  // Global debug functions (attach to window for console use)
  if (typeof window !== 'undefined') {
    (window as any).debugDB = {
      listDatabases: DatabaseDebugger.listDatabases,
      clearAll: DatabaseDebugger.clearAllDatabases,
      checkStatus: DatabaseDebugger.checkIndexedDBStatus,
      inspect: DatabaseDebugger.inspectDatabase,
      
      // Quick commands
      async reset() {
        console.log('Resetting all databases...');
        await this.clearAll();
        window.location.reload();
      },
      
      async status() {
        const status = await this.checkStatus();
        console.log('IndexedDB Status:', status);
        
        const databases = await this.listDatabases();
        console.log('Available databases:', databases);
        
        return { status, databases };
      }
    };
    
    console.log('🔧 Debug utilities loaded. Use window.debugDB.status() or window.debugDB.reset()');
  }