import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";
import { seedInitialDatabase } from "./lib/db-seed";

let isSeeded = false;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!isSeeded) {
    try {
      await seedInitialDatabase();
      isSeeded = true;
    } catch (err) {
      console.error("[Vercel API] Seed warning:", err);
    }
  }
  return app(req, res);
}
