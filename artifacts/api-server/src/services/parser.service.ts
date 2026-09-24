/**
 * ==============================================================================
 * TEREKA FINANCIAL INTELLIGENCE - UGANDAN TRANSACTION PARSER SERVICE
 * ==============================================================================
 * 
 * High-precision parsing engine for:
 * 1. MTN MoMo Uganda SMS (Received, Paid, Transferred, Fees, Balances, Txn IDs)
 * 2. Airtel Money Uganda SMS (Sent, Paid, Received, Charges, Balances, Trans IDs)
 * 3. Natural Language Shorthand (e.g. "Spent 15k on lunch via cash", "Boda 5k")
 * 4. Automatic categorization tailored to the Ugandan economic context.
 */

export type TransactionSource = "MTN_MOMO" | "AIRTEL_MONEY" | "NATURAL_LANGUAGE" | "GENERIC_SMS";

export type TransactionType = "income" | "expense";

export type PaymentMethod = "MTN MoMo" | "Airtel Money" | "Cash" | "Bank" | "Other";

export interface ParsedTransaction {
  source: TransactionSource;
  type: TransactionType;
  amount: number;
  currency: string;
  category: string;
  confidence: number; // 0.0 to 1.0
  description: string;
  counterparty?: string;
  feeAmount?: number;
  balance?: number;
  referenceId?: string;
  transactionDate?: string;
  paymentMethod?: PaymentMethod;
  rawText: string;
}

/**
 * Category keywords tailored to Uganda
 */
const CATEGORY_MAP: Record<string, string[]> = {
  "Transport": [
    "fuel", "petrol", "diesel", "total", "totalenergies", "shell", "engen", "stabex", "rubis", "city oil", "hass",
    "boda", "safeboda", "uber", "bolt", "taxi", "matatu", "fare", "transport", "parking",
    "car service", "car wash", "garage", "mechanic", "tyre", "expressway"
  ],
  "Food": [
    "lunch", "dinner", "breakfast", "food", "restaurant", "cafe", "groceries", "supermarket",
    "market", "snack", "coffee", "javas", "cafe javas", "kfc", "pizza", "rolex", "pork",
    "meat", "beef", "chicken", "fish", "vegetables", "bread", "takeaway", "drinks", "bar",
    "club", "bakery", "carrefour", "capital shoppers", "quality supermarket"
  ],
  "Rent": [
    "rent", "landlord", "hostel", "apartment", "quarterly rent", "monthly rent", "tenancy",
    "housing", "estate", "broker"
  ],
  "Utilities": [
    "umeme", "yaka", "nwsc", "water", "electricity", "power", "dstv", "gotv", "startimes",
    "azatv", "wifi", "internet", "airtime", "data", "bundle", "garbage", "waste", "sewage",
    "solarpower", "zuku"
  ],
  "Salary": [
    "salary", "allowance", "stipend", "wage", "freelance", "bonus", "dividend", "payroll",
    "net pay", "remuneration", "commission"
  ],
  "Health": [
    "hospital", "clinic", "pharmacy", "drugs", "medicine", "doctor", "consultation", "lab",
    "dental", "optical", "medication", "first pharmacy", "friecca"
  ],
  "Education": [
    "school fees", "tuition", "fees", "uniform", "books", "stationery", "exam", "admission"
  ],
  "Savings & Investments": [
    "sacco", "investment", "shares", "unit trust", "treasury", "bonds", "chama", "savings",
    "tereka vault", "tereka", "deposit to bank"
  ],
};

