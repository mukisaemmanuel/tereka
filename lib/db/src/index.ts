import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import path from "path";
import fs from "fs";

import * as schema from "./schema";

const currentDirname = typeof __dirname !== "undefined" ? __dirname : process.cwd();

const { Pool } = pg;

let activeDbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;

if (!activeDbUrl) {
  const rootEnvPath = path.resolve(process.cwd(), ".env");
  const fallbackEnvPath = path.resolve(currentDirname, "../../../.env");
  const envPath = fs.existsSync(rootEnvPath) ? rootEnvPath : fs.existsSync(fallbackEnvPath) ? fallbackEnvPath : null;
  if (envPath) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value.trim();
      }
    }
  }
  activeDbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
}

if (!activeDbUrl) {
  throw new Error(
    "DATABASE_URL (or POSTGRES_URL) must be set. Did you forget to provision a database?",
  );
}

process.env.DATABASE_URL = activeDbUrl;

const isInternalOrLocal =
  activeDbUrl.includes("localhost") ||
  activeDbUrl.includes("127.0.0.1") ||
  activeDbUrl.includes(".railway.internal");

const requiresSsl =
  activeDbUrl.includes("sslmode=require") ||
  activeDbUrl.includes("ssl=true") ||
  (!isInternalOrLocal && process.env.NODE_ENV === "production");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(requiresSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
