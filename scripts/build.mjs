import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

console.log("[Tereka Build] Starting frontend build...");
execSync("pnpm --filter @workspace/tereka run build", { stdio: "inherit" });

const srcDir = path.resolve("artifacts/tereka/dist");
const destDir = path.resolve("dist");

console.log(`[Tereka Build] Copying output from ${srcDir} to ${destDir}...`);
fs.mkdirSync(destDir, { recursive: true });
fs.cpSync(srcDir, destDir, { recursive: true });

console.log("[Tereka Build] Build completed successfully. Output files in dist:");
console.log(fs.readdirSync(destDir));
