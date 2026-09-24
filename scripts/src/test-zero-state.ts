import http from 'node:http';
import { db, transactionsTable } from '@workspace/db';
import { eq } from 'drizzle-orm';

async function main() {
  const appModule = await import('../../artifacts/api-server/src/app' as any);
  const app = appModule.default;
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Testing zero-state baseline on port ${port}...`);

  const testEmail = `zerostate.${Date.now()}@tereka.app`;
  const registerPayload = {
    name: 'Zero State User',
    email: testEmail,
    password: 'Password123!',
    baseCurrency: 'UGX',
  };

  // 1. POST /api/register
  console.log('[1] Calling POST /api/register...');
  const regRes = await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registerPayload),
  });

  if (!regRes.ok) {
    console.error('Registration failed:', await regRes.text());
    process.exit(1);
  }

  const regData = (await regRes.json()) as any;
  const token = regData.token;
  const userId = regData.user.id;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  console.log(`[+] User registered with ID: ${userId}`);

  // 2. Check accounts via GET /api/accounts
  console.log('[2] Calling GET /api/accounts...');
  const accRes = await fetch(`${baseUrl}/api/accounts`, { headers: authHeaders });
  const accounts = (await accRes.json()) as any[];
  console.log('    Accounts received:', accounts.map((a: any) => ({ name: a.name, type: a.type, balance: a.balance })));

  if (accounts.length !== 2) throw new Error(`Expected 2 default accounts, got ${accounts.length}`);
  for (const acc of accounts) {
    if (acc.balance !== 0) throw new Error(`Account balance should be 0, got ${acc.balance}`);
  }

  // 3. Check transactions in DB
  console.log('[3] Checking transactions in DB...');
  const userTxs = await db.select().from(transactionsTable).where(eq(transactionsTable.userId, userId));
  console.log(`    Transactions in DB for new user: ${userTxs.length}`);
  if (userTxs.length !== 0) throw new Error(`Expected 0 transactions for newly registered user, found ${userTxs.length}`);

  // 4. Check GET /api/dashboard/summary
  console.log('[4] Calling GET /api/dashboard/summary...');
  const dashRes = await fetch(`${baseUrl}/api/dashboard/summary`, { headers: authHeaders });
  const summary = (await dashRes.json()) as any;
  console.log('    Dashboard summary on zero state:', {
    totalBalance: summary.totalBalance,
    monthlyIncome: summary.monthlyIncome,
    monthlyExpenses: summary.monthlyExpenses,
    incomeThisMonth: summary.incomeThisMonth,
    spentThisMonth: summary.spentThisMonth,
    balanceChange: summary.balanceChange,
  });

  if (summary.totalBalance !== 0) throw new Error(`totalBalance should be 0, got ${summary.totalBalance}`);
  if (summary.incomeThisMonth !== 0) throw new Error(`incomeThisMonth should be 0, got ${summary.incomeThisMonth}`);
  if (summary.spentThisMonth !== 0) throw new Error(`spentThisMonth should be 0, got ${summary.spentThisMonth}`);
  if (summary.monthlyIncome !== 0) throw new Error(`monthlyIncome should be 0, got ${summary.monthlyIncome}`);
  if (summary.monthlyExpenses !== 0) throw new Error(`monthlyExpenses should be 0, got ${summary.monthlyExpenses}`);
  if (summary.balanceChange !== 0) throw new Error(`balanceChange should be 0, got ${summary.balanceChange}`);

  // 5. Test strict Income This Month calculation with an income transaction
  console.log('[5] Testing strict income calculation...');
  const cashAcc = accounts.find((a: any) => a.type === 'cash') || accounts[0];
  const catRes = await fetch(`${baseUrl}/api/categories`, { headers: authHeaders });
  const categories = (await catRes.json()) as any[];
  const salaryCat = categories.find((c: any) => c.type === 'income') || categories[0];
  const foodCat = categories.find((c: any) => c.type === 'expense') || categories[0];

  const todayStr = new Date().toISOString().slice(0, 10);

  const tx1Res = await fetch(`${baseUrl}/api/transactions`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      accountId: cashAcc.id,
      categoryId: salaryCat.id,
      amount: 150000,
      feeAmount: 0,
      currency: 'UGX',
      type: 'income',
      description: 'Freelance design payment',
      transactionDate: todayStr,
    }),
  });
  if (!tx1Res.ok) throw new Error(`Failed to create income tx: ${await tx1Res.text()}`);

  const dashRes2 = await fetch(`${baseUrl}/api/dashboard/summary`, { headers: authHeaders });
  const summary2 = (await dashRes2.json()) as any;
  console.log('    After 150,000 UGX income:', {
    incomeThisMonth: summary2.incomeThisMonth,
    spentThisMonth: summary2.spentThisMonth,
    totalBalance: summary2.totalBalance,
  });

  if (summary2.incomeThisMonth !== 150000) throw new Error(`incomeThisMonth should be 150000, got ${summary2.incomeThisMonth}`);
  if (summary2.spentThisMonth !== 0) throw new Error(`spentThisMonth should still be 0, got ${summary2.spentThisMonth}`);

  // 6. Test strict Spent This Month calculation with an expense transaction
  console.log('[6] Testing strict expense calculation...');
  const tx2Res = await fetch(`${baseUrl}/api/transactions`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      accountId: cashAcc.id,
      categoryId: foodCat.id,
      amount: 25000,
      feeAmount: 500,
      currency: 'UGX',
      type: 'expense',
      description: 'Lunch at Cafe Javas',
      transactionDate: todayStr,
    }),
  });
  if (!tx2Res.ok) throw new Error(`Failed to create expense tx: ${await tx2Res.text()}`);

  const dashRes3 = await fetch(`${baseUrl}/api/dashboard/summary`, { headers: authHeaders });
  const summary3 = (await dashRes3.json()) as any;
  console.log('    After 25,000 UGX expense (+ 500 fee):', {
    incomeThisMonth: summary3.incomeThisMonth,
    spentThisMonth: summary3.spentThisMonth,
    totalBalance: summary3.totalBalance,
  });

  if (summary3.incomeThisMonth !== 150000) throw new Error(`incomeThisMonth should be 150000, got ${summary3.incomeThisMonth}`);
  if (summary3.spentThisMonth !== 25500) throw new Error(`spentThisMonth should be 25500, got ${summary3.spentThisMonth}`);

  console.log('\n================================================================');
  console.log('🎉 ALL ZERO-STATE AND DASHBOARD VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('================================================================');

  server.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
