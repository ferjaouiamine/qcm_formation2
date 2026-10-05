import { timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { attemptToken, hashToken } from "./auth.js";
import { db } from "./db.js";
export async function authorizedAttempt(
  req: VercelRequest,
  res: VercelResponse,
  id: string,
) {
  const token = attemptToken(req);
  if (!token) {
    res.status(403).json({ error: { message: "Token de tentative requis" } });
    return null;
  }
  const [a] =
    await db()`select a.*,q.levels,q.passing_score,c.full_name,c.agency from attempts a join quizzes q on q.id=a.quiz_id join candidates c on c.id=a.candidate_id where a.id=${id}`;
  const actual = hashToken(token);
  if (
    !a ||
    String(a.token_hash).length !== actual.length ||
    !timingSafeEqual(Buffer.from(String(a.token_hash)), Buffer.from(actual))
  ) {
    res.status(403).json({ error: { message: "Accès refusé" } });
    return null;
  }
  return a;
}
export async function result(id: string) {
  const sql = db();
  const [a] =
    await sql`select a.id,a.score::float,a.max_score::float,a.passed,a.level,a.submitted_at,a.duration_sec,c.full_name,c.agency,q.title,q.levels from attempts a join candidates c on c.id=a.candidate_id join quizzes q on q.id=a.quiz_id where a.id=${id}`;
  const correction =
    await sql`select q.id,q.position,q.module,q.text,q.options,x.selected,q.correct,q.explanation,coalesce(x.is_correct,false) is_correct from answers x join questions q on q.id=x.question_id where x.attempt_id=${id} order by q.position`;
  return { ...a, correction };
}