export class ParserService {
  /**
   * Main entry point: Parses an input text (SMS or natural language note).
   */
  public parse(rawText: string): ParsedTransaction | null {
    if (!rawText || typeof rawText !== "string") return null;

    const trimmed = rawText.trim();
    if (!trimmed) return null;

    // Detect if this is an official Airtel Money notification
    const hasAirtelIndicator = /Airtel/i.test(trimmed) || /Trans(?:\.|\s*)ID:/i.test(trimmed);
    // Detect if this is an official MTN MoMo notification
    const hasMtnIndicator = /Y'ello/i.test(trimmed) || /Financial Transaction Id:/i.test(trimmed) || /\bMoMo\b/i.test(trimmed);

    // 1. Try Airtel if indicators match
    if (hasAirtelIndicator) {
      const airtelResult = this.parseAirtelMoney(trimmed);
      if (airtelResult) return airtelResult;
    }

    // 2. Try MTN MoMo if indicators match or if standard carrier phrases exist
    if (hasMtnIndicator || /(?:You have received|You have paid|transferred to|Cash Out of)\s+(?:UGX|Shs|USh)?\s*[\d,]+/i.test(trimmed)) {
      const mtnResult = this.parseMtnMoMo(trimmed);
      if (mtnResult) return mtnResult;
    }

    // 3. If Airtel wasn't tested yet, try Airtel
    if (!hasAirtelIndicator) {
      const airtelResult = this.parseAirtelMoney(trimmed);
      if (airtelResult) return airtelResult;
    }

    // 4. Try Natural Language Shorthand (e.g. "Spent 15k on lunch via cash", "Boda 5k")
    const nlResult = this.parseNaturalLanguage(trimmed);
    if (nlResult) return nlResult;

    // 5. Fallback Generic SMS Parser (checks for amount + keyword)
    return this.parseGenericSms(trimmed);
  }

