import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import handler from "../server/router";
import { db, closeLocalDb } from "../server/_lib/db";
import { seed } from "../db/seed";
import questions from "../db/questions.json";
process.env.DATABASE_MODE = "local";
process.env.LOCAL_DATABASE_PATH = "memory://";
process.env.JWT_SECRET =
  "test-only-secret-with-more-than-thirty-two-characters";
process.env.ADMIN_EMAIL = "trainer@example.test";
process.env.ADMIN_PASSWORD = "test-only-password-123";
async function request(
  url: string,
  method = "GET",
  body?: unknown,
  token?: string,
  cookie?: string,
) {
  let status = 200,
    data: any;
  const headers: Record<string, string> = {};
  const req = {
    url,
    method,
    body,
    headers: { host: "localhost", "x-attempt-token": token, cookie },
    query: {},
  } as unknown as VercelRequest;
  const res = {
    status(n: number) {
      status = n;
      return res;
    },
    json(v: unknown) {
      data = v;
      return res;
    },
    send(v: unknown) {
      data = v;
      return res;
    },
    end() {
      return res;
    },
    setHeader(k: string, v: string) {
      headers[k] = v;
      return res;
    },
  } as unknown as VercelResponse;
  await handler(req, res);
  return { status, data, headers };
}
beforeAll(async () => {
  const schema = await readFile("db/migrations/001_schema.sql", "utf8");
  for (const part of schema
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean))
    await db().query(part);
  await db().query(
    await readFile("db/migrations/003_login_limits.sql", "utf8"),
  );
  await seed();
}, 60000);
afterAll(async () => {
  await closeLocalDb();
});
describe("API complète sur PostgreSQL embarqué", () => {
  it("expose les 20 questions fidèles sans corrections", async () => {
    expect((await request("/api?route=questions")).status).toBe(200);
    const r = await request("/api/questions");
    expect(r.status).toBe(200);
    expect(r.data.duration_min).toBe(30);
    expect(r.data.max_score).toBe(20);
    expect(r.data.passing_score).toBe(14);
    expect(r.data.questions).toHaveLength(20);
    expect(JSON.stringify(r.data)).not.toContain("explanation");
    expect(JSON.stringify(r.data)).not.toContain('"correct"');
    expect(r.data.questions.map((q: any) => q.text)).toEqual(
      questions.map((q) => q.text),
    );
  });
  it("refuse les identités invalides et les accès administrateur anonymes", async () => {
    expect(
      (await request("/api/attempts", "POST", { fullName: "x", agency: "" }))
        .status,
    ).toBe(400);
    for (const url of [
      "/api/admin/stats/overview",
      "/api/admin/stats/ranking",
      "/api/admin/attempts",
      "/api/admin/export",
    ])
      expect((await request(url)).status).toBe(401);
  });
  it("sauvegarde, reprend, calcule la note et verrouille la soumission", async () => {
    const started = await request("/api/attempts", "POST", {
      fullName: "Candidat Test",
      agency: "Agence Test",
    });
    expect(started.status).toBe(201);
    const { attemptId, token } = started.data;
    const base = `/api/attempts/${attemptId}`;
    expect(
      (await request(base + "/result", "GET", undefined, token)).status,
    ).toBe(409);
    expect(
      (await request(base + "/session", "GET", undefined, "incorrect")).status,
    ).toBe(403);
    const session = await request(base + "/session", "GET", undefined, token);
    expect(session.data.quiz.questions).toHaveLength(20);
    expect(JSON.stringify(session.data)).not.toContain("explanation");
    const qs = session.data.quiz.questions;
    for (let i = 0; i < 14; i++)
      expect(
        (
          await request(
            base + "/answers",
            "PATCH",
            {
              questionId: qs[i].id,
              selected: questions[i].correct,
              revision: 100,
            },
            token,
          )
        ).status,
      ).toBe(200);
    expect(
      (
        await request(
          base + "/answers",
          "PATCH",
          { questionId: qs[0].id, selected: "d", revision: 99 },
          token,
        )
      ).status,
    ).toBe(409);
    const resumed = await request(base + "/session", "GET", undefined, token);
    expect(resumed.data.answers.filter((a: any) => a.selected)).toHaveLength(
      14,
    );
    const result = await request(base + "/submit", "POST", {}, token);
    expect(result.status).toBe(200);
    expect(result.data.score).toBe(14);
    expect(result.data.level).toBe("acquis");
    expect(result.data.passed).toBe(true);
    expect(result.data.correction).toHaveLength(20);
    expect(result.data.correction.map((q: any) => q.explanation)).toEqual(
      questions.map((q) => q.explanation),
    );
    expect(
      (
        await request(
          base + "/answers",
          "PATCH",
          { questionId: qs[0].id, selected: "d", revision: 101 },
          token,
        )
      ).status,
    ).toBe(409);
    expect((await request(base + "/submit", "POST", {}, token)).data).toEqual(
      result.data,
    );
    expect(
      (await request(base + "/result", "GET", undefined, token)).data.score,
    ).toBe(14);
  });
  it("rejette les réponses hors délai et clôture les abandons", async () => {
    const { data: a } = await request("/api/attempts", "POST", {
      fullName: "Expiration Test",
      agency: "Agence Test",
    });
    const { data: s } = await request(
      `/api/attempts/${a.attemptId}/session`,
      "GET",
      undefined,
      a.token,
    );
    await db()`update attempts set started_at=now()-interval '31 minutes',expires_at=now()-interval '1 minute' where id=${a.attemptId}`;
    expect(
      (
        await request(
          `/api/attempts/${a.attemptId}/answers`,
          "PATCH",
          { questionId: s.quiz.questions[0].id, selected: "a", revision: 1 },
          a.token,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await request(
          `/api/attempts/${a.attemptId}/session`,
          "GET",
          undefined,
          a.token,
        )
      ).data.status,
    ).toBe("submitted");
    const result = await request(
      `/api/attempts/${a.attemptId}/result`,
      "GET",
      undefined,
      a.token,
    );
    expect(result.data.score).toBe(0);
    expect(result.data.duration_sec).toBe(1800);
  });
  it("connecte le formateur, produit les statistiques et exporte", async () => {
    expect(
      (
        await request("/api/auth/login", "POST", {
          email: process.env.ADMIN_EMAIL,
          password: "incorrect-password",
        })
      ).status,
    ).toBe(401);
    const login = await request("/api/auth/login", "POST", {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    expect(login.status).toBe(200);
    const cookie = login.headers["Set-Cookie"];
    expect(cookie).toContain("HttpOnly");
    for (const kind of [
      "overview",
      "timeline",
      "questions",
      "agencies",
      "ranking",
    ]) {
      const r = await request(
        `/api/admin/stats/${kind}`,
        "GET",
        undefined,
        undefined,
        cookie,
      );
      expect(r.status, JSON.stringify(r.data)).toBe(200);
      if (kind === "overview") {
        expect(r.data.completed).toBe(2);
        expect(r.data.average).toBe(7);
      }
      if (kind === "ranking") expect(r.data[0].score).toBe(14);
    }
    const list = await request(
      "/api/admin/attempts?search=Candidat",
      "GET",
      undefined,
      undefined,
      cookie,
    );
    expect(list.data.total).toBe(1);
    const detail = await request(
      `/api/admin/attempts/${list.data.items[0].id}`,
      "GET",
      undefined,
      undefined,
      cookie,
    );
    expect(detail.data.answers).toHaveLength(20);
    const csv = await request(
      "/api/admin/export",
      "GET",
      undefined,
      undefined,
      cookie,
    );
    expect(csv.headers["Content-Type"]).toContain("text/csv");
    expect(csv.data).toContain("Candidat Test");
    expect(
      (await request("/api/auth/logout", "POST", {}, undefined, cookie)).status,
    ).toBe(204);
  });
  it("réimporte sans doublonner ni altérer les résultats", async () => {
    await seed();
    const [row] = await db()`select count(*)::int count from questions`;
    expect(row.count).toBe(20);
    const [a] = await db()`select score::float from attempts where score=14`;
    expect(a.score).toBe(14);
  });
});
