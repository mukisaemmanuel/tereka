import express, { type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }) as any,
);
app.use(
  cors({
    origin: [
      "http://localhost:5180",
      "http://localhost:5173",
      "http://localhost:3000",
      /\.vercel\.app$/, // Allow all Vercel preview and production deployments
      /\.railway\.app$/, // Allow Railway deployments
      /\.up\.railway\.app$/, // Allow Railway up domains
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }) as any,
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check endpoints (for Railway, Render, Kubernetes, etc.)
app.get(["/health", "/healthz", "/api/health", "/api/healthz"], (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "tereka-api" });
});

app.use("/api", router);



export default app;