  /**
   * --------------------------------------------------------------------------
   * 1. MTN MoMo Uganda Parser
   * --------------------------------------------------------------------------
   */
  private parseMtnMoMo(text: string): ParsedTransaction | null {
    // Shared extractor helpers
    const feeAmount = this.extractFee(text);
    const balance = this.extractBalance(text);
    const referenceId = this.extractFinancialTxId(text) || this.extractRefText(text);
    const transactionDate = this.extractDate(text);

    // Case 1: Received Money (Income)
    // "You have received UGX 50,000 from JOHN DOE (256772123456) on 2024-03-20 14:30:15. Reference: Rent March. Financial Transaction Id: 12345678901. New Balance: UGX 150,000."
    const recvMatch = text.match(/(?:You have received|received)\s+(?:UGX|Shs|USh)?\s*([\d,]+(?:\.\d+)?)\s+from\s+([^.]+?)(?:\s+\bon\b\s+[\d-]+\s+[\d:]+|\.|$)/i);
    if (recvMatch && !/transferred to/i.test(text)) {
      const amount = this.cleanNumber(recvMatch[1]);
      if (amount > 0) {
        const counterparty = this.cleanCounterparty(recvMatch[2]);
        const refMatch = text.match(/Reference:\s*([^.]+)/i);
        const refText = refMatch ? refMatch[1].trim() : undefined;
        const desc = refText ? `Received: ${refText}` : `Received from ${counterparty || "Sender"}`;

        return {
          source: "MTN_MOMO",
          type: "income",
          amount,
          currency: "UGX",
          category: this.categorize(`${refText || ""} ${counterparty || ""}`, "income"),
          confidence: 0.98,
          description: desc,
          counterparty,
          feeAmount: 0,
          balance,
          referenceId,
          transactionDate,
          paymentMethod: "MTN MoMo",
          rawText: text,
        };
      }
    }

    // Case 2: Paid to Merchant / Business / MoMoPay / Utility (Expense)
    // "You have paid UGX 12,000 to TOTAL ENGEN (123456) on 2024-03-21 16:45:00. Fee was UGX 0. New Balance: UGX 138,000. Financial Transaction Id: 9988776655. Ref: Fuel."
    // "Payment of UGX 25,000 to UMEME YAKA completed. Fee: UGX 500. New Balance: UGX 74,500. Financial Transaction Id: 11223344."
    const paidMatch = text.match(/(?:You have paid|Payment of|UGX\s*[\d,]+\s*paid to)\s+(?:UGX|Shs|USh)?\s*([\d,]+(?:\.\d+)?)\s+to\s+([^.]+?)(?:\s+\bon\b\s+[\d-]+\s+[\d:]+|\s+completed|\.|$)/i);
    if (paidMatch) {
      const amount = this.cleanNumber(paidMatch[1]);
      if (amount > 0) {
        const counterparty = this.cleanCounterparty(paidMatch[2]);
        const refKeyword = this.extractRefText(text);
        const desc = counterparty ? `Paid to ${counterparty}` : (refKeyword ? `Paid: ${refKeyword}` : "Merchant Payment");

        return {
          source: "MTN_MOMO",
          type: "expense",
          amount,
          currency: "UGX",
          category: this.categorize(`${counterparty || ""} ${refKeyword || ""}`, "expense"),
          confidence: 0.98,
          description: desc,
          counterparty,
          feeAmount,
          balance,
          referenceId,
          transactionDate,
          paymentMethod: "MTN MoMo",
          rawText: text,
        };
      }
    }

    // Case 3: Transferred to person (P2P Transfer Expense)
    // "UGX 20,000 transferred to JANE SMITH (256789123456) on 2024-03-22 09:15:00. Fee was UGX 1,000. New Balance: UGX 117,000. Financial Transaction Id: 3344556677."
    const transferMatch = text.match(/(?:(?:UGX|Shs|USh)?\s*([\d,]+(?:\.\d+)?)\s*transferred to|You have transferred\s+(?:UGX|Shs|USh)?\s*([\d,]+(?:\.\d+)?)\s+to)\s+([^.]+?)(?:\s+\bon\b\s+[\d-]+\s+[\d:]+|\.|$)/i);
    if (transferMatch) {
      const amount = this.cleanNumber(transferMatch[1] || transferMatch[2]);
      if (amount > 0) {
        const counterparty = this.cleanCounterparty(transferMatch[3]);
        const refKeyword = this.extractRefText(text);

        return {
          source: "MTN_MOMO",
          type: "expense",
          amount,
          currency: "UGX",
          category: this.categorize(`${counterparty || ""} ${refKeyword || ""}`, "expense"),
          confidence: 0.98,
          description: `Transfer to ${counterparty || "Recipient"}`,
          counterparty,
          feeAmount,
          balance,
          referenceId,
          transactionDate,
          paymentMethod: "MTN MoMo",
          rawText: text,
        };
      }
    }

    // Case 4: Cash Out / Withdrawal from Agent (Expense)
    // "Cash Out of UGX 100,000 from agent KISENYI AGENT (256770000000) was successful. Fee was UGX 3,500. New Balance: UGX 46,500. Financial Transaction Id: 8877665544."
    const cashOutMatch = text.match(/(?:Cash Out of|withdrawn)\s+(?:UGX|Shs|USh)?\s*([\d,]+(?:\.\d+)?)\s+(?:from\s+(?:agent\s+)?([^.]+?))?\s*was successful/i);
    if (cashOutMatch) {
      const amount = this.cleanNumber(cashOutMatch[1]);
      if (amount > 0) {
        const agent = this.cleanCounterparty(cashOutMatch[2]);

        return {
          source: "MTN_MOMO",
          type: "expense",
          amount,
          currency: "UGX",
          category: "Cash Out",
          confidence: 0.98,
          description: `Cash Out via Agent ${agent || ""}`.trim(),
          counterparty: agent,
          feeAmount,
          balance,
          referenceId,
          transactionDate,
          paymentMethod: "MTN MoMo",
          rawText: text,
        };
      }
    }

    return null;
  }

