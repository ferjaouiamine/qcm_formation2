import { z } from "zod";
import { db } from "../../_lib/db.js";
import { authorizedAttempt } from "../../_lib/attempt.js";
import { method, safe } from "../../_lib/http.js";
export default safe(async (req, res) => {
  if (!method(req, res, ["POST"])) return;
  const id = z.string().uuid().parse(req.query.id);
  if (!(await authorizedAttempt(req, res, id))) return;
  const sql = db(),
    revision = Date.now();
  const [, , rows] = await sql.transaction([
    sql`select id from attempts where id=${id} for update`,
    sql`update answers set selected=null,revision=${revision},is_correct=null,points=0,answered_at=now()
      where attempt_id in (select id from attempts where id=${id} and status='in_progress' and expires_at>now())`,
    sql`update attempts a set started_at=now(),expires_at=now()+make_interval(mins=>q.duration_min)
      from quizzes q where a.id=${id} and q.id=a.quiz_id and a.status='in_progress' and a.expires_at>now() returning a.expires_at`,
  ]);
  res.json({ reset: rows.length > 0, serverNow: new Date().toISOString() });
});
