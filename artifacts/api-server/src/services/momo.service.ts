import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger";

/**
 * Configuration options for the MTN MoMo client.
 */
export interface MoMoConfig {
  baseUrl?: string;
  subscriptionKey?: string;
  referenceId?: string;
  apiKey?: string;
  targetEnv?: string;
  callbackHost?: string;
}

/**
 * Parameters for initiating a Request-to-Pay collection.
 */
export interface RequestToPayParams {
  amount: string | number;
  currency?: string;
  externalId: string;
  phone: string;
  payerMessage?: string;
  payeeNote?: string;
  referenceId?: string;
}

/**
 * MTN MoMo Transaction Status Response
 */
export interface MoMoTransactionStatus {
  financialTransactionId?: string;
  externalId?: string;
  amount?: string;
  currency?: string;
  payer?: {
    partyIdType: string;
    partyId: string;
  };
  payerMessage?: string;
  payeeNote?: string;
  status: "PENDING" | "SUCCESSFUL" | "FAILED";
  reason?: {
    code: string;
    message: string;
  };
  [key: string]: unknown;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * MoMoService
 * Modular, decoupled client for MTN Mobile Money API (Sandbox & Production).
 * Handles token exchange, in-memory caching, USSD push collection (requesttopay),
 * and transaction status inquiries.
 */
export class MoMoService {
  private baseUrl: string;
  private subscriptionKey: string;
  private referenceId: string;
  private apiKey: string;
  private targetEnv: string;
  private callbackHost: string;
  private cachedToken: CachedToken | null = null;

  constructor(config: MoMoConfig = {}) {
    this.baseUrl = (config.baseUrl || process.env.MOMO_BASE_URL || "https://sandbox.momodeveloper.mtn.com").replace(/\/+$/, "");
    this.subscriptionKey = config.subscriptionKey || process.env.MOMO_SUBSCRIPTION_KEY || "";
    this.referenceId = config.referenceId || process.env.MOMO_REFERENCE_ID || "";
    this.apiKey = config.apiKey || process.env.MOMO_API_KEY || "";
    this.targetEnv = config.targetEnv || process.env.MOMO_TARGET_ENV || "sandbox";
    this.callbackHost = config.callbackHost || process.env.MOMO_CALLBACK_HOST || "tereka-production.up.railway.app";
  }

  /**
   * Set or update configuration dynamically
   */
  public configure(config: Partial<MoMoConfig>): void {
    if (config.baseUrl) this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    if (config.subscriptionKey) this.subscriptionKey = config.subscriptionKey;
    if (config.referenceId) this.referenceId = config.referenceId;
    if (config.apiKey) this.apiKey = config.apiKey;
    if (config.targetEnv) this.targetEnv = config.targetEnv;
    if (config.callbackHost) this.callbackHost = config.callbackHost;
    // Invalidate cached token if credentials change
    this.cachedToken = null;
  }

  /**
   * Validate that required credentials exist
   */
  private assertCredentials(): void {
    const missing: string[] = [];
    if (!this.subscriptionKey) missing.push("MOMO_SUBSCRIPTION_KEY");
    if (!this.referenceId) missing.push("MOMO_REFERENCE_ID");
    if (!this.apiKey) missing.push("MOMO_API_KEY");

    if (missing.length > 0) {
      throw new Error(
        `[MoMoService] Missing required MoMo credentials: ${missing.join(", ")}. Run 'node scripts/setup-momo-sandbox.mjs' to provision them.`
      );
    }
  }

  /**
   * Exchange API User and API Key for a Bearer Access Token.
   * Caches the token in memory until its lifetime expires.
   */
  public async getAccessToken(forceRefresh = false): Promise<string> {
    this.assertCredentials();

    // Check in-memory cache
    if (!forceRefresh && this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.token;
    }

    const authHeader = `Basic ${Buffer.from(`${this.referenceId}:${this.apiKey}`).toString("base64")}`;
    const tokenUrl = `${this.baseUrl}/collection/token/`;

    try {
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Ocp-Apim-Subscription-Key": this.subscriptionKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, errorText }, "[MoMoService] Token exchange failed");
        throw new Error(
          `[MoMoService] Token exchange failed with HTTP ${response.status} (${response.statusText}): ${errorText}`
        );
      }

      const data = (await response.json()) as { access_token: string; token_type: string; expires_in: number };

      const expiresInSeconds = Number(data.expires_in) || 3600;
      // Buffer by 60 seconds to avoid edge-of-expiry race conditions
      this.cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + Math.max(expiresInSeconds - 60, 60) * 1000,
      };

