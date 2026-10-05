import { createHash } from "node:crypto";
import { db } from "./db.js";
export async function allowLogin(email: string, ip: string) {
  const sql = db();
  const keys = [
    ["email:" + email.toLowerCase(), 10],
    ["ip:" + ip, 100],
  ] as const;
  for (const [value, limit] of keys) {
    const key = createHash("sha256").update(value).digest("hex");
    const [row] =
      await sql`insert into login_limits(key,window_start,hits) values(${key},now(),1)
      on conflict(key) do update set hits=case when login_limits.window_start<now()-interval '15 minutes' then 1 else login_limits.hits+1 end,
      window_start=case when login_limits.window_start<now()-interval '15 minutes' then now() else login_limits.window_start end returning hits`;
    if (Number(row.hits) > limit) return false;
  }
  return true;
}
