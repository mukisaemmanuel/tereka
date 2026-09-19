import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import * as schema from "./schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

let activeDbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URL || process.env.POSTGRES_PRISMA_URL;

if (!activeDbUrl) {
  const rootEnvPath = path.resolve(process.cwd(), ".env");
  const fallbackEnvPath = path.resolve(__dirname, "../../../.env");
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
  activeDbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URL || process.env.POSTGRES_PRISMA_URL;
}

if (!activeDbUrl) {
  throw new Error(
    "DATABASE_URL (or POSTGRES_URL) must be set. Did you forget to provision a database?",
  );
}

process.env.DATABASE_URL = activeDbUrl;

const isRemote = process.env.DATABASE_URL.includes("supabase") || process.env.DATABASE_URL.includes("sslmode=require");
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(isRemote ? { ssl: { rejectUnauthorized: false } } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
