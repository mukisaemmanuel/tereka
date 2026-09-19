import app from "./app";
import { logger } from "./lib/logger";
import { seedInitialDatabase } from "./lib/db-seed";

const port = Number(process.env.PORT) || 5000;

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
