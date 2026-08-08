/**
 * Minimal IndexedDB hand-off used by the Web Share Target flow: the service
 * worker (`src/sw.ts`) stores the shared image blob here, then redirects the
 * browser to `/share-target?receiptId=...` where `ShareTargetPage` reads it
 * back. Kept dependency-free (no idb-keyval) since both call sites — a
 * service worker and a regular page — need to share the exact same code.
 */

const DB_NAME = "sheet-budget-receipts";
const STORE_NAME = "receipts";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Stores the shared image blob under `id`. Called from the service worker. */
export async function putReceipt(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Reads and deletes the blob stored under `id`. Called from `ShareTargetPage`. */
export async function takeReceipt(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);
    getRequest.onsuccess = () => resolve(getRequest.result as Blob | undefined);
    getRequest.onerror = () => reject(getRequest.error);
    store.delete(id);
  });
  db.close();
  return blob;
}
