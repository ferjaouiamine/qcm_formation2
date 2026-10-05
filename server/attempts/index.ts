import { z } from "zod";
import { db } from "../_lib/db.js";
import { makeAttemptToken, hashToken } from "../_lib/auth.js";
import { method, safe } from "../_lib/http.js";
export default safe(async (req, res) => {
  if (!method(req, res, ["POST"])) return;
  const body = z
    .object({
      fullName: z.string().trim().min(2).max(120),
      agency: z.string().trim().min(2).max(120),
    })
    .parse(req.body);
  const token = makeAttemptToken();
  const [row] =
    await db()`with q as (select id,duration_min,max_score from quizzes where is_active order by id desc limit 1),
    c as (insert into candidates(full_name,agency) select ${body.fullName},${body.agency} from q on conflict(full_name,agency) do update set full_name=excluded.full_name returning id),
    a as (insert into attempts(quiz_id,candidate_id,token_hash,expires_at,max_score) select q.id,c.id,${hashToken(token)},now()+make_interval(mins=>q.duration_min),q.max_score from q,c returning *)
    insert into answers(attempt_id,question_id) select a.id,x.id from a join questions x on x.quiz_id=a.quiz_id
    returning (select id from a) id,(select expires_at from a) expires_at`;
  if (!row)
    return res
      .status(503)
      .json({ error: { message: "Questionnaire non initialisé" } });
  res
    .status(201)
    .json({
      attemptId: row.id,
      expiresAt: row.expires_at,
      serverNow: new Date().toISOString(),
      token,
    });
});
