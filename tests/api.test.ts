import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import handler from "../server/router";
import { db, closeLocalDb } from "../server/_lib/db";
import { seed } from "../db/seed";
import questions from "../db/questions.json";
import { signAdmin } from "../server/_lib/auth";
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
    expect(result.data).toEqual({ submitted: true });
    const [saved] =
      await db()`select score::float,level,passed from attempts where id=${attemptId}`;
    expect(saved).toMatchObject({ score: 14, level: "acquis", passed: true });
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
      (await request(base + "/result", "GET", undefined, token)).status,
    ).toBe(403);
    const completedSession = await request(
      base + "/session",
      "GET",
      undefined,
      token,
    );
    expect(completedSession.data.status).toBe("submitted");
    expect(JSON.stringify(completedSession.data)).not.toContain('"correct"');
    expect(JSON.stringify(completedSession.data)).not.toContain(
      '"explanation"',
    );
    expect(completedSession.data.score).toBeUndefined();
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
    const base = `/api/attempts/${a.attemptId}`,
      first = s.quiz.questions[0].id;
    expect(
      (
        await request(
          base + "/answers",
          "PATCH",
          { questionId: first, selected: "a", revision: 5 },
          a.token,
        )
      ).status,
    ).toBe(200);
    await db()`update attempts set expires_at=now()+interval '5 minutes' where id=${a.attemptId}`;
    expect(
      (await request(base + "/reset", "POST", {}, "incorrect")).status,
    ).toBe(403);
    expect(
      (await request(base + "/reset", "POST", {}, a.token)).data.reset,
    ).toBe(true);
    const restarted = await request(
      base + "/session",
      "GET",
      undefined,
      a.token,
    );
    expect(restarted.data.answers.filter((x: any) => x.selected)).toHaveLength(
      0,
    );
    expect(
      new Date(restarted.data.expiresAt).getTime() - Date.now(),
    ).toBeGreaterThan(29 * 60000);
    expect(
      (
        await request(
          base + "/answers",
          "PATCH",
          { questionId: first, selected: "a", revision: 6 },
          a.token,
        )
      ).status,
    ).toBe(409);
    await db()`update attempts set started_at=now()-interval '31 minutes',expires_at=now()-interval '1 minute' where id=${a.attemptId}`;
    expect(
      (await request(base + "/reset", "POST", {}, a.token)).data.reset,
    ).toBe(false);
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
    expect(result.status).toBe(403);
    const [saved] =
      await db()`select score::float,duration_sec from attempts where id=${a.attemptId}`;
    expect(saved.score).toBe(0);
    expect(saved.duration_sec).toBe(1800);
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
    expect(Number(detail.data.score)).toBe(14);
    expect(detail.data.answers.map((q: any) => q.explanation)).toEqual(
      questions.map((q) => q.explanation),
    );
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
  it("supprime uniquement la tentative choisie avec autorisation administrateur", async () => {
    const identity = { fullName: "Suppression Test", agency: "Agence suppression" };
    const { data: first } = await request("/api/attempts", "POST", identity);
    const { data: second } = await request("/api/attempts", "POST", identity);
    const url = `/api/admin/attempts/${first.attemptId}`;
    expect((await request(url, "DELETE", undefined, first.token)).status).toBe(401);
    const viewer = `admin_token=${await signAdmin({ sub: "1", role: "viewer" })}`;
    expect((await request(url, "DELETE", undefined, undefined, viewer)).status).toBe(403);
    const cookie = `admin_token=${await signAdmin({ sub: "1", role: "admin" })}`;
    const [before] = await db()`select count(*)::int count from answers where attempt_id=${first.attemptId}`;
    expect(before.count).toBe(20);
    expect((await request(url, "DELETE", undefined, undefined, cookie)).data).toEqual({ deleted: true });
    const [answers] = await db()`select count(*)::int count from answers where attempt_id=${first.attemptId}`;
    expect(answers.count).toBe(0);
    expect((await request(url, "GET", undefined, undefined, cookie)).status).toBe(404);
    expect((await request(url, "DELETE", undefined, undefined, cookie)).status).toBe(404);
    const otherUrl = `/api/admin/attempts/${second.attemptId}`;
    expect((await request(otherUrl, "GET", undefined, undefined, cookie)).status).toBe(200);
    expect((await request(otherUrl, "DELETE", undefined, undefined, cookie)).status).toBe(200);
    const remaining = await db()`select id from candidates where full_name=${identity.fullName}`;
    expect(remaining).toHaveLength(0);
    const listing = await request("/api/admin/attempts?search=Suppression", "GET", undefined, undefined, cookie);
    expect(listing.data.total).toBe(0);
  });
  it("réimporte sans doublonner ni altérer les résultats", async () => {
    await seed();
    const [row] = await db()`select count(*)::int count from questions`;
    expect(row.count).toBe(20);
    const [a] = await db()`select score::float from attempts where score=14`;
    expect(a.score).toBe(14);
  });
});
