/**
 * Fridayy - Secret Resolver & Isolation Engine
 * Manages secret extraction from environment variables with zero leakage to LLM prompts/schemas.
 */

import dotenv from 'dotenv';

// Load .env if present
dotenv.config();

export interface SecretResolutionOptions {
  envKey?: string;
  prefix?: string;
  fallbackValue?: string;
}

export class SecretResolver {
  private customEnv: Record<string, string>;

  constructor(customEnv: Record<string, string> = {}) {
    this.customEnv = customEnv;
  }

  /**
   * Resolves a secret value from process.env or custom config.
   * Priority:
   * 1. Direct envKey if specified in tool/auth definition
   * 2. Standard FRIDAYY_<SCHEME>_KEY or FRIDAYY_<NAME>
   * 3. customEnv lookup
   */
  public resolveSecret(keyOrScheme: string, options: SecretResolutionOptions = {}): string | undefined {
    // 1. Check explicit envKey
    if (options.envKey) {
      const explicitVal = process.env[options.envKey] || this.customEnv[options.envKey];
      if (explicitVal) return explicitVal;
    }

    // 2. Sanitize scheme name to uppercase env variable format
    const sanitizedKey = keyOrScheme.toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    const candidates = [
      options.envKey,
      `FRIDAYY_${sanitizedKey}`,
      `FRIDAYY_API_${sanitizedKey}`,
      `FRIDAYY_${sanitizedKey}_KEY`,
      `FRIDAYY_${sanitizedKey}_TOKEN`,
      `FRIDAYY_API_KEY`,
      `FRIDAYY_BEARER_TOKEN`,
      `FRIDAYY_AUTH_TOKEN`,
      keyOrScheme
    ].filter(Boolean) as string[];

    for (const cand of candidates) {
      if (process.env[cand]) {
        return process.env[cand];
      }
      if (this.customEnv[cand]) {
        return this.customEnv[cand];
      }
    }

    return options.fallbackValue;
  }

  /**
   * Resolves the target API base URL.
   * Priority:
   * 1. FRIDAYY_API_URL / FRIDAYY_BASE_URL env var
   * 2. Config baseUrl
   * 3. OpenAPI spec servers[0].url
   */
  public resolveBaseUrl(configuredUrl?: string): string | undefined {
    return (
      process.env.FRIDAYY_API_URL ||
      process.env.FRIDAYY_BASE_URL ||
      process.env.API_URL ||
      this.customEnv.FRIDAYY_API_URL ||
      this.customEnv.FRIDAYY_BASE_URL ||
      configuredUrl
    );
  }

  /**
   * Returns a list of required environment variables for the configured tools.
   */
  public getRequiredEnvVars(authSchemes: Array<{ schemeName?: string; envKey?: string; type?: string }>): string[] {
    const requiredVars = new Set<string>();

    for (const auth of authSchemes) {
      if (auth.envKey) {
        requiredVars.add(auth.envKey);
      } else if (auth.schemeName) {
        const sanitized = auth.schemeName.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        requiredVars.add(`FRIDAYY_${sanitized}`);
      } else if (auth.type === 'apiKey') {
        requiredVars.add('FRIDAYY_API_KEY');
      } else if (auth.type === 'bearer') {
        requiredVars.add('FRIDAYY_BEARER_TOKEN');
      }
    }

    return Array.from(requiredVars);
  }
}

export const defaultSecretResolver = new SecretResolver();
