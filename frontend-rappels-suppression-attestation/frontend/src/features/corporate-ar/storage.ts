import { CorporateClient } from "./types";
import { codeNumber, formatCode } from "./keys";

/**
 * Corporate AR persistence. IndexedDB (not localStorage) because the attached
 * invoices (PDF / images) are binary and can be far bigger than localStorage's ~5 MB.
 *
 * Two stores: `clients` (keyPath = code) and `meta` (holds the key counter).
 */
const DB_NAME = "at-recouvrement-corporate-ar";
const STORE = "clients";
const META = "meta";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "code" });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Runs `work` in one transaction; `work` returns a getter evaluated once the transaction has committed. */
async function withTx<T>(stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => () => T): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    const result = work(tx);
    tx.oncomplete = () => {
      db.close();
      resolve(result());
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export const loadClients = () =>
  withTx<CorporateClient[]>([STORE], "readonly", (tx) => {
    const r = tx.objectStore(STORE).getAll();
    return () => r.result as CorporateClient[];
  });

export const saveClients = (list: CorporateClient[]) =>
  withTx<void>([STORE], "readwrite", (tx) => {
    const s = tx.objectStore(STORE);
    for (const c of list) s.put(c);
    return () => undefined;
  });

export const deleteClient = (code: string) =>
  withTx<void>([STORE], "readwrite", (tx) => {
    tx.objectStore(STORE).delete(code);
    return () => undefined;
  });

/**
 * Reserves `count` new keys atomically. The counter only ever goes up (a deleted
 * client's code is never given to someone else) and always stays above any
 * CAR-xxxxxx code already present, e.g. one that arrived through an import.
 */
export const allocateCodes = (count: number) =>
  withTx<string[]>([STORE, META], "readwrite", (tx) => {
    const codes: string[] = [];
    if (count <= 0) return () => codes;
    const keysReq = tx.objectStore(STORE).getAllKeys();
    const ctrReq = tx.objectStore(META).get("counter");
    ctrReq.onsuccess = () => {
      const maxExisting = (keysReq.result as IDBValidKey[]).reduce<number>((m, k) => Math.max(m, codeNumber(String(k))), 0);
      const start = Math.max(Number(ctrReq.result) || 0, maxExisting) + 1;
      for (let i = 0; i < count; i++) codes.push(formatCode(start + i));
      tx.objectStore(META).put(start + count - 1, "counter");
    };
    return () => codes;
  });
