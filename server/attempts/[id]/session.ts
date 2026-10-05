import { z } from "zod";
import { db } from "../../_lib/db.js";
import { authorizedAttempt } from "../../_lib/attempt.js";
import { method, safe } from "../../_lib/http.js";
import { finalize } from "./submit.js";
export default safe(async (req, res) => {
  if (!method(req, res, ["GET"])) return;
  const id = z.string().uuid().parse(req.query.id),
    a = await authorizedAttempt(req, res, id);
  if (!a) return;
  if (
    a.status === "in_progress" &&
    new Date(String(a.expires_at)).getTime() <= Date.now()
  ) {
    await finalize(id);
    a.status = "submitted";
  }
  const sql = db();
  const [quiz] =
    await sql`select id,title,subtitle,instructions,duration_min,max_score::float,passing_score::float from quizzes where id=${a.quiz_id}`;
  const questions =
    await sql`select id,position,module,text,options from questions where quiz_id=${a.quiz_id} order by position`;
  const answers =
    await sql`select question_id,selected,revision::float from answers where attempt_id=${id}`;
  res.json({
    status: a.status,
    expiresAt: a.expires_at,
    serverNow: new Date().toISOString(),
    quiz: { ...quiz, questions },
    answers,
  });
});
