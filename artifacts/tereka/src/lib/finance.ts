/**
 * ==============================================================================
 * TEREKA FINANCIAL INTELLIGENCE - FRONTEND FINANCE UTILITIES
 * ==============================================================================
 * 
 * This file is the primary utility hub for all financial and UI presentation
 * formatting across the Tereka application.
 * 
 * Key Responsibilities:
 * 1. Currency Formatting & Decimal Rules (East African Community & Global standard)
 * 2. Compact Money Abbreviation (e.g., "UGX 1.5m", "KES 4.5k") for dashboard metrics
 * 3. Localized Date Formatting (UK / East Africa standard)
 * 4. User Avatar Initials Generator
 * 5. Category-Aware Micro-Icon Mapping for transaction feeds
 */

import type { Currency, Transaction } from '@workspace/api-client-react';

/**
 * ------------------------------------------------------------------------------
 * 1. CURRENCY SYMBOLS DICTIONARY
 * ------------------------------------------------------------------------------
 */
export const currencySymbols: Record<string, string> = {
  UGX: 'UGX',
};

/**
 * ------------------------------------------------------------------------------
 * 2. PRIMARY CURRENCY FORMATTER (`formatCurrency`)
 * ------------------------------------------------------------------------------
 * Formats numeric monetary amounts locked strictly to Ugandan Shillings (UGX)
 * with zero decimal places (e.g., "UGX 1,450,000").
 * 
 * @param amount - Numeric value to format (safe with null, undefined, or strings)
 * @returns Formatted currency string, e.g. "UGX 250,000"
 */
export function formatCurrency(
  amount: number | null | undefined,
  _currency?: Currency | string
): string {
  const numericAmount = Number(amount || 0);
  return 'UGX ' + Math.round(numericAmount).toLocaleString('en-US');
}

/**
 * ------------------------------------------------------------------------------
 * 3. SHORTCUT MONEY ALIAS (`money`)
 * ------------------------------------------------------------------------------
 * Convenience alias for `formatCurrency`.
 * Example: `money(50000)` -> "UGX 50,000"
 */
export function money(
  value: number | null | undefined,
  _currency?: Currency | string
): string {
  return formatCurrency(value);
}

/**
 * ------------------------------------------------------------------------------
 * 4. COMPACT MONEY FORMATTER (`compactMoney`)
 * ------------------------------------------------------------------------------
 * Abbreviates large UGX monetary values into human-friendly metrics for stat cards,
 * badges, and mobile screens where horizontal space is constrained.
 * 
 * Examples:
 * - 6,800,000 -> "UGX 6.8m"
 * - 45,000    -> "UGX 45.0k"
 * - 800       -> "UGX 800"
 * 
 * @param value - Amount to compress
 */
export function compactMoney(
  value: number | null | undefined,
  _currency?: Currency | string
): string {
  const amount = Number(value || 0);

  // Values >= 1 Million (e.g. UGX 1.5m)
  if (Math.abs(amount) >= 1000000) {
    return `UGX ${(amount / 1000000).toFixed(1)}m`;
  }

  // Values >= 1 Thousand (e.g. UGX 50.0k)
  if (Math.abs(amount) >= 1000) {
    return `UGX ${(amount / 1000).toFixed(1)}k`;
  }

  // Fallback to full format for smaller numbers
  return formatCurrency(amount);
}

/**
 * ------------------------------------------------------------------------------
 * 5. DATE FORMATTER (`dateLabel`)
 * ------------------------------------------------------------------------------
 * Converts ISO date strings into readable day/month/year format (en-GB standard).
 * 
 * Examples:
 * - `dateLabel("2026-08-28")`        -> "28 Aug"
 * - `dateLabel("2026-08-28", true)`  -> "28 August 2026"
 * 
 * @param date - ISO date string or undefined
 * @param long - If true, outputs full month name and 4-digit year
 */
export function dateLabel(date?: string, long = false): string {
  if (!date) return '—';

  const parsed = new Date(date);
  // Return original text if parsing fails
  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: long ? 'long' : 'short',
    year: long ? 'numeric' : undefined,
  });
}

/**
 * ------------------------------------------------------------------------------
 * 6. USER AVATAR INITIALS (`initials`)
 * ------------------------------------------------------------------------------
 * Extracts the first letters of a user's first and last name for circular
 * avatar badges in the sidebar and header.
 * 
 * Example:
 * - "Emmanuel Mukisa" -> "EM"
 * - "Tereka User"     -> "TU"
 * 
 * @param name - Full name of the user
 */
export function initials(name = 'Tereka user'): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/**
 * ------------------------------------------------------------------------------
 * 7. TRANSACTION MICRO-ICON SELECTOR (`transactionIcon`)
 * ------------------------------------------------------------------------------
 * Determines a contextual micro-icon or glyph for transaction rows based on
 * transaction type and semantic category keywords.
 * 
 * Mappings:
 * - Income               -> ↗ (Outward arrow / green in UI)
 * - Food / Dining        -> ⌁
 * - Transport / Boda-boda-> →
 * - Housing / Rent       -> ⌂
 * - Utilities / Yaka     -> ⚡ (Lightning bolt)
 * - Tariffs / MoMo Fees  -> 🏷 (Tag)
 * - Generic Fallback     -> •
 * 
 * @param transaction - Transaction object with type and categoryName
 */
export function transactionIcon(
  transaction: Pick<Transaction, 'type' | 'categoryName'>
): string {
  // 1. Inward money flows always receive an income indicator
  if (transaction.type === 'income') return '↗';

  // 2. Semantic matching for expenses
  const name = transaction.categoryName?.toLowerCase() || '';

  if (name.includes('food') || name.includes('eat') || name.includes('grocer')) return '⌁';
  if (name.includes('transport') || name.includes('boda') || name.includes('fuel')) return '→';
  if (name.includes('home') || name.includes('rent') || name.includes('house')) return '⌂';
  if (name.includes('utilit') || name.includes('yaka') || name.includes('power') || name.includes('water')) return '⚡';
  if (name.includes('fee') || name.includes('tariff') || name.includes('tax')) return '🏷';

  return '•';
}