"use client";

const DB_NAME = "evacurosa-offline";
const DB_VERSION = 2;
const STORE = "cache";

interface CacheRecord {
  id: string;
  data: unknown;
  cachedAt: string;
}

function isIndexedDbAvailable(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      } else {
        // Version 2 removes data cached by the former runtime fixtures.
        request.transaction?.objectStore(STORE).clear();
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** A single flat key-value store, not one object store per data type — far
 * fewer moving parts than a fully normalized IndexedDB schema, which
 * matters a lot here specifically because none of this can be
 * runtime-tested outside a real browser before shipping. */
export async function idbSet(key: string, data: unknown): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const record: CacheRecord = { id: key, data, cachedAt: new Date().toISOString() };
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbGet<T>(
  key: string
): Promise<{ data: T; cachedAt: string } | null> {
  if (!isIndexedDbAvailable()) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(key);
    request.onsuccess = () => {
      const record = request.result as CacheRecord | undefined;
      resolve(record ? { data: record.data as T, cachedAt: record.cachedAt } : null);
    };
    request.onerror = () => reject(request.error);
  });
}
