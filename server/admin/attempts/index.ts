import { finalizeExpired } from "../../attempts/[id]/submit.js";
import { z } from "zod";
import { requireAdmin } from "../../_lib/auth.js";
import { db } from "../../_lib/db.js";
import { method, safe } from "../../_lib/http.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().max(120).default(""),
  agency: z.string().max(120).default(""),
  level: z.string().max(40).default(""),
  passed: z.enum(["true", "false"]).optional(),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
  sort: z.enum(["submitted_at", "score", "full_name"]).default("submitted_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export default safe(async (req: VercelRequest, res: VercelResponse) => {
  if (!method(req, res, ["GET"]) || !(await requireAdmin(req, res))) return;
  await finalizeExpired();
  const q = querySchema.parse(req.query),
    sql = db(),
    limit = 25,
    offset = (q.page - 1) * limit;
  const passed = q.passed === undefined ? null : q.passed === "true";
  const [items, count, agencies] = await Promise.all([
    sql`select a.id,c.full_name,c.agency,a.started_at,a.submitted_at,a.duration_sec,a.score,a.max_score,a.passed,a.level,a.status from attempts a join candidates c on c.id=a.candidate_id where (${q.search}='' or c.full_name ilike ${`%${q.search}%`}) and (${q.agency}='' or c.agency=${q.agency}) and (${q.level}='' or a.level=${q.level}) and (${passed}::boolean is null or a.passed=${passed}) and (${q.dateFrom ?? null}::date is null or a.submitted_at::date>=${q.dateFrom ?? null}::date) and (${q.dateTo ?? null}::date is null or a.submitted_at::date<=${q.dateTo ?? null}::date) order by case when ${q.sort}='score' and ${q.order}='asc' then a.score end asc nulls last,case when ${q.sort}='score' and ${q.order}='desc' then a.score end desc nulls last,case when ${q.sort}='full_name' and ${q.order}='asc' then c.full_name end asc,case when ${q.sort}='full_name' and ${q.order}='desc' then c.full_name end desc,case when ${q.sort}='submitted_at' and ${q.order}='asc' then a.submitted_at end asc nulls last,case when ${q.sort}='submitted_at' and ${q.order}='desc' then a.submitted_at end desc nulls last limit ${limit} offset ${offset}`,
    sql`select count(*)::int total from attempts a join candidates c on c.id=a.candidate_id where (${q.search}='' or c.full_name ilike ${`%${q.search}%`}) and (${q.agency}='' or c.agency=${q.agency}) and (${q.level}='' or a.level=${q.level}) and (${passed}::boolean is null or a.passed=${passed}) and (${q.dateFrom ?? null}::date is null or a.submitted_at::date>=${q.dateFrom ?? null}::date) and (${q.dateTo ?? null}::date is null or a.submitted_at::date<=${q.dateTo ?? null}::date)`,
    sql`select distinct agency from candidates order by agency`,
  ]);
  res.json({
    items,
    total: Number(count[0]?.total ?? 0),
    page: q.page,
    pageSize: limit,
    agencies: agencies.map((x) => x.agency),
  });
});
