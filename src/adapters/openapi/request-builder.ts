/**
 * Fridayy - HTTP Request Builder
 * Interpolates URL path params, serializes query strings, and packages payloads for REST execution.
 */

import { FridayyToolDefinition } from '../../core/schema/types.js';

export interface PreparedHttpRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export function buildHttpRequest(
  tool: FridayyToolDefinition,
  input: Record<string, any> = {},
  baseUrlOverride?: string
): PreparedHttpRequest {
  const method = (tool.source.method || 'GET').toUpperCase();
  let rawPath = tool.source.path || tool.source.url || '/';
  const baseUrl = baseUrlOverride || tool.source.baseUrl || 'http://localhost:3000';

  const headers: Record<string, string> = {
    'Accept': 'application/json, text/plain, */*'
  };
  const queryParams: Record<string, string> = {};
  let bodyPayload: any = undefined;

  // Clone input to avoid mutating original
  const remainingInput = { ...input };

  // 1. Interpolate Path Parameters
  const pathParamDefs = tool.parameters?.path || [];
  for (const param of pathParamDefs) {
    const val = remainingInput[param.name];
    if (val !== undefined && val !== null) {
      rawPath = rawPath.replace(
        new RegExp(`\\{${param.name}\\}|:${param.name}`, 'g'),
        encodeURIComponent(String(val))
      );
      delete remainingInput[param.name];
    }
  }

  // Also check any remaining path tokens in case they weren't in pathParamDefs
  rawPath = rawPath.replace(/\{([a-zA-Z0-9_-]+)\}/g, (_, key) => {
    if (remainingInput[key] !== undefined) {
      const val = remainingInput[key];
      delete remainingInput[key];
      return encodeURIComponent(String(val));
    }
    return `{${key}}`;
  });

  // 2. Query Parameters
  const queryParamDefs = tool.parameters?.query || [];
  for (const param of queryParamDefs) {
    if (remainingInput[param.name] !== undefined && remainingInput[param.name] !== null) {
      queryParams[param.name] = String(remainingInput[param.name]);
      delete remainingInput[param.name];
    }
  }

  // 3. Header Parameters
  const headerParamDefs = tool.parameters?.header || [];
  for (const param of headerParamDefs) {
    if (remainingInput[param.name] !== undefined && remainingInput[param.name] !== null) {
      headers[param.name] = String(remainingInput[param.name]);
      delete remainingInput[param.name];
    }
  }

  // 4. Request Body
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (remainingInput['body'] !== undefined) {
      bodyPayload = remainingInput['body'];
    } else if (Object.keys(remainingInput).length > 0) {
      // Any remaining fields become the JSON body payload
      bodyPayload = remainingInput;
    }
  }

  // Build full URL
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  let fullUrl = `${cleanBase}${cleanPath}`;

  // Append query string if any
  const searchParams = new URLSearchParams(queryParams);
  const queryString = searchParams.toString();
  if (queryString) {
    fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
  }

  // Serialize Body
  let bodyString: string | undefined;
  if (bodyPayload !== undefined) {
    headers['Content-Type'] = 'application/json';
    bodyString = typeof bodyPayload === 'string' ? bodyPayload : JSON.stringify(bodyPayload);
  }

  return {
    url: fullUrl,
    method,
    headers,
    body: bodyString
  };
}
