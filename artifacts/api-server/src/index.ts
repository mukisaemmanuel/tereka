import app from "./app";
import { logger } from "./lib/logger";
import { seedInitialDatabase } from "./lib/db-seed";

const rawPort = process.env["PORT"] || "5050";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer() {
  try {
    await seedInitialDatabase();
  } catch (err) {
    logger.error({ err }, "Database seed error");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening with PostgreSQL Drizzle ORM");
  });
}

startServer();
