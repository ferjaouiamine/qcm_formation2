import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
let local: Promise<PGlite> | undefined;
async function localDb() {
  if (process.env.VERCEL)
    throw new Error("Le mode local est interdit sur Vercel");
  local ??= import("@electric-sql/pglite").then(({ PGlite }) => {
    const path = process.env.LOCAL_DATABASE_PATH || ".local-data/postgres";
    if (path !== "memory://") mkdirSync(dirname(path), { recursive: true });
    return new PGlite(path);
  });
  return local;
}
export async function closeLocalDb() {
  if (local) {
    await (await local).close();
    local = undefined;
  }
}
export function db(): NeonQueryFunction<false, false> {
  if (process.env.DATABASE_MODE !== "local") {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
    return neon(process.env.DATABASE_URL);
  }
  const query = (text: string, params: unknown[] = []) => ({
    text,
    params,
    then(
      resolve: (rows: unknown[]) => unknown,
      reject: (e: unknown) => unknown,
    ) {
      return localDb()
        .then((client) => client.query(text, params))
        .then((r) => resolve(r.rows), reject);
    },
  });
  const tag = Object.assign(
    (strings: TemplateStringsArray, ...params: unknown[]) =>
      query(
        strings.reduce((text, part, i) => text + (i ? `$${i}` : "") + part, ""),
        params,
      ),
    {
      query,
      transaction: async (queries: ReturnType<typeof query>[]) =>
        (await localDb()).transaction(async (tx) => {
          const results = [];
          for (const q of queries)
            results.push((await tx.query(q.text, q.params)).rows);
          return results;
        }),
    },
  );
  return tag as unknown as NeonQueryFunction<false, false>;
}
