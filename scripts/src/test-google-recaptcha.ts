import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
try {
  process.loadEnvFile(path.resolve(__dirname, '../../.env'));
} catch (e) {
  // If .env file not found or already loaded, continue
}

async function main() {
  const { db, usersTable, accountsTable, transactionsTable } = await import('@workspace/db');
  const appModule = await import('../../artifacts/api-server/src/app' as any);
  const app = appModule.default;
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`================================================================`);
  console.log(`🧪 TESTING GOOGLE OAUTH & RECAPTCHA VERIFICATION ON PORT ${port}`);
  console.log(`================================================================\n`);

  // Test 1: POST /api/auth/register fails without reCAPTCHA token
  console.log('[1] Testing POST /api/auth/register without reCAPTCHA token (should fail)...');
  const failRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'No Captcha User',
      email: `nocaptcha.${Date.now()}@tereka.app`,
      password: 'Password123!',
      baseCurrency: 'UGX',
    }),
  });

  console.log(`    Status: ${failRes.status} (Expected: 400)`);
  if (failRes.status !== 400) {
    throw new Error(`Expected 400 for missing captcha token, got ${failRes.status}`);
  }
  const failData = (await failRes.json()) as any;
  console.log(`    Error message: "${failData.error}"`);

  // Test 2: POST /api/auth/register succeeds with valid test bypass reCAPTCHA token
  console.log('\n[2] Testing POST /api/auth/register with test reCAPTCHA token...');
  const successEmail = `recaptcha.${Date.now()}@tereka.app`;
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Verified Captcha User',
      email: successEmail,
      password: 'Password123!',
      baseCurrency: 'UGX',
      captchaToken: 'test-bypass-token',
    }),
  });

  if (!regRes.ok) {
    throw new Error(`Registration failed: ${regRes.status} ${await regRes.text()}`);
  }
  const regData = (await regRes.json()) as any;
  console.log(`    ✅ Registered successfully! User ID: ${regData.user.id}`);

  // Verify accounts created on registration: Cash, MTN MoMo, Airtel Money with balance 0
  const accRes = await fetch(`${baseUrl}/api/accounts`, {
    headers: { Authorization: `Bearer ${regData.token}` },
  });
  const accounts = (await accRes.json()) as any[];
  console.log('    Accounts initialized:', accounts.map((a: any) => ({ name: a.name, type: a.type, balance: a.balance })));
  if (accounts.length < 3) {
    throw new Error(`Expected at least 3 baseline accounts, got ${accounts.length}`);
  }
  for (const acc of accounts) {
    if (acc.balance !== 0) throw new Error(`Account ${acc.name} balance should be 0, got ${acc.balance}`);
  }

  // Test 3: POST /api/auth/google creates new user on first sign-in
  console.log('\n[3] Testing POST /api/auth/google for first-time sign-in...');
  const googleEmail = `google.user.${Date.now()}@gmail.com`;
  const googleRes = await fetch(`${baseUrl}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credential: `mock-google-token:${googleEmail}:Google New User`,
    }),
  });

  if (!googleRes.ok) {
    throw new Error(`Google Auth failed: ${googleRes.status} ${await googleRes.text()}`);
  }
  const googleData = (await googleRes.json()) as any;
  console.log(`    ✅ Google sign-in successful! User ID: ${googleData.user.id}, Token: ${googleData.token ? 'Present' : 'Missing'}`);
  console.log(`    Profile:`, googleData.profile);

  // Verify zero-baseline accounts for Google user
  const googleAccRes = await fetch(`${baseUrl}/api/accounts`, {
    headers: { Authorization: `Bearer ${googleData.token}` },
  });
  const googleAccounts = (await googleAccRes.json()) as any[];
  console.log('    Google user accounts initialized:', googleAccounts.map((a: any) => ({ name: a.name, type: a.type, balance: a.balance })));
  const accountNames = googleAccounts.map((a: any) => a.name);
  if (!accountNames.includes('Cash') || !accountNames.includes('MTN MoMo') || !accountNames.includes('Airtel Money')) {
    throw new Error(`Expected Cash, MTN MoMo, and Airtel Money accounts, got: ${accountNames.join(', ')}`);
  }
  for (const acc of googleAccounts) {
    if (acc.balance !== 0) throw new Error(`Google account ${acc.name} balance should be 0, got ${acc.balance}`);
  }

  // Verify zero mock transactions
  const googleTxs = await db.select().from(transactionsTable).where(eq(transactionsTable.userId, googleData.user.id));
  console.log(`    Google user transactions count in DB: ${googleTxs.length} (Expected: 0)`);
  if (googleTxs.length !== 0) {
    throw new Error(`Expected 0 mock transactions, found ${googleTxs.length}`);
  }

  // Test 4: POST /api/auth/google logs in existing user on subsequent sign-in
  console.log('\n[4] Testing POST /api/auth/google for subsequent sign-in with existing user...');
  const googleRes2 = await fetch(`${baseUrl}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credential: `mock-google-token:${googleEmail}:Google New User`,
    }),
  });

  if (!googleRes2.ok) {
    throw new Error(`Google re-login failed: ${googleRes2.status} ${await googleRes2.text()}`);
  }
  const googleData2 = (await googleRes2.json()) as any;
  if (googleData2.user.id !== googleData.user.id) {
    throw new Error(`User ID mismatch: expected ${googleData.user.id}, got ${googleData2.user.id}`);
  }
  console.log(`    ✅ Matched existing user ID: ${googleData2.user.id}`);

  console.log('\n================================================================');
  console.log('🎉 ALL GOOGLE OAUTH & RECAPTCHA VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');

  server.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
