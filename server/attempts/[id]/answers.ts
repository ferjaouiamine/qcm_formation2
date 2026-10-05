import { z } from "zod";
import { db } from "../../_lib/db.js";
import { authorizedAttempt } from "../../_lib/attempt.js";
import { method, safe } from "../../_lib/http.js";
export default safe(async (req, res) => {
  if (!method(req, res, ["PATCH"])) return;
  const id = z.string().uuid().parse(req.query.id);
  const body = z
    .object({
      questionId: z.number().int().positive(),
      selected: z.enum(["a", "b", "c", "d"]).nullable(),
      revision: z.number().int().nonnegative(),
    })
    .parse(req.body);
  if (!(await authorizedAttempt(req, res, id))) return;
  const rows =
    await db()`with locked as (select id from attempts where id=${id} and status='in_progress' and expires_at>now() for update)
    update answers set selected=${body.selected},revision=${body.revision},answered_at=now()
    where attempt_id in (select id from locked) and question_id=${body.questionId} and revision<=${body.revision} returning question_id`;
  if (!rows.length)
    return res
      .status(409)
      .json({
        error: {
          message:
            "Réponse non enregistrée : délai écoulé, tentative terminée ou réponse plus récente déjà reçue.",
        },
      });
  res.json({ saved: true });
});
