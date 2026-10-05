import "dotenv/config";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import handler from "./server/router";
function localApi(): Plugin {
  return {
    name: "local-vercel-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        const response = res as VercelResponse;
        response.status = (code) => {
          res.statusCode = code;
          return response;
        };
        response.json = (data) => {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(data));
          return response;
        };
        response.send = (data) => {
          res.end(data);
          return response;
        };
        try {
          let body = "";
          for await (const chunk of req) {
            body += chunk;
            if (body.length > 16384)
              return void response
                .status(413)
                .json({ error: { message: "Requête trop volumineuse" } });
          }
          const request = req as VercelRequest;
          request.body = body ? JSON.parse(body) : undefined;
          await handler(request, response);
        } catch {
          response.status(400).json({ error: { message: "Requête invalide" } });
        }
      });
    },
  };
}
export default defineConfig({ plugins: [react(), localApi()] });
