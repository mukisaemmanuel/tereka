#!/usr/bin/env node

/**
 * ==============================================================================
 * TEREKA FINTECH - MTN MOMO SANDBOX AUTOMATED PROVISIONING
 * ==============================================================================
 * 
 * Automates the MTN Mobile Money developer sandbox onboarding:
 * 1. Generates a unique UUID v4 Reference ID for the API User.
 * 2. Provisions the API User on MTN MoMo Sandbox with callback host.
 * 3. Creates and retrieves the API Key for token generation.
 * 4. Outputs configuration and writes credentials to .env.
 * 
 * Usage:
 *   node scripts/setup-momo-sandbox.mjs
 *   node scripts/setup-momo-sandbox.mjs <YOUR_MOMO_SUBSCRIPTION_KEY>
 * ==============================================================================
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const envFilePath = path.join(rootDir, ".env");

/**
 * Lightweight .env parser
 */
function loadEnv() {
  if (fs.existsSync(envFilePath)) {
    const raw = fs.readFileSync(envFilePath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

/**
 * Update or append keys to .env
 */
function saveToEnv(updates) {
  let existingContent = "";
  if (fs.existsSync(envFilePath)) {
    existingContent = fs.readFileSync(envFilePath, "utf8");
  }

  const lines = existingContent.split("\n");
  const updatedKeys = new Set();

  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) return line;
    const key = trimmed.slice(0, eqIdx).trim();
    if (key in updates) {
      updatedKeys.add(key);
      return `${key}="${updates[key]}"`;
    }
    return line;
  });

  // Append keys that weren't in the file
  const toAppend = [];
  for (const [key, value] of Object.entries(updates)) {
    if (!updatedKeys.has(key)) {
      toAppend.push(`${key}="${value}"`);
    }
  }

  if (toAppend.length > 0) {
    if (newLines.length > 0 && newLines[newLines.length - 1].trim() !== "") {
      newLines.push("");
    }
    newLines.push("# MTN MoMo Sandbox Configuration");
    newLines.push(...toAppend);
  }

  fs.writeFileSync(envFilePath, newLines.join("\n").trim() + "\n", "utf8");
}

async function runProvisioning() {
  loadEnv();

  console.log("\n" + "=".repeat(70));
  console.log("  TEREKA FINTECH: MTN MOMO SANDBOX PROVISIONING");
  console.log("=".repeat(70) + "\n");

  const baseUrl = (process.env.MOMO_BASE_URL || "https://sandbox.momodeveloper.mtn.com").replace(/\/+$/, "");
  const callbackHost = process.env.MOMO_CALLBACK_HOST || "tereka-production.up.railway.app";
  const subscriptionKey = process.argv[2] || process.env.MOMO_SUBSCRIPTION_KEY;

  if (!subscriptionKey) {
    console.error("❌ ERROR: MOMO_SUBSCRIPTION_KEY is missing!\n");
    console.log("To provision your MTN MoMo sandbox environment:");
    console.log("  1. Visit the MTN Developer Portal: https://momodeveloper.mtn.com/");
    console.log("  2. Subscribe to the 'Collections' product in your developer profile.");
    console.log("  3. Copy your 'Primary Key' (Subscription Key).");
    console.log("  4. Re-run this script with the key:");
    console.log("       node scripts/setup-momo-sandbox.mjs <YOUR_SUBSCRIPTION_KEY>\n");
    console.log("     Or set it in your .env file: MOMO_SUBSCRIPTION_KEY=\"your_key\"\n");
    process.exit(1);
  }

  // 1. Generate UUID v4 Reference ID
  const referenceId = crypto.randomUUID();
  console.log(`[1/3] Generated API User Reference ID: ${referenceId}`);

  // 2. Step A: POST /v1_0/apiuser
  console.log(`[2/3] Provisioning API User at ${baseUrl}/v1_0/apiuser...`);
  const userPayload = { providerCallbackHost: callbackHost };

  try {
    const userRes = await fetch(`${baseUrl}/v1_0/apiuser`, {
      method: "POST",
      headers: {
        "X-Reference-Id": referenceId,
        "Ocp-Apim-Subscription-Key": subscriptionKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userPayload),
    });

    if (userRes.status !== 201 && userRes.status !== 200) {
      const errBody = await userRes.text();
      console.error(`❌ API User creation failed with status ${userRes.status} (${userRes.statusText}):`);
      console.error(`   ${errBody}\n`);
      process.exit(1);
    }
    console.log("      ✓ API User created successfully (HTTP 201 Created)");
  } catch (err) {
    console.error(`❌ Network error while creating API User: ${err.message}`);
    process.exit(1);
  }

  // 3. Step B: POST /v1_0/apiuser/{X-Reference-Id}/apikey
  console.log(`[3/3] Generating API Key for Reference ID ${referenceId}...`);
  let apiKey = null;

  try {
    const keyRes = await fetch(`${baseUrl}/v1_0/apiuser/${referenceId}/apikey`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": subscriptionKey,
      },
    });

    if (keyRes.status !== 201 && keyRes.status !== 200) {
      const errBody = await keyRes.text();
      console.error(`❌ API Key generation failed with status ${keyRes.status} (${keyRes.statusText}):`);
      console.error(`   ${errBody}\n`);
      process.exit(1);
    }

    const keyData = await keyRes.json();
    apiKey = keyData.apiKey;
    console.log("      ✓ API Key generated successfully (HTTP 201 Created)\n");
  } catch (err) {
    console.error(`❌ Network error while generating API Key: ${err.message}`);
    process.exit(1);
  }

  // 4. Output results and update .env
  const credentials = {
    MOMO_SUBSCRIPTION_KEY: subscriptionKey,
    MOMO_REFERENCE_ID: referenceId,
    MOMO_API_KEY: apiKey,
    MOMO_TARGET_ENV: "sandbox",
    MOMO_BASE_URL: baseUrl,
  };

  console.log("=" .repeat(70));
  console.log("  PROVISIONING COMPLETE - CONFIGURED ENVIRONMENT VARIABLES");
  console.log("=" .repeat(70));
  console.log(`MOMO_SUBSCRIPTION_KEY="${credentials.MOMO_SUBSCRIPTION_KEY}"`);
  console.log(`MOMO_REFERENCE_ID="${credentials.MOMO_REFERENCE_ID}"`);
  console.log(`MOMO_API_KEY="${credentials.MOMO_API_KEY}"`);
  console.log(`MOMO_TARGET_ENV="${credentials.MOMO_TARGET_ENV}"`);
  console.log(`MOMO_BASE_URL="${credentials.MOMO_BASE_URL}"`);
  console.log("=" .repeat(70) + "\n");

  try {
    saveToEnv(credentials);
    console.log(`💾 Successfully updated .env file at: ${envFilePath}`);
  } catch (err) {
    console.warn(`⚠️  Could not automatically write to .env: ${err.message}`);
    console.log("   Please copy the credentials above into your .env file manually.");
  }

  console.log("\nNext Step: Run the end-to-end collection test harness:");
  console.log("  node scripts/test-momo-collection.mjs\n");
}

runProvisioning().catch((err) => {
  console.error("Fatal error during sandbox setup:", err);
  process.exit(1);
});
