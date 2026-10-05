import { finalizeExpired } from "../attempts/[id]/submit.js";
import { requireAdmin } from "../_lib/auth.js";
import { db } from "../_lib/db.js";
import { method, safe } from "../_lib/http.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
const cell = (v: unknown) =>
  `"${String(v ?? "")
    .replace(/^[=+@\-\t\r]/, "'$&")
    .replaceAll('"', '""')}"`;
export default safe(async (req: VercelRequest, res: VercelResponse) => {
  if (!method(req, res, ["GET"]) || !(await requireAdmin(req, res))) return;
  await finalizeExpired();
  const rows =
    await db()`select c.full_name,c.agency,a.submitted_at,a.duration_sec,a.score,a.max_score,a.level,a.passed,a.status from attempts a join candidates c on c.id=a.candidate_id order by a.submitted_at desc nulls last`;
  const csv = [
    "Nom;Agence;Date;Durée (s);Note;Maximum;Niveau;Réussi;Statut",
    ...rows.map((r) =>
      [
        r.full_name,
        r.agency,
        r.submitted_at,
        r.duration_sec,
        r.score,
        r.max_score,
        r.level,
        r.passed ? "Oui" : "Non",
        r.status,
      ]
        .map(cell)
        .join(";"),
    ),
  ].join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="resultats-assurance-vie.csv"',
  );
  res.send("\ufeff" + csv);
});
