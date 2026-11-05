import { finalizeExpired } from "../../attempts/[id]/submit.js";
import { z } from "zod";
import { requireAdmin } from "../../_lib/auth.js";
import { db } from "../../_lib/db.js";
import { method, safe } from "../../_lib/http.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
export default safe(async (req: VercelRequest, res: VercelResponse) => {
  if (!method(req, res, ["GET", "DELETE"])) return;
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const id = z.string().uuid().parse(req.query.id),
    sql = db();
  if (req.method === "DELETE") {
    if (admin.role !== "admin")
      return res.status(403).json({ error: { message: "Suppression réservée aux administrateurs" } });
    const [target] = await sql`select candidate_id from attempts where id=${id}`;
    if (!target)
      return res.status(404).json({ error: { message: "Tentative introuvable" } });
    await sql.transaction([
      sql`delete from attempts where id=${id}`,
      sql`delete from candidates where id=${target.candidate_id} and not exists (select 1 from attempts where candidate_id=${target.candidate_id})`,
    ]);
    return res.json({ deleted: true });
  }
  await finalizeExpired();
  const [attempt] =
    await sql`select a.id,a.status,a.started_at,a.submitted_at,a.duration_sec,a.score,a.max_score,a.passed,a.level,c.full_name,c.agency,q.title,q.levels from attempts a join candidates c on c.id=a.candidate_id join quizzes q on q.id=a.quiz_id where a.id=${id}`;
  if (!attempt)
    return res
      .status(404)
      .json({ error: { message: "Tentative introuvable" } });
  const answers =
    await sql`select q.id,q.position,q.module,q.text,q.options,x.selected,q.correct,q.explanation,x.is_correct from answers x join questions q on q.id=x.question_id where x.attempt_id=${id} order by q.position`;
  res.json({ ...attempt, answers });
});
