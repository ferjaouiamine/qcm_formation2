import type { VercelRequest, VercelResponse } from "@vercel/node";
import questions from "./questions/index.js";
import attempts from "./attempts/index.js";
import answers from "./attempts/[id]/answers.js";
import submit from "./attempts/[id]/submit.js";
import result from "./attempts/[id]/result.js";
import session from "./attempts/[id]/session.js";
import auth from "./auth/[action].js";
import list from "./admin/attempts/index.js";
import detail from "./admin/attempts/[id].js";
import stats from "./admin/stats/[kind].js";
import csv from "./admin/export.js";
import { safe } from "./_lib/http.js";
const routes = [
  [/^\/api\/questions$/, questions, []],
  [/^\/api\/attempts$/, attempts, []],
  [/^\/api\/attempts\/([^/]+)\/answers$/, answers, ["id"]],
  [/^\/api\/attempts\/([^/]+)\/submit$/, submit, ["id"]],
  [/^\/api\/attempts\/([^/]+)\/result$/, result, ["id"]],
  [/^\/api\/attempts\/([^/]+)\/session$/, session, ["id"]],
  [/^\/api\/auth\/([^/]+)$/, auth, ["action"]],
  [/^\/api\/admin\/attempts$/, list, []],
  [/^\/api\/admin\/attempts\/([^/]+)$/, detail, ["id"]],
  [/^\/api\/admin\/stats\/([^/]+)$/, stats, ["kind"]],
  [/^\/api\/admin\/export$/, csv, []],
] as const;
export default safe(async (req: VercelRequest, res: VercelResponse) => {
  const url = new URL(req.url || "/", "http://localhost");
  const routed = req.query?.route || url.searchParams.get("route");
  const pathname =
    url.pathname === "/api" || url.pathname === "/api/"
      ? `/api/${Array.isArray(routed) ? routed.join("/") : routed || ""}`
      : url.pathname;
  res.setHeader("Cache-Control", "no-store");
  if (
    !["GET", "HEAD"].includes(req.method || "") &&
    req.headers.origin &&
    new URL(req.headers.origin).host !== req.headers.host
  )
    return res
      .status(403)
      .json({ error: { message: "Origine non autorisée" } });
  for (const [pattern, handler, keys] of routes) {
    const match = pathname.match(pattern);
    if (match) {
      req.query = {
        ...req.query,
        ...Object.fromEntries(url.searchParams),
        ...Object.fromEntries(keys.map((key, i) => [key, match[i + 1]])),
      };
      return handler(req, res);
    }
  }
  res.status(404).json({ error: { message: "Route introuvable" } });
});
