import express, { type Request, type Response, type NextFunction } from "express";
import path from "node:path";
import fs from "node:fs";
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

// Health check endpoints (for Railway, Render, etc.)
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "tereka-api" });
});
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "tereka-api" });
});

app.use("/api", router);
app.use("/", router);

// Serve static frontend when deployed as a full-stack monolithic container
const distPath = path.resolve("dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" || req.path.startsWith("/api") || req.path === "/health") {
      return next();
    }
    const indexPath = path.join(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
}

export default app;
