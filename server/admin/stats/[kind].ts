import { finalizeExpired } from "../../attempts/[id]/submit.js";
import { z } from "zod";
import { requireAdmin } from "../../_lib/auth.js";
import { db } from "../../_lib/db.js";
import { error, safe } from "../../_lib/http.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default safe(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return error(res, 405, "Méthode non autorisée");
  if (!(await requireAdmin(req, res))) return;
  await finalizeExpired();
  const kind = z
    .enum(["overview", "questions", "agencies", "timeline", "ranking"])
    .parse(req.query.kind);
  const sql = db();

  if (kind === "overview") {
    const [[summary], levels] = await Promise.all([
      sql`select count(distinct candidate_id)::int candidates,count(*) filter(where status='submitted')::int completed,count(*) filter(where status='in_progress')::int in_progress,round(avg(score*20/nullif(max_score,0)) filter(where status='submitted'),2)::float average,percentile_cont(.5) within group(order by score*20/nullif(max_score,0)) filter(where status='submitted')::float median,round(100*avg(passed::int) filter(where status='submitted'),1)::float pass_rate,round(avg(duration_sec) filter(where status='submitted'))::int average_duration from attempts`,
      sql`select level,count(*)::int value from attempts where status='submitted' group by level`,
    ]);
    return res.json({ ...summary, levels });
  }

  if (kind === "questions")
    return res.json(
      await sql`select q.id,q.position,q.module,q.text,q.options,q.correct,count(a.*) filter(where t.status='submitted')::int responses,round(100*avg(a.is_correct::int) filter(where t.status='submitted'),1)::float success_rate,round(100*avg((a.selected is null)::int) filter(where t.status='submitted'),1)::float unanswered_rate,jsonb_build_object('a',count(*) filter(where a.selected='a' and t.status='submitted'),'b',count(*) filter(where a.selected='b' and t.status='submitted'),'c',count(*) filter(where a.selected='c' and t.status='submitted'),'d',count(*) filter(where a.selected='d' and t.status='submitted')) distribution from questions q left join answers a on a.question_id=q.id left join attempts t on t.id=a.attempt_id where q.quiz_id in (select id from quizzes where is_active) group by q.id order by q.position`,
    );

  if (kind === "agencies")
    return res.json(
      await sql`select c.agency,count(distinct c.id)::int candidates,count(a.id) filter(where a.status='submitted')::int completed,round(avg(a.score*20/nullif(a.max_score,0)) filter(where a.status='submitted'),2)::float average_score,round(100*avg(a.passed::int) filter(where a.status='submitted'),1)::float pass_rate from candidates c left join attempts a on a.candidate_id=c.id group by c.agency order by average_score desc nulls last,c.agency`,
    );

  if (kind === "ranking")
    return res.json(
      await sql`select row_number() over(order by a.score/nullif(a.max_score,0) desc,a.duration_sec asc,a.submitted_at asc)::int rank,a.id,c.full_name,c.agency,a.score::float,a.max_score::float,a.passed,a.level,a.duration_sec,a.submitted_at from attempts a join candidates c on c.id=a.candidate_id where a.status='submitted' order by rank`,
    );

  const { days } = z
    .object({ days: z.coerce.number().int().min(7).max(365).default(30) })
    .parse(req.query);
  return res.json(
    await sql`select d::date::text date,count(a.id)::int attempts,round(avg(a.score*20/nullif(a.max_score,0)),2)::float average_score from generate_series(current_date-(${days}::int-1),current_date,interval '1 day') d left join attempts a on a.submitted_at::date=d::date and a.status='submitted' group by d order by d`,
  );
});
