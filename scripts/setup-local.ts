import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env"))
  throw new Error(".env existe déjà : configuration conservée.");
writeFileSync(
  ".env",
  `DATABASE_MODE=local\nLOCAL_DATABASE_PATH=.local-data/postgres\nJWT_SECRET=${randomBytes(48).toString("hex")}\nADMIN_EMAIL=admin@formation.local\nADMIN_PASSWORD=${randomBytes(18).toString("base64url")}\n`,
  { mode: 0o600 },
);
console.log(
  "Configuration locale créée. Identifiants administrateur disponibles dans .env.",
);
