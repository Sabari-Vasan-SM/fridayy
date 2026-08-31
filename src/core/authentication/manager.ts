/**
 * Fridayy - Authentication Manager
 * Applies authentication headers, tokens, and query parameters to HTTP requests safely.
 */

import { ToolAuthentication, FridayyConfig, AuthType } from '../schema/types.js';
import { SecretResolver, defaultSecretResolver } from './secret-resolver.js';

export interface AuthContext {
  headers: Record<string, string>;
  queryParams: Record<string, string>;
}

export class AuthenticationManager {
  private secretResolver: SecretResolver;
  private config?: FridayyConfig;

  constructor(config?: FridayyConfig, secretResolver: SecretResolver = defaultSecretResolver) {
    this.config = config;
    this.secretResolver = secretResolver;
  }

  /**
   * Applies authentication credentials to request headers and query parameters.
   */
  public applyAuth(auth?: ToolAuthentication, target: AuthContext = { headers: {}, queryParams: {} }): AuthContext {
    if (!auth || !auth.required || auth.type === 'none') {
      return target;
    }

    // 1. Look up configured auth in fridayy.config.json if scheme matches
    const schemeConfig = (auth.schemeName && this.config?.auth) ? this.config.auth[auth.schemeName] : undefined;
    const authType: AuthType = schemeConfig?.type || auth.type || 'apiKey';
    const headerName = schemeConfig?.headerName || auth.headerName;
    const queryParam = schemeConfig?.queryParam || auth.queryParam;
    const envKey = schemeConfig?.envKey || auth.envKey;

    // 2. Resolve secret token
    const secret =
      schemeConfig?.value ||
      this.secretResolver.resolveSecret(auth.schemeName || 'DEFAULT', {
        envKey
      });

    if (!secret) {
      // If secret is missing, do not crash outright but allow request or let downstream handle
      return target;
    }

    // 3. Apply based on type
    switch (authType) {
      case 'bearer':
        target.headers['Authorization'] = `Bearer ${secret.trim()}`;
        break;

      case 'apiKey':
        if (queryParam) {
          target.queryParams[queryParam] = secret.trim();
        } else {
          const finalHeader = headerName || 'x-api-key';
          target.headers[finalHeader] = secret.trim();
        }
        break;

      case 'basic': {
        const encoded = secret.includes(':') ? Buffer.from(secret).toString('base64') : secret;
        target.headers['Authorization'] = `Basic ${encoded.trim()}`;
        break;
      }

      case 'customHeader':
        if (headerName) {
          target.headers[headerName] = secret.trim();
        }
        break;

      case 'oauth2':
        target.headers['Authorization'] = `Bearer ${secret.trim()}`;
        break;

      default:
        if (headerName) {
          target.headers[headerName] = secret.trim();
        }
        break;
    }

    return target;
  }
}
