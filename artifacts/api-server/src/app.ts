import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin: [
      "http://localhost:5180",
      "http://localhost:5173",
      "http://localhost:3000",
      /\.vercel\.app$/, // Allow all Vercel preview and production deployments
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Render & Monitoring health check endpoints
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "tereka-api" });
});
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "tereka-api" });
});

app.use("/api", router);
app.use("/", router);

export default app;
