export type ServiceCode =
  | "CONFIG_DATABASE_URL_MISSING"
  | "CONFIG_DATABASE_URL_INVALID"
  | "CONFIG_DATABASE_MODE_INVALID"
  | "CONFIG_LOCAL_DATABASE_ON_VERCEL"
  | "DATABASE_AUTH_FAILED"
  | "DATABASE_SCHEMA_MISSING"
  | "DATABASE_NOT_FOUND"
  | "DATABASE_UNREACHABLE"
  | "INTERNAL_ERROR";

export class ServiceError extends Error {
  constructor(public readonly code: ServiceCode) {
    super(code);
    this.name = "ServiceError";
  }
}

// Never return or log raw driver messages: they can contain connection details.
export function serviceCode(error: unknown): ServiceCode {
  let current = error;
  for (
    let depth = 0;
    depth < 4 && current && typeof current === "object";
    depth++
  ) {
    if (current instanceof ServiceError) return current.code;
    const item = current as {
      code?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (item.code === "28P01" || item.code === "28000")
      return "DATABASE_AUTH_FAILED";
    if (item.code === "42P01" || item.code === "42703")
      return "DATABASE_SCHEMA_MISSING";
    if (item.code === "3D000") return "DATABASE_NOT_FOUND";
    if (
      ["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "ECONNRESET"].includes(
        String(item.code),
      )
    )
      return "DATABASE_UNREACHABLE";
    const message =
      typeof item.message === "string" ? item.message.toLowerCase() : "";
    if (message.includes("password authentication failed"))
      return "DATABASE_AUTH_FAILED";
    if (
      message.includes("fetch failed") ||
      message.includes("error connecting to database")
    )
      return "DATABASE_UNREACHABLE";
    current = item.cause;
  }
  return "INTERNAL_ERROR";
}
