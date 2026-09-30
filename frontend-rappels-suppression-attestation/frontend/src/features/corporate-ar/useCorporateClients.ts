import { useCallback, useEffect, useState } from "react";
import { CorporateClient, CorporateInput } from "./types";
import { ImportedRow } from "./csvMapping";
import { allocateCodes, deleteClient, loadClients, saveClients } from "./storage";

const byName = (a: CorporateClient, b: CorporateClient) => a.name.localeCompare(b.name, "fr");

export interface ImportSummary {
  added: number;
  updated: number;
  /** Rows that came without a key and received an automatic one. */
  generated: number;
}

export function useCorporateClients() {
  const [clients, setClients] = useState<CorporateClient[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadClients()
      .then((rows) => setClients(rows.sort(byName)))
      .catch(() => setError("Impossible de lire les données enregistrées (stockage du navigateur indisponible)."))
      .finally(() => setLoaded(true));
  }, []);

  const merge = useCallback((list: CorporateClient[]) => {
    setClients((prev) => {
      const m = new Map(prev.map((c) => [c.code, c]));
      for (const c of list) m.set(c.code, c);
      return [...m.values()].sort(byName);
    });
  }, []);

  /** Creates a client; its key is generated here. */
  const create = useCallback(
    async (data: CorporateInput): Promise<CorporateClient> => {
      const [code] = await allocateCodes(1);
      const c: CorporateClient = { ...data, code };
      await saveClients([c]);
      merge([c]);
      return c;
    },
    [merge],
  );

  const update = useCallback(
    async (c: CorporateClient) => {
      await saveClients([c]);
      merge([c]);
    },
    [merge],
  );

  const remove = useCallback(async (code: string) => {
    await deleteClient(code);
    setClients((prev) => prev.filter((c) => c.code !== code));
  }, []);

  /**
   * Imports rows: each row without a key gets its own generated key; a row whose
   * key already exists updates that client (its attached invoices are kept).
   */
  const importRows = useCallback(
    async (rows: ImportedRow[]): Promise<ImportSummary> => {
      const existing = new Map(clients.map((c) => [c.code, c]));
      const strip = ({ code: _c, ...data }: ImportedRow): CorporateInput => {
        void _c;
        return data;
      };

      // 1) rows that carry their own key (the same key twice in a file: the last one wins)
      const keyed = new Map<string, CorporateClient>();
      let added = 0;
      let updated = 0;
      for (const r of rows) {
        if (!r.code) continue;
        const prev = existing.get(r.code);
        if (!keyed.has(r.code)) {
          if (prev) updated++;
          else added++;
        }
        keyed.set(r.code, { ...strip(r), code: r.code, files: prev ? prev.files : [] });
      }
      const keyedList = [...keyed.values()];
      await saveClients(keyedList);

      // 2) rows without a key: one new key each. Done after step 1 so a generated
      //    key can never collide with a key that came in the same file.
      const keyless = rows.filter((r) => !r.code);
      const fresh = await allocateCodes(keyless.length);
      const generatedList = keyless.map((r, i): CorporateClient => ({ ...strip(r), code: fresh[i], files: [] }));
      await saveClients(generatedList);

      merge([...keyedList, ...generatedList]);
      return { added: added + keyless.length, updated, generated: keyless.length };
    },
    [clients, merge],
  );

  return { clients, loaded, error, create, update, remove, importRows };
}

export type CorporateStore = ReturnType<typeof useCorporateClients>;
