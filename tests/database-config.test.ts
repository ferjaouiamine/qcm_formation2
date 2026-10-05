import { describe, it, expect, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { databaseConfig } from "../server/_lib/database-config";
import { ServiceError, serviceCode } from "../server/_lib/service-error";
import { safe } from "../server/_lib/http";

const url =
  "postgresql://example:private-test-password@ep-test.neon.tech/neondb?sslmode=require&channel_binding=require";
describe("Configuration serveur et diagnostic sans secrets", () => {
  it("accepte une chaîne PostgreSQL avec ses paramètres", () =>
    expect(databaseConfig({ DATABASE_URL: url, VERCEL: "1" })).toEqual({
      mode: "neon",
      url,
    }));
  it("tolère les guillemets et espaces copiés depuis .env", () =>
    expect(
      databaseConfig({ DATABASE_MODE: ' "neon" ', DATABASE_URL: ` "${url}" ` }),
    ).toEqual({ mode: "neon", url }));
  it.each([
    "Neon",
    "NEON",
    "DATABASE_MODE=neon",
    'DATABASE_MODE="neon"',
    "neon # production",
  ])("tolère un mode mal copié (%s)", (value) =>
    expect(
      databaseConfig({ DATABASE_MODE: value, DATABASE_URL: url }).mode,
    ).toBe("neon"),
  );
  it("refuse un mode inconnu", () =>
    expect(() =>
      databaseConfig({ DATABASE_MODE: "postgres", DATABASE_URL: url }),
    ).toThrow("CONFIG_DATABASE_MODE_INVALID"));
  it("refuse une URL absente avec une référence précise", () =>
    expect(() => databaseConfig({})).toThrow("CONFIG_DATABASE_URL_MISSING"));
  it.each(["la_chaine_Neon", `DATABASE_URL=${url}`, "https://example.com"])(
    "refuse une valeur invalide sans l’exposer (%#)",
    (value) => {
      try {
        databaseConfig({ DATABASE_URL: value });
        throw new Error("expected error");
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect((error as Error).message).toBe("CONFIG_DATABASE_URL_INVALID");
      }
    },
  );
  it("interdit le stockage local sur Vercel", () =>
    expect(() =>
      databaseConfig({ DATABASE_MODE: "local", VERCEL: "1" }),
    ).toThrow("CONFIG_LOCAL_DATABASE_ON_VERCEL"));
  it("préserve le développement local sans URL Neon", () =>
    expect(databaseConfig({ DATABASE_MODE: "local" }).mode).toBe("local"));
  it.each([
    ["28P01", "DATABASE_AUTH_FAILED"],
    ["42P01", "DATABASE_SCHEMA_MISSING"],
    ["3D000", "DATABASE_NOT_FOUND"],
    ["ENOTFOUND", "DATABASE_UNREACHABLE"],
  ])("classe l’erreur %s", (code, expected) =>
    expect(serviceCode({ code, message: url })).toBe(expected),
  );
  it("ne transmet pas les messages bruts au navigateur ou aux logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    let body: unknown,
      status = 0;
    const res = {
      status(n: number) {
        status = n;
        return res;
      },
      json(data: unknown) {
        body = data;
        return res;
      },
    } as VercelResponse;
    try {
      await safe(async () => {
        throw Object.assign(new Error(url), { code: "28P01" });
      })({} as VercelRequest, res);
      expect(status).toBe(500);
      expect(body).toMatchObject({ error: { code: "DATABASE_AUTH_FAILED" } });
      expect(JSON.stringify({ body, logs: log.mock.calls })).not.toContain(
        "private-test-password",
      );
      expect(JSON.stringify({ body, logs: log.mock.calls })).not.toContain(
        "ep-test.neon.tech",
      );
    } finally {
      log.mockRestore();
    }
  });
});
