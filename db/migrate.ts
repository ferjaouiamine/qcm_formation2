import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { db, closeLocalDb } from "../server/_lib/db.js";

const sql = db();

await sql`
  create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )
`;

const appliedRows = await sql`select name from schema_migrations`;
const applied = new Set(appliedRows.map((row) => String(row.name)));
const directory = join(process.cwd(), "db/migrations");
const files = (await readdir(directory))
  .filter((name) => name.endsWith(".sql"))
  .sort();

for (const name of files) {
  if (applied.has(name)) continue;

  const source = await readFile(join(directory, name), "utf8");
  const statements = source
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  await sql.transaction([
    ...statements.map((statement) => sql.query(statement)),
    sql`insert into schema_migrations (name) values (${name})`,
  ]);

  console.log(`Migration appliquée : ${name}`);
}

console.log("Base de données à jour.");

await closeLocalDb();
