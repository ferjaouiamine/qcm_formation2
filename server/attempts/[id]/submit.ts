import { z } from "zod";
import { db } from "../../_lib/db.js";
import { authorizedAttempt, result } from "../../_lib/attempt.js";
import { method, safe } from "../../_lib/http.js";
export async function finalize(id: string) {
  const sql = db();
  await sql.transaction([
    sql`select id from attempts where id=${id} for update`,
    sql`update answers x set is_correct=coalesce(x.selected=q.correct,false),points=case when x.selected=q.correct then q.points else 0 end
      from questions q, attempts a where x.attempt_id=${id} and q.id=x.question_id and a.id=x.attempt_id and a.status='in_progress'`,
    sql`update attempts a set status='submitted',submitted_at=least(now(),a.expires_at),
      duration_sec=greatest(0,extract(epoch from(least(now(),a.expires_at)-a.started_at))::int),score=s.score,passed=s.score>=q.passing_score,
      level=(select l->>'key' from jsonb_array_elements(q.levels) l where (l->>'min')::numeric<=s.score order by (l->>'min')::numeric desc limit 1)
      from quizzes q,(select coalesce(sum(points),0) score from answers where attempt_id=${id}) s
      where a.id=${id} and a.quiz_id=q.id and a.status='in_progress'`,
  ]);
}
export async function finalizeExpired() {
  const rows =
    await db()`select id from attempts where status='in_progress' and expires_at<=now()`;
  for (const row of rows) await finalize(String(row.id));
}
export default safe(async (req, res) => {
  if (!method(req, res, ["POST"])) return;
  const id = z.string().uuid().parse(req.query.id);
  if (!(await authorizedAttempt(req, res, id))) return;
  await finalize(id);
  res.json(await result(id));
});
