import path from "node:path";
import fs from "node:fs";
import express from "express";
import app from "./app";
import { logger } from "./lib/logger";
import { seedInitialDatabase } from "./lib/db-seed";

const port = Number(process.env.PORT) || 5000;

// Resolve static frontend directory (supports local monorepo, docker containers, and root build outputs)
const candidateStaticPaths = [
  path.join(__dirname, "../../tereka/dist"),
  path.resolve("artifacts/tereka/dist"),
  path.resolve("dist"),
];

const staticPath = candidateStaticPaths.find((dir) => fs.existsSync(dir));

if (staticPath) {
  logger.info({ staticPath }, `Serving static frontend from ${staticPath}`);
  console.log(`[Tereka Server] Serving frontend static assets from: ${staticPath}`);
  app.use(express.static(staticPath));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api") || req.path === "/health") {
      return next();
    }
    const indexPath = path.join(staticPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
}

async function startServer() {
  try {
    await seedInitialDatabase();
  } catch (err) {
    logger.error({ err }, "Database seed error");
  }

  app.listen(port, "0.0.0.0", () => {
    logger.info({ port }, `Tereka API server running on port ${port}`);
    console.log(`Tereka API server running on port ${port}`);
  });
}

startServer();
