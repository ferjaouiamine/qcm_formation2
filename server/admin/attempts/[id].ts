import { finalizeExpired } from "../../attempts/[id]/submit.js";
import { z } from "zod";
import { requireAdmin } from "../../_lib/auth.js";
import { db } from "../../_lib/db.js";
import { method, safe } from "../../_lib/http.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
export default safe(async (req: VercelRequest, res: VercelResponse) => {
  if (!method(req, res, ["GET"]) || !(await requireAdmin(req, res))) return;
  await finalizeExpired();
  const id = z.string().uuid().parse(req.query.id),
    sql = db();
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
