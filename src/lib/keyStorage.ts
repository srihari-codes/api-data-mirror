// Secure browser-based key storage
// Keys are stored in IndexedDB for persistence

const DB_NAME = 'vortex-keys';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

interface StoredKeys {
  encryptionPublicKey: string;
  encryptionPrivateKey: string;
  signingPublicKey: string;
  signingPrivateKey: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function storeKeys(keys: StoredKeys): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    store.put(keys.encryptionPublicKey, 'encryptionPublicKey');
    store.put(keys.encryptionPrivateKey, 'encryptionPrivateKey');
    store.put(keys.signingPublicKey, 'signingPublicKey');
    store.put(keys.signingPrivateKey, 'signingPrivateKey');
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getKeys(): Promise<StoredKeys | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const keys: Partial<StoredKeys> = {};
    
    const encPubRequest = store.get('encryptionPublicKey');
    const encPrivRequest = store.get('encryptionPrivateKey');
    const sigPubRequest = store.get('signingPublicKey');
    const sigPrivRequest = store.get('signingPrivateKey');
    
    transaction.oncomplete = () => {
      if (encPubRequest.result && encPrivRequest.result && sigPubRequest.result && sigPrivRequest.result) {
        resolve({
          encryptionPublicKey: encPubRequest.result,
          encryptionPrivateKey: encPrivRequest.result,
          signingPublicKey: sigPubRequest.result,
          signingPrivateKey: sigPrivRequest.result,
        });
      } else {
        resolve(null);
      }
    };
    
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearKeys(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function hasKeys(): Promise<boolean> {
  const keys = await getKeys();
  return keys !== null;
}
