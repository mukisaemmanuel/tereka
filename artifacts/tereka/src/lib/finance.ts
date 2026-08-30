import type { Currency, Transaction } from '@workspace/api-client-react';

export const currencySymbols: Record<string, string> = {
  UGX: 'UGX',
  KES: 'KES',
  TZS: 'TZS',
  RWF: 'RWF',
  USD: '$',
};

export function money(value: number | null | undefined, currency: Currency | string = 'UGX') {
  const amount = Number(value || 0);
  return `${currencySymbols[currency] || currency} ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)}`;
}

export function compactMoney(value: number | null | undefined, currency: Currency | string = 'UGX') {
  const amount = Number(value || 0);
  const symbol = currencySymbols[currency] || currency;
  if (Math.abs(amount) >= 1000000) return `${symbol} ${(amount / 1000000).toFixed(1)}m`;
  if (Math.abs(amount) >= 1000) return `${symbol} ${(amount / 1000).toFixed(1)}k`;
  return money(amount, currency);
}

export function dateLabel(date?: string, long = false) {
  if (!date) return '—';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: long ? 'long' : 'short', year: long ? 'numeric' : undefined });
}

export function initials(name = 'Tereka user') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export function transactionIcon(transaction: Pick<Transaction, 'type' | 'categoryName'>) {
  if (transaction.type === 'income') return '↗';
  const name = transaction.categoryName?.toLowerCase() || '';
  if (name.includes('food') || name.includes('eat')) return '⌁';
  if (name.includes('transport')) return '→';
  if (name.includes('home') || name.includes('rent')) return '⌂';
  return '•';
}