  /**
   * --------------------------------------------------------------------------
   * 2. Airtel Money Uganda Parser
   * --------------------------------------------------------------------------
   */
  private parseAirtelMoney(text: string): ParsedTransaction | null {
    // Shared extractor helpers
    const feeAmount = this.extractFee(text);
    const balance = this.extractBalance(text);
    const referenceId = this.extractTransId(text);
    const transactionDate = this.extractDate(text);

    // Case 1: Received money (Income)
    // "Trans ID: MP240321.1430.H12345. You have received UGX 40,000 from ALICE NAKATO (0752123456) on 2024-03-21 14:30. New Airtel Money balance: UGX 120,000."
    const recvMatch = text.match(/You have received\s+(?:UGX|Shs|USh)?\s*([\d,]+(?:\.\d+)?)\s+from\s+([^.]+?)(?:\s+\bon\b\s+[\d-]+\s+[\d:]+|\.|$)/i);
    if (recvMatch) {
      const amount = this.cleanNumber(recvMatch[1]);
      if (amount > 0) {
        const counterparty = this.cleanCounterparty(recvMatch[2]);

        return {
          source: "AIRTEL_MONEY",
          type: "income",
          amount,
          currency: "UGX",
          category: this.categorize(counterparty || "Income", "income"),
          confidence: 0.98,
          description: `Received from ${counterparty || "Sender"}`,
          counterparty,
          feeAmount: 0,
          balance,
          referenceId,
          transactionDate,
          paymentMethod: "Airtel Money",
          rawText: text,
        };
      }
    }

    // Case 2: Sent or Paid (Expense)
    // "Trans ID: MP240322.0915.A54321. UGX 15,000 sent to BOB KATO (256702223344) on 2024-03-22 09:15. Charge: UGX 800. Balance: UGX 104,200."
    // "Trans. ID: MP240322.1200.C99887. UGX 35,000 paid to SHELL KIKONI. Charge: UGX 0. New Balance: UGX 69,200. Info: Fuel."
    // "Payment of UGX 18,500 to NWSC was successful. Charge: UGX 500. Balance: UGX 50,200."
    const sentPaidMatch = text.match(/(?:(?:UGX|Shs|USh)?\s*([\d,]+(?:\.\d+)?)\s*(?:sent|paid)\s*to|Payment of\s*(?:UGX|Shs|USh)?\s*([\d,]+(?:\.\d+)?)\s*to|You have (?:sent|paid)\s*(?:UGX|Shs|USh)?\s*([\d,]+(?:\.\d+)?)\s*to)\s+([^.]+?)(?:\s+\bon\b\s+[\d-]+\s+[\d:]+|\s+was successful|\.|$)/i);
    if (sentPaidMatch) {
      const amount = this.cleanNumber(sentPaidMatch[1] || sentPaidMatch[2] || sentPaidMatch[3]);
      if (amount > 0) {
        const counterparty = this.cleanCounterparty(sentPaidMatch[4]);
        const infoMatch = text.match(/Info:\s*([^.]+)/i);
        const infoText = infoMatch ? infoMatch[1].trim() : "";
        const desc = counterparty ? `Paid to ${counterparty}` : (infoText || "Airtel Money Payment");

        return {
          source: "AIRTEL_MONEY",
          type: "expense",
          amount,
          currency: "UGX",
          category: this.categorize(`${counterparty || ""} ${infoText}`, "expense"),
          confidence: 0.98,
          description: desc,
          counterparty,
          feeAmount,
          balance,
          referenceId,
          transactionDate,
          paymentMethod: "Airtel Money",
          rawText: text,
        };
      }
    }

    // Case 3: Withdrawn from Agent
    const withMatch = text.match(/withdrawn\s+(?:UGX|Shs|USh)?\s*([\d,]+(?:\.\d+)?)\s+from\s+(?:Agent\s+)?([^.]+?)(?:\s+\bon\b|\.|$)/i);
    if (withMatch) {
      const amount = this.cleanNumber(withMatch[1]);
      if (amount > 0) {
        const agent = this.cleanCounterparty(withMatch[2]);

        return {
          source: "AIRTEL_MONEY",
          type: "expense",
          amount,
          currency: "UGX",
          category: "Cash Out",
          confidence: 0.98,
          description: `Cash Out via Agent ${agent || ""}`.trim(),
          counterparty: agent,
          feeAmount,
          balance,
          referenceId,
          transactionDate,
          paymentMethod: "Airtel Money",
          rawText: text,
        };
      }
    }

    return null;
  }

