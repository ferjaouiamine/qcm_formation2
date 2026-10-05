import bcrypt from "bcryptjs";
import { allowLogin } from "../_lib/login-limit.js";
import { z } from "zod";
import { db } from "../_lib/db.js";
import { requireAdmin, signAdmin } from "../_lib/auth.js";
import { error, safe } from "../_lib/http.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default safe(async (req: VercelRequest, res: VercelResponse) => {
  const action = z.enum(["login", "logout", "me"]).parse(req.query.action);

  if (action === "login") {
    if (req.method !== "POST") return error(res, 405, "Méthode non autorisée");
    const body = z
      .object({ email: z.email(), password: z.string().min(8).max(200) })
      .parse(req.body);
    const ip = String(
      req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "local",
    )
      .split(",")[0]
      .trim();
    if (!(await allowLogin(body.email, ip))) {
      res.setHeader("Retry-After", "900");
      return error(res, 429, "Trop de tentatives. Réessayez dans 15 minutes.");
    }
    const sql = db();
    const [user] =
      await sql`select id,email,password_hash,full_name,role from admin_users where email=${body.email.toLowerCase()}`;
    if (
      !user ||
      !(await bcrypt.compare(body.password, String(user.password_hash)))
    )
      return error(res, 401, "Identifiants invalides");
    const jwt = await signAdmin({
      sub: String(user.id),
      role: String(user.role),
    });
    res.setHeader(
      "Set-Cookie",
      `admin_token=${jwt}; HttpOnly; Path=/; Max-Age=28800; SameSite=Strict; ${process.env.NODE_ENV === "production" ? "Secure;" : ""}`,
    );
    await sql`update admin_users set last_login_at=now() where id=${user.id}`;
    return res.json({
      user: { email: user.email, fullName: user.full_name, role: user.role },
    });
  }

  if (action === "logout") {
    if (req.method !== "POST") return error(res, 405, "Méthode non autorisée");
    res.setHeader(
      "Set-Cookie",
      "admin_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict; Secure",
    );
    return res.status(204).end();
  }

  if (req.method !== "GET") return error(res, 405, "Méthode non autorisée");
  const user = await requireAdmin(req, res);
  if (user) return res.json({ user: { id: user.sub, role: user.role } });
});