      logger.info({ expires_in: expiresInSeconds }, "[MoMoService] Access token acquired successfully");
      return data.access_token;
    } catch (err: any) {
      logger.error({ err: err.message }, "[MoMoService] Network error during token exchange");
      throw err;
    }
  }

  /**
   * Trigger a simulated Request-to-Pay collection (USSD Push prompt)
   *
   * @param params Request details
   * @returns Reference ID of the created transaction
   */
  public async requestToPay(params: RequestToPayParams): Promise<{ referenceId: string; status: number }> {
    const token = await this.getAccessToken();
    const referenceId = params.referenceId || randomUUID();
    const targetUrl = `${this.baseUrl}/collection/v1_0/requesttopay`;

    // Standardize phone number (strip whitespace, plus sign, etc.)
    const cleanPhone = String(params.phone).replace(/[\s\+\-]/g, "");

    // Note: MTN Sandbox Collections default to EUR unless configured otherwise
    const payload = {
      amount: String(params.amount),
      currency: params.currency || "EUR",
      externalId: params.externalId,
      payer: {
        partyIdType: "MSISDN",
        partyId: cleanPhone,
      },
      payerMessage: params.payerMessage || "Tereka Budget Deposit",
      payeeNote: params.payeeNote || "Tereka MoMo Test",
    };

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Reference-Id": referenceId,
          "X-Target-Environment": this.targetEnv,
          "Ocp-Apim-Subscription-Key": this.subscriptionKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // MTN API returns 202 Accepted on success
      if (response.status !== 202 && response.status !== 200) {
        const errorText = await response.text();
        logger.error(
          { status: response.status, referenceId, errorText },
          "[MoMoService] RequestToPay collection rejected"
        );
        throw new Error(
          `[MoMoService] RequestToPay rejected with HTTP ${response.status} (${response.statusText}): ${errorText}`
        );
      }

      logger.info({ referenceId, externalId: params.externalId, amount: params.amount }, "[MoMoService] RequestToPay accepted");
      return { referenceId, status: response.status };
    } catch (err: any) {
      logger.error({ err: err.message, referenceId }, "[MoMoService] Network failure during RequestToPay");
      throw err;
    }
  }

  /**
   * Check the status of a previously initiated Request-to-Pay transaction.
   *
   * @param referenceId The X-Reference-Id used when creating the transaction
   * @returns MoMoTransactionStatus object
   */
  public async getTransactionStatus(referenceId: string): Promise<MoMoTransactionStatus> {
    const token = await this.getAccessToken();
    const targetUrl = `${this.baseUrl}/collection/v1_0/requesttopay/${referenceId}`;

    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Target-Environment": this.targetEnv,
          "Ocp-Apim-Subscription-Key": this.subscriptionKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { status: response.status, referenceId, errorText },
          "[MoMoService] Failed to fetch transaction status"
        );
        throw new Error(
          `[MoMoService] Status check failed with HTTP ${response.status} (${response.statusText}): ${errorText}`
        );
      }

      const data = (await response.json()) as MoMoTransactionStatus;
      logger.info({ referenceId, status: data.status }, "[MoMoService] Transaction status retrieved");
      return data;
    } catch (err: any) {
      logger.error({ err: err.message, referenceId }, "[MoMoService] Network failure during status check");
      throw err;
    }
  }

  /**
   * Sandbox Provisioning Helper: Create an API User
   */
  public async createSandboxApiUser(referenceId: string, callbackHost?: string): Promise<void> {
    if (!this.subscriptionKey) {
      throw new Error("[MoMoService] Subscription Key is required to create a sandbox API User.");
    }

    const url = `${this.baseUrl}/v1_0/apiuser`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-Reference-Id": referenceId,
        "Ocp-Apim-Subscription-Key": this.subscriptionKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        providerCallbackHost: callbackHost || this.callbackHost,
      }),
    });

    if (response.status !== 201 && response.status !== 200) {
      const errorText = await response.text();
      throw new Error(`[MoMoService] Failed to create API User (HTTP ${response.status}): ${errorText}`);
    }
  }

  /**
   * Sandbox Provisioning Helper: Generate an API Key for the API User
   */
  public async createSandboxApiKey(referenceId: string): Promise<string> {
    if (!this.subscriptionKey) {
      throw new Error("[MoMoService] Subscription Key is required to generate a sandbox API Key.");
    }

    const url = `${this.baseUrl}/v1_0/apiuser/${referenceId}/apikey`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": this.subscriptionKey,
      },
    });

    if (response.status !== 201 && response.status !== 200) {
      const errorText = await response.text();
      throw new Error(`[MoMoService] Failed to create API Key (HTTP ${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as { apiKey: string };
    return data.apiKey;
  }
}

// Global singleton instance configured from environment variables
export const momoService = new MoMoService();
export default momoService;