  /**
   * --------------------------------------------------------------------------
   * 3. Natural Language Shorthand Parser
   * --------------------------------------------------------------------------
   * Parses notes like:
   * - "Spent 15k on lunch via cash"
   * - "Paid 50k for fuel using momo"
   * - "Got 200k from freelancing"
   * - "Boda 5k"
   * - "Lunch 12k"
   * - "Received 500,000 as salary into bank"
   */
  private parseNaturalLanguage(text: string): ParsedTransaction | null {
    // Detect type (income vs expense)
    const isIncome = /\b(got|received|earned|income|salary|dividend|refund|credited)\b/i.test(text);
    const type: TransactionType = isIncome ? "income" : "expense";

    // Extract amount: e.g. 15k, 1.5m, 50,000, 20000
    const amountData = this.extractShorthandAmount(text);
    if (!amountData) return null;

    const { amount, currency } = amountData;

    // Detect Payment Method
    let paymentMethod: PaymentMethod = "Cash";
    if (/\b(momo|mtn)\b/i.test(text)) {
      paymentMethod = "MTN MoMo";
    } else if (/\b(airtel)\b/i.test(text)) {
      paymentMethod = "Airtel Money";
    } else if (/\b(bank|card|visa|mastercard|stanbic|centenary|dfcu|absa)\b/i.test(text)) {
      paymentMethod = "Bank";
    } else if (/\bcash\b/i.test(text)) {
      paymentMethod = "Cash";
    }

    // Clean description: remove verbs, prepositions, channels, and amounts
    let cleanDesc = text
      .replace(/\b(spent|paid|used|cost|got|received|earned|deposit|bought)\b/gi, "")
      .replace(/\b(via|using|by|through|with|for|on|as|into|from|at)\b/gi, "")
      .replace(/\b(cash|momo|mtn|airtel|bank)\b/gi, "")
      .replace(/(?:UGX|Shs|USh)?\s*\d+(?:\.\d+)?\s*[kKmMbB]?/gi, "")
      .replace(/[,\-_.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanDesc || cleanDesc.length < 2) {
      cleanDesc = type === "income" ? "Income Deposit" : "Expense";
    } else {
      cleanDesc = cleanDesc.charAt(0).toUpperCase() + cleanDesc.slice(1);
    }

    const category = this.categorize(text, type);

    return {
      source: "NATURAL_LANGUAGE",
      type,
      amount,
      currency,
      category,
      confidence: 0.9,
      description: cleanDesc,
      paymentMethod,
      rawText: text,
    };
  }

  /**
   * --------------------------------------------------------------------------
   * 4. Generic SMS Fallback Parser
   * --------------------------------------------------------------------------
   */
  private parseGenericSms(text: string): ParsedTransaction | null {
    const amountData = this.extractShorthandAmount(text);
    if (!amountData || amountData.amount <= 0) return null;

    const isIncome = /\b(received|credited|deposit|inward)\b/i.test(text);
    const type: TransactionType = isIncome ? "income" : "expense";
    const category = this.categorize(text, type);

    return {
      source: "GENERIC_SMS",
      type,
      amount: amountData.amount,
      currency: amountData.currency || "UGX",
      category,
      confidence: 0.65,
      description: text.slice(0, 50),
      rawText: text,
    };
  }

  /**
   * --------------------------------------------------------------------------
   * Helper: Categorize based on keywords
   * --------------------------------------------------------------------------
   */
  public categorize(text: string, type: TransactionType = "expense"): string {
    const lower = text.toLowerCase();

    for (const [category, keywords] of Object.entries(CATEGORY_MAP)) {
      for (const kw of keywords) {
        const regex = new RegExp(`\\b${kw}\\b`, "i");
        if (regex.test(lower)) {
          return category;
        }
      }
    }

    if (type === "income") return "Salary & Income";
    return "General Expense";
  }

  /**
   * --------------------------------------------------------------------------
   * Helper: Parse amount shorthand (e.g. 15k -> 15000, 1.5m -> 1500000)
   * --------------------------------------------------------------------------
   */
  private extractShorthandAmount(text: string): { amount: number; currency: string } | null {
    // 1. Shorthand with multiplier suffix: 15k, 2.5k, 1m, 1.2M
    const suffixMatch = text.match(/(?:UGX|Shs|USh)?\s*(\d+(?:\.\d+)?)\s*([kKmMbB])\b/);
    if (suffixMatch) {
      const num = parseFloat(suffixMatch[1]);
      const suffix = suffixMatch[2].toLowerCase();
      let multiplier = 1;
      if (suffix === "k") multiplier = 1_000;
      else if (suffix === "m") multiplier = 1_000_000;
      else if (suffix === "b") multiplier = 1_000_000_000;

      return {
        amount: Math.round(num * multiplier),
        currency: "UGX",
      };
    }

    // 2. Standard formatted numbers: 15,000 or 50000 or UGX 10000
    const stdMatch = text.match(/(?:UGX|Shs|USh)?\s*([\d]{1,3}(?:,\d{3})+(?:\.\d+)?|\b\d{3,}(?:\.\d+)?)\b/);
    if (stdMatch) {
      const rawNum = stdMatch[1].replace(/,/g, "");
      const amount = Math.round(parseFloat(rawNum));
      if (!isNaN(amount) && amount > 0) {
        return {
          amount,
          currency: "UGX",
        };
      }
    }

    return null;
  }

  /**
   * Helper: Strips commas and converts to number
   */
  private cleanNumber(val: string | undefined): number {
    if (!val) return 0;
    const clean = val.replace(/,/g, "").trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : Math.round(num);
  }

  /**
   * Helper: Cleans counterparty string by stripping trailing dots and noise
   */
  private cleanCounterparty(val: string | undefined): string | undefined {
    if (!val) return undefined;
    const clean = val.replace(/\bon\b.*$/i, "").replace(/[.]+$/, "").trim();
    return clean || undefined;
  }

  /**
   * Helper: Extracts Financial Transaction ID (MTN format)
   */
  private extractFinancialTxId(text: string): string | undefined {
    const match = text.match(/Financial Transaction Id:\s*([A-Za-z0-9]+)/i);
    return match ? match[1].trim() : undefined;
  }

  /**
   * Helper: Extracts Trans ID (Airtel format)
   */
  private extractTransId(text: string): string | undefined {
    const match = text.match(/Trans(?:\.|\s*)ID:\s*([A-Za-z0-9.]+)/i);
    if (!match) return undefined;
    return match[1].replace(/[.]+$/, "").trim();
  }

  /**
   * Helper: Extracts reference keyword from text (e.g. Ref: Fuel, Reference: Rent)
   */
  private extractRefText(text: string): string | undefined {
    const match = text.match(/(?:Ref|Reference|Info):\s*([^.]+)/i);
    return match ? match[1].trim() : undefined;
  }

  /**
   * Helper: Extracts balance from message
   */
  private extractBalance(text: string): number | undefined {
    const match = text.match(/(?:New\s*(?:Airtel\s*Money\s*|MoMo\s*)?balance|Your\s*(?:new\s*)?balance|Balance)(?::|\s+is)?\s*(?:UGX|Shs|USh)?\s*([\d,]+(?:\.\d+)?)\b/i);
    if (!match) return undefined;
    const num = this.cleanNumber(match[1]);
    return num > 0 ? num : undefined;
  }

  /**
   * Helper: Extracts fee/charge from message (supports 'Fee was', 'Fee:', 'Charge:', etc.)
   */
  private extractFee(text: string): number {
    const match = text.match(/(?:Fee(?:\s+was|\s+is)?|Charge)(?::|\s+was|\s+is)?\s*(?:UGX|Shs|USh)?\s*([\d,]+(?:\.\d+)?)\b/i);
    if (!match) return 0;
    return this.cleanNumber(match[1]);
  }

  /**
   * Helper: Extracts date string from message
   */
  private extractDate(text: string): string | undefined {
    const match = text.match(/\b(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?|\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)\b/);
    return match ? match[1].trim() : undefined;
  }
}

// Global singleton instance
export const parserService = new ParserService();
export default parserService;
