import { db } from "../_lib/db.js";
import { method, safe } from "../_lib/http.js";
export default safe(async (req, res) => {
  if (!method(req, res, ["GET"])) return;
  const [quiz] =
    await db()`select q.id,q.title,q.subtitle,q.instructions,q.duration_min,q.max_score::float,q.passing_score::float,q.levels,
    json_agg(json_build_object('id',x.id,'position',x.position,'module',x.module,'text',x.text,'options',x.options) order by x.position) questions
    from quizzes q join questions x on x.quiz_id=q.id where q.is_active group by q.id order by q.id desc limit 1`;
  if (!quiz)
    return res
      .status(503)
      .json({
        error: {
          message:
            "Questionnaire non initialisé. Exécutez les migrations et l’import.",
        },
      });
  res.json(quiz);
});
