import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.DATABASE_MODE = "local";
process.env.LOCAL_DATABASE_PATH = join(
  mkdtempSync(join(tmpdir(), "assurance-vie-e2e-")),
  "postgres",
);
process.env.ADMIN_EMAIL = "e2e@example.test";
process.env.ADMIN_PASSWORD = "test-browser-password-123";
process.env.JWT_SECRET =
  "browser-test-only-secret-with-at-least-thirty-two-characters";
await import("../db/migrate");
const { seed } = await import("../db/seed");
await seed();
const { closeLocalDb } = await import("../server/_lib/db");
await closeLocalDb();
const { createServer } = await import("vite");
const server = await createServer({
  server: { host: "127.0.0.1", port: 4173, strictPort: true },
});
await server.listen();
server.printUrls();
