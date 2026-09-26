import type { SoundRecord } from '../types';

const DB_NAME = 'field-audio';
const STORE = 'sounds';

function openDb(name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function tx<T>(name: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb(name);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    // A request success is not a durable transaction commit (quota/abort may follow).
    let result: T;
    request.onsuccess = () => {result=request.result;};
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => {db.close();resolve(result);};
    transaction.onabort = () => {db.close();reject(transaction.error || new Error('Storage transaction aborted.'));};
    transaction.onerror = () => reject(transaction.error);
  });
}

export function createSoundRepository(name = DB_NAME) {
  return {
    save: (sound: SoundRecord) => tx(name, 'readwrite', store => store.put(sound)),
    getAll: () => tx<SoundRecord[]>(name, 'readonly', store => store.getAll()),
    remove: (id: string) => tx(name, 'readwrite', store => store.delete(id)),
    clear: () => tx(name, 'readwrite', store => store.clear())
  };
}
export const soundsDb = createSoundRepository();
