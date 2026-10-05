import { ServiceError } from "./service-error.js";

function normalize(value: string | undefined) {
  const text = (value ?? "").trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  )
    return text.slice(1, -1).trim();
  return text;
}

export function databaseConfig(env: NodeJS.ProcessEnv = process.env) {
  const mode = normalize(env.DATABASE_MODE) || "neon";
  if (mode !== "neon" && mode !== "local")
    throw new ServiceError("CONFIG_DATABASE_MODE_INVALID");
  if (mode === "local") {
    if (env.VERCEL) throw new ServiceError("CONFIG_LOCAL_DATABASE_ON_VERCEL");
    return { mode, url: "" };
  }
  const url = normalize(env.DATABASE_URL);
  if (!url) throw new ServiceError("CONFIG_DATABASE_URL_MISSING");
  try {
    const parsed = new URL(url);
    if (
      !["postgres:", "postgresql:"].includes(parsed.protocol) ||
      !parsed.hostname ||
      !parsed.username ||
      !parsed.password ||
      parsed.pathname.length < 2
    )
      throw new Error("invalid");
  } catch {
    throw new ServiceError("CONFIG_DATABASE_URL_INVALID");
  }
  return { mode, url };
}
