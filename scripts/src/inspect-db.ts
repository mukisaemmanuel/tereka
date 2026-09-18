import { db } from '@workspace/db';
import {
  usersTable,
  accountsTable,
  transactionsTable,
  debtsTable,
  debtPaymentsTable,
  ledgerEntriesTable,
} from '@workspace/db/schema';

async function inspectAllDatabaseData() {
  console.log('================================================================');
  console.log('🔍 CURRENT POSTGRESQL DATABASE DUMP');
  console.log('================================================================\n');

  const users = await db.select().from(usersTable);
  console.log(`📊 [usersTable] Total rows: ${users.length}`);
  console.table(users.map(u => ({ id: u.id, name: u.name, email: u.email, baseCurrency: u.baseCurrency, created: u.createdAt })));

  const accounts = await db.select().from(accountsTable);
  console.log(`\n📊 [accountsTable] Total rows: ${accounts.length}`);
  console.table(accounts.map(a => ({ id: a.id, userId: a.userId, name: a.name, type: a.type, opening: a.openingBalance, currency: a.currency })));

  const transactions = await db.select().from(transactionsTable);
  console.log(`\n📊 [transactionsTable] Total rows: ${transactions.length}`);
  console.table(transactions.map(t => ({ id: t.id, userId: t.userId, type: t.type, amount: t.amount, desc: t.description, date: t.transactionDate })));

  const debts = await db.select().from(debtsTable);
  console.log(`\n📊 [debtsTable] Total rows: ${debts.length}`);
  console.table(debts.map(d => ({ id: d.id, userId: d.userId, person: d.personOrEntity, type: d.type, principal: d.principalAmount, remaining: d.remainingAmount, status: d.status })));

  const payments = await db.select().from(debtPaymentsTable);
  console.log(`\n📊 [debtPaymentsTable] Total rows: ${payments.length}`);
  console.table(payments.map(p => ({ id: p.id, debtId: p.debtId, amount: p.amount, paidAt: p.paidAt })));

  const ledger = await db.select().from(ledgerEntriesTable);
  console.log(`\n📊 [ledgerEntriesTable] Total rows: ${ledger.length}`);
  console.table(ledger.slice(0, 15).map(l => ({ id: l.id, userId: l.userId, accId: l.accountId, dir: l.direction, amt: l.amount, txId: l.transactionId })));

  process.exit(0);
}

inspectAllDatabaseData().catch(err => {
  console.error(err);
  process.exit(1);
});
