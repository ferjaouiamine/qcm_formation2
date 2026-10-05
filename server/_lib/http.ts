import type { VercelRequest, VercelResponse } from "@vercel/node";
import { serviceCode } from "./service-error.js";
export const error = (res: VercelResponse, status: number, message: string) =>
  res.status(status).json({ error: { message } });
export function method(
  req: VercelRequest,
  res: VercelResponse,
  allowed: string[],
) {
  if (!req.method || !allowed.includes(req.method)) {
    res.setHeader("Allow", allowed);
    error(res, 405, "Méthode non autorisée");
    return false;
  }
  return true;
}
export function safe(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<unknown>,
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      await handler(req, res);
    } catch (e) {
      if (e instanceof Error && e.name === "ZodError")
        return error(res, 400, "Requête invalide");
      const code = serviceCode(e);
      console.error("Erreur API", { code });
      return res
        .status(500)
        .json({
          error: {
            code,
            message: `Le service est temporairement indisponible. Référence : ${code}.`,
          },
        });
    }
  };
}
