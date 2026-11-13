import { z } from "zod";
import { authorizedAttempt, canViewResult, result } from "../../_lib/attempt.js";
import { method, safe } from "../../_lib/http.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
export default safe(async (req: VercelRequest, res: VercelResponse) => {
  if (!method(req, res, ["GET"])) return;
  const id = z.string().uuid().parse(req.query.id),
    a = await authorizedAttempt(req, res, id);
  if (!a) return;
  if (a.status !== "submitted")
    return res
      .status(409)
      .json({ error: { message: "Résultat non disponible" } });
  if (canViewResult(a)) return res.json(await result(id));
  res
    .status(403)
    .json({ error: { message: "Les résultats sont réservés au formateur." } });
});
