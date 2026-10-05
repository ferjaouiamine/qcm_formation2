import "dotenv/config";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import questions from "./questions.json" with { type: "json" };
import metadata from "./metadata.json" with { type: "json" };
import { db, closeLocalDb } from "../server/_lib/db.js";
export async function seed() {
  const sql = db(),
    max = questions.reduce((sum, q) => sum + q.points, 0);
  const levels = [
    {
      key: "acquis",
      min: Math.ceil(max * metadata.passingRatio),
      label: "Acquis",
      description: "Au moins 70 % de bonnes réponses",
    },
    {
      key: "a_consolider",
      min: Math.ceil(max * metadata.consolidationRatio),
      label: "À consolider",
      description: "De 50 % à moins de 70 %",
    },
    {
      key: "non_acquis",
      min: 0,
      label: "Non acquis",
      description: "Moins de 50 % de bonnes réponses",
    },
  ];
  const version = createHash("sha256")
    .update(JSON.stringify({ questions, metadata }))
    .digest("hex")
    .slice(0, 16);
  const slug = `assurance-vie-${version}`;
  const instructions = `${questions.length} questions. Une seule bonne réponse par question. 1 point par bonne réponse, 0 sinon. Acquis à partir de 70 %, à consolider à partir de 50 %. Durée : 30 minutes.`;
  await sql.transaction([
    sql`update quizzes set is_active=false where slug<>${slug}`,
    sql`insert into quizzes(slug,title,subtitle,instructions,duration_min,max_score,passing_score,levels)
      values(${slug},${metadata.title},'Évaluation de fin de formation · Modules 2 à 5',${instructions},30,${max},${levels[0].min},${JSON.stringify(levels)}::jsonb)
      on conflict(slug) do update set is_active=true`,
    ...questions.map(
      (
        q,
      ) => sql`insert into questions(quiz_id,position,module,text,options,correct,explanation,points)
      select id,${q.position},${q.module},${q.text},${JSON.stringify(q.options)}::jsonb,${q.correct},${q.explanation},${q.points}
      from quizzes where slug=${slug} on conflict(quiz_id,position) do nothing`,
    ),
  ]);
  const email = process.env.ADMIN_EMAIL,
    password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 12)
      throw new Error("ADMIN_PASSWORD doit comporter au moins 12 caractères");
    const hash = await bcrypt.hash(password, 12);
    await sql`insert into admin_users(email,password_hash,full_name,role) values(${email.toLowerCase()},${hash},'Administrateur','admin')
      on conflict(email) do update set password_hash=excluded.password_hash`;
  }
  return questions.length;
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/seed.ts")) {
  console.log(
    `Import terminé : ${await seed()} questions. Compte administrateur créé si ses variables sont renseignées.`,
  );
  await closeLocalDb();
}
