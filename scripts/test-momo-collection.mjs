#!/usr/bin/env node

/**
 * ==============================================================================
 * TEREKA FINTECH - MTN MOMO END-TO-END COLLECTION TEST HARNESS
 * ==============================================================================
 * 
 * Tests the complete MTN MoMo Collection lifecycle against the sandbox:
 * 1. Authenticates using the provisioned API User and API Key.
 * 2. Obtains a scoped JWT Bearer Access Token.
 * 3. Triggers a simulated USSD push collection (`requesttopay`) for 10,000 EUR
 *    to the standard MTN Sandbox test MSISDN (256772123456).
 * 4. Polls the transaction status endpoint every 3 seconds (up to 5 attempts)
 *    and reports the live status to the terminal.
 * 
 * Usage:
 *   node scripts/test-momo-collection.mjs
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runCollectionTest() {
  loadEnv();

  console.log("\n" + "=".repeat(70));
  console.log("  TEREKA FINTECH: MTN MOMO COLLECTION TEST HARNESS");
  console.log("=".repeat(70) + "\n");

  const baseUrl = (process.env.MOMO_BASE_URL || "https://sandbox.momodeveloper.mtn.com").replace(/\/+$/, "");
  const subscriptionKey = process.env.MOMO_SUBSCRIPTION_KEY;
  const referenceId = process.env.MOMO_REFERENCE_ID;
  const apiKey = process.env.MOMO_API_KEY;
  const targetEnv = process.env.MOMO_TARGET_ENV || "sandbox";

  // Check required credentials
  const missing = [];
  if (!subscriptionKey) missing.push("MOMO_SUBSCRIPTION_KEY");
  if (!referenceId) missing.push("MOMO_REFERENCE_ID");
  if (!apiKey) missing.push("MOMO_API_KEY");

  if (missing.length > 0) {
    console.error("❌ ERROR: Missing required MoMo environment variables:");
    for (const m of missing) {
      console.error(`   - ${m}`);
    }
    console.log("\n💡 Solution: Run the automated provisioning script first to generate your keys:");
    console.log("   node scripts/setup-momo-sandbox.mjs <YOUR_MOMO_SUBSCRIPTION_KEY>\n");
    process.exit(1);
  }

  console.log("Configuration Context:");
  console.log(`  Base URL:           ${baseUrl}`);
  console.log(`  Target Environment: ${targetEnv}`);
  console.log(`  API User Ref ID:    ${referenceId}`);
  console.log(`  Subscription Key:   ${subscriptionKey.slice(0, 6)}...${subscriptionKey.slice(-4)}\n`);

  // --------------------------------------------------------------------------
  // Phase 1: Obtain Bearer Access Token
  // --------------------------------------------------------------------------
  console.log("[Phase 1/3] Exchanging credentials for Bearer Token...");
  const authHeader = `Basic ${Buffer.from(`${referenceId}:${apiKey}`).toString("base64")}`;
  let accessToken = null;
  let expiresIn = null;

  try {
    const tokenRes = await fetch(`${baseUrl}/collection/token/`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Ocp-Apim-Subscription-Key": subscriptionKey,
      },
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error(`❌ Token exchange failed with HTTP ${tokenRes.status} (${tokenRes.statusText}):`);
      console.error(`   ${errText}\n`);
      process.exit(1);
    }

    const tokenData = await tokenRes.json();
    accessToken = tokenData.access_token;
    expiresIn = tokenData.expires_in;

    console.log(`   ✓ Access token acquired successfully!`);
    console.log(`     Token Prefix: ${accessToken.slice(0, 20)}...`);
    console.log(`     Expires In:   ${expiresIn} seconds\n`);
  } catch (err) {
    console.error(`❌ Network failure during token acquisition: ${err.message}`);
    process.exit(1);
  }

  // --------------------------------------------------------------------------
  // Phase 2: Initiate Request-to-Pay (USSD Push Simulation)
  // --------------------------------------------------------------------------
  const txnReferenceId = crypto.randomUUID();
  const externalId = `tereka_txn_${Date.now()}`;
  const testPhone = "256772123456"; // MTN Sandbox Standard Test MSISDN
  const amount = "10000";
  const currency = "EUR"; // Standard currency for sandbox collection products

  console.log("[Phase 2/3] Initiating Request-to-Pay (USSD Push prompt)...");
  console.log(`  Transaction Ref ID: ${txnReferenceId}`);
  console.log(`  External ID:        ${externalId}`);
  console.log(`  Amount / Currency:  ${amount} ${currency}`);
  console.log(`  Payer Phone:        ${testPhone}\n`);

  const requestPayload = {
    amount,
    currency,
    externalId,
    payer: {
      partyIdType: "MSISDN",
      partyId: testPhone,
    },
    payerMessage: "Tereka Budget Deposit",
    payeeNote: "Tereka MoMo Test",
  };

  try {
    const payRes = await fetch(`${baseUrl}/collection/v1_0/requesttopay`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Reference-Id": txnReferenceId,
        "X-Target-Environment": targetEnv,
        "Ocp-Apim-Subscription-Key": subscriptionKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    if (payRes.status !== 202 && payRes.status !== 200) {
      const errText = await payRes.text();
      console.error(`❌ RequestToPay failed with HTTP ${payRes.status} (${payRes.statusText}):`);
      console.error(`   ${errText}\n`);
      process.exit(1);
    }

    console.log(`   ✓ Request-to-Pay accepted by MTN MoMo Gateway (HTTP ${payRes.status} Accepted)\n`);
  } catch (err) {
    console.error(`❌ Network failure during RequestToPay initiation: ${err.message}`);
    process.exit(1);
  }

  // --------------------------------------------------------------------------
  // Phase 3: Poll Transaction Status
  // --------------------------------------------------------------------------
  console.log("[Phase 3/3] Polling transaction status (up to 5 attempts every 3 seconds)...");
  const maxAttempts = 5;
  const pollIntervalMs = 3000;
  let finalStatus = "PENDING";
  let finalPayload = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(pollIntervalMs);

    try {
      const statusRes = await fetch(`${baseUrl}/collection/v1_0/requesttopay/${txnReferenceId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Target-Environment": targetEnv,
          "Ocp-Apim-Subscription-Key": subscriptionKey,
        },
      });

      if (!statusRes.ok) {
        const errText = await statusRes.text();
        console.warn(`   [Attempt ${attempt}/${maxAttempts}] HTTP ${statusRes.status} warning: ${errText}`);
        continue;
      }

      const statusData = await statusRes.json();
      finalPayload = statusData;
      finalStatus = statusData.status || "UNKNOWN";

      console.log(`   [Attempt ${attempt}/${maxAttempts}] Current Status: ${finalStatus}`);

      if (finalStatus === "SUCCESSFUL") {
        console.log(`   🎉 Transaction confirmed successful!`);
        break;
      } else if (finalStatus === "FAILED") {
        console.log(`   ⚠️  Transaction marked as FAILED by gateway.`);
        if (statusData.reason) {
          console.log(`      Reason: ${JSON.stringify(statusData.reason)}`);
        }
        break;
      }
    } catch (err) {
      console.warn(`   [Attempt ${attempt}/${maxAttempts}] Poll warning: ${err.message}`);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("  TEST SUMMARY RESULT");
  console.log("=".repeat(70));
  console.log(`  Reference ID:    ${txnReferenceId}`);
  console.log(`  External ID:     ${externalId}`);
  console.log(`  Target Phone:    ${testPhone}`);
  console.log(`  Amount:          ${amount} ${currency}`);
  console.log(`  Final Status:    ${finalStatus}`);
  if (finalPayload?.financialTransactionId) {
    console.log(`  Fin. Txn ID:     ${finalPayload.financialTransactionId}`);
  }
  console.log("=".repeat(70));

  if (finalStatus === "PENDING") {
    console.log("\nℹ️  Note on MTN MoMo Sandbox Behavior:");
    console.log("   In the sandbox environment, simulated USSD push requests typically remain in");
    console.log("   the PENDING state until a mock callback or manual approval is simulated via");
    console.log("   the sandbox gateway. The collection initiation was accepted successfully!\n");
  } else {
    console.log(`\n✓ End-to-end simulation completed with terminal status: ${finalStatus}\n`);
  }
}

runCollectionTest().catch((err) => {
  console.error("Fatal error during MoMo collection test harness:", err);
  process.exit(1);
});
