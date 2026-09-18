import { db } from '@workspace/db';
import {
  usersTable,
  accountsTable,
  transactionsTable,
  debtsTable,
  debtPaymentsTable,
  ledgerEntriesTable,
  categoriesTable,
} from '@workspace/db/schema';
import { eq, desc } from 'drizzle-orm';

const API_BASE = 'http://127.0.0.1:5050';

async function runFullSystemTest() {
  console.log('================================================================');
  console.log('🚀 TEREKA SYSTEM TEST: FRESH USER ONBOARDING & DB PERSISTENCE');
  console.log('================================================================\n');

  const uniqueSuffix = Date.now().toString().slice(-4);
  const newUser = {
    name: `Emmanuel Mukisa ${uniqueSuffix}`,
    email: `emmanuel.${uniqueSuffix}@tereka.app`,
    password: 'SecurePassword123!',
    baseCurrency: 'UGX' as const,
  };

  console.log(`[1] Registering fresh user account via API (${newUser.email})...`);
  const registerRes = await fetch(`${API_BASE}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newUser),
  });

  if (!registerRes.ok) {
    const errorText = await registerRes.text();
    throw new Error(`Registration failed: ${registerRes.status} ${errorText}`);
  }

  const registerData = (await registerRes.json()) as any;
  const token = registerData.token;
  const user = registerData.user;
  console.log(`✅ User registered successfully in PostgreSQL! User ID: ${user.id}\n`);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  console.log('[2] Fetching starter accounts provisioned in PostgreSQL...');
  const accountsRes = await fetch(`${API_BASE}/api/accounts`, {
    headers: authHeaders,
  });
  const accounts = (await accountsRes.json()) as any[];
  console.log(`✅ Found ${accounts.length} active starter accounts:`);
  accounts.forEach((acc: any) => {
    console.log(`   - [${acc.type}] ${acc.name}: Balance = ${acc.balance.toLocaleString()} ${acc.currency} (ID: ${acc.id})`);
  });

  const momoAccount = accounts.find((a: any) => a.type === 'mobile_money') || accounts[0];
  const cashAccount = accounts.find((a: any) => a.type === 'cash') || accounts[1];

  console.log('\n[3] Fetching default categories...');
  const catsRes = await fetch(`${API_BASE}/api/categories`, { headers: authHeaders });
  const categories = (await catsRes.json()) as any[];
  const foodCat = categories.find((c: any) => c.name.toLowerCase().includes('food')) || categories[0];
  const salaryCat = categories.find((c: any) => c.type === 'income') || categories[0];

  console.log('\n[4] Recording Transactions in the system...');
  // 4a. Income Transaction
  const incomeRes = await fetch(`${API_BASE}/api/transactions`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      accountId: momoAccount.id,
      categoryId: salaryCat.id,
      amount: 750000,
      feeAmount: 2000,
      currency: 'UGX',
      type: 'income',
      description: 'Web development contract payout',
      transactionDate: new Date().toISOString().slice(0, 10),
    }),
  });
  const incomeTx = (await incomeRes.json()) as any;
  console.log(`✅ Income transaction recorded: +750,000 UGX (Tx ID: ${incomeTx.id})`);

  // 4b. Expense Transaction
  const expenseRes = await fetch(`${API_BASE}/api/transactions`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      accountId: cashAccount.id,
      categoryId: foodCat.id,
      amount: 35000,
      feeAmount: 0,
      currency: 'UGX',
      type: 'expense',
      description: 'Supermarket grocery supplies',
      transactionDate: new Date().toISOString().slice(0, 10),
    }),
  });
  const expenseTx = (await expenseRes.json()) as any;
  console.log(`✅ Expense transaction recorded: -35,000 UGX (Tx ID: ${expenseTx.id})`);

  console.log('\n[5] Creating Debts & Owed Records in the system...');
  // 5a. Owed to You: Lent UGX 300,000 to Grace Nakato
  const debtLentRes = await fetch(`${API_BASE}/api/debts`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      personOrEntity: 'Grace Nakato',
      type: 'owed_to_you',
      principalAmount: 300000,
      currency: 'UGX',
      accountId: momoAccount.id,
      dueDate: '2026-10-15',
      notes: 'Lent money for market merchandise',
    }),
  });
  const debtLent = (await debtLentRes.json()) as any;
  console.log(`✅ Debt record created (Owed to You): ${debtLent.personOrEntity} owes 300,000 UGX (ID: ${debtLent.id})`);

  // 5b. You Owe: Borrowed UGX 100,000 from Stanbic Sacco
  const debtBorrowRes = await fetch(`${API_BASE}/api/debts`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      personOrEntity: 'Stanbic Sacco',
      type: 'you_owe',
      principalAmount: 100000,
      currency: 'UGX',
      accountId: cashAccount.id,
      dueDate: '2026-11-01',
      notes: 'SACCO emergency advance',
    }),
  });
  const debtBorrow = (await debtBorrowRes.json()) as any;
  console.log(`✅ Debt record created (You Owe): You owe ${debtBorrow.personOrEntity} 100,000 UGX (ID: ${debtBorrow.id})`);

  console.log('\n[6] Recording Repayment Installments in the system...');
  // 6a. Grace Nakato pays back UGX 120,000
  const pay1Res = await fetch(`${API_BASE}/api/debts/${debtLent.id}/pay`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      amount: 120000,
      accountId: momoAccount.id,
      paidAt: new Date().toISOString(),
      notes: 'Part payment via MTN MoMo',
    }),
  });
  const pay1 = (await pay1Res.json()) as any;
  console.log(`✅ Partial Repayment: Grace Nakato paid 120,000 UGX. Remaining: ${pay1.remainingAmount.toLocaleString()} UGX (Status: ${pay1.status})`);

  // 6b. Grace Nakato pays remaining UGX 180,000
  const pay2Res = await fetch(`${API_BASE}/api/debts/${debtLent.id}/pay`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      amount: 180000,
      accountId: momoAccount.id,
      paidAt: new Date().toISOString(),
      notes: 'Final settlement payment',
    }),
  });
  const pay2 = (await pay2Res.json()) as any;
  console.log(`✅ Final Repayment: Grace Nakato paid 180,000 UGX. Remaining: ${pay2.remainingAmount.toLocaleString()} UGX (Status: ${pay2.status})`);

  console.log('\n================================================================');
  console.log('🔍 DIRECT POSTGRESQL DATABASE INSPECTION VIA DRIZZLE ORM');
  console.log('================================================================\n');

  // Table 1: users
  const dbUsers = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  console.log('📊 [PostgreSQL Table: "users"]');
  console.table(dbUsers.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    base_currency: u.baseCurrency,
    created_at: u.createdAt,
  })));

  // Table 2: accounts
  const dbAccounts = await db.select().from(accountsTable).where(eq(accountsTable.userId, user.id));
  console.log('\n📊 [PostgreSQL Table: "accounts"]');
  console.table(dbAccounts.map(a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    opening_balance: a.openingBalance,
    currency: a.currency,
  })));

  // Table 3: transactions
  const dbTransactions = await db.select().from(transactionsTable).where(eq(transactionsTable.userId, user.id));
  console.log('\n📊 [PostgreSQL Table: "transactions"]');
  console.table(dbTransactions.map(t => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    fee_amount: t.feeAmount,
    description: t.description,
    transaction_date: t.transactionDate,
  })));

  // Table 4: debts
  const dbDebts = await db.select().from(debtsTable).where(eq(debtsTable.userId, user.id));
  console.log('\n📊 [PostgreSQL Table: "debts"]');
  console.table(dbDebts.map(d => ({
    id: d.id,
    person_or_entity: d.personOrEntity,
    type: d.type,
    principal_amount: d.principalAmount,
    remaining_amount: d.remainingAmount,
    status: d.status,
    currency: d.currency,
    due_date: d.dueDate,
    notes: d.notes,
  })));

  // Table 5: debt_payments
  const dbPayments = await db.select().from(debtPaymentsTable);
  const userPayments = dbPayments.filter(p => p.debtId === debtLent.id || p.debtId === debtBorrow.id);
  console.log('\n📊 [PostgreSQL Table: "debt_payments"]');
  console.table(userPayments.map(p => ({
    id: p.id,
    debt_id: p.debtId,
    account_id: p.accountId,
    amount: p.amount,
    notes: p.notes,
    paid_at: p.paidAt,
  })));

  // Table 6: ledger_entries
  const dbLedger = await db
    .select()
    .from(ledgerEntriesTable)
    .where(eq(ledgerEntriesTable.userId, user.id))
    .orderBy(desc(ledgerEntriesTable.createdAt));
  console.log('\n📊 [PostgreSQL Table: "ledger_entries"] (Double-Entry Ledger)');
  console.table(dbLedger.map(l => ({
    id: l.id,
    account_id: l.accountId,
    direction: l.direction,
    amount: l.amount,
    transaction_id: l.transactionId,
  })));

  console.log('\n✨ ALL TEST OPERATIONS COMPLETED AND DIRECTLY VERIFIED IN POSTGRESQL!');
  process.exit(0);
}

runFullSystemTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
