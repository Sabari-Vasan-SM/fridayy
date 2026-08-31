/**
 * Fridayy - Permission Classifier & Risk Assessment Engine
 * Classifies API endpoints into READ, WRITE, and DESTRUCTIVE with risk scoring.
 */

import {
  ToolPermissionType,
  ToolRiskLevel,
  ToolApprovalStatus,
  ToolPermissions,
  FridayyConfig
} from '../schema/types.js';

const DESTRUCTIVE_KEYWORDS = [
  'delete',
  'remove',
  'destroy',
  'purge',
  'erase',
  'drop',
  'truncate',
  'kill',
  'terminate',
  'wipe',
  'reset',
  'cancel',
  'revoke',
  'uninstall',
  'expire',
  'block'
];

export interface ClassificationContext {
  method?: string;
  path?: string;
  operationId?: string;
  name?: string;
  summary?: string;
  description?: string;
  tags?: string[];
}

export interface ClassificationResult {
  permissions: ToolPermissions;
  risk: ToolRiskLevel;
  status: ToolApprovalStatus;
  reason: string;
}

/**
 * Classifies an operation based on HTTP method, path, operationId, and naming keywords.
 */
export function classifyOperation(
  ctx: ClassificationContext,
  config?: FridayyConfig
): ClassificationResult {
  const method = (ctx.method || 'GET').toUpperCase();
  const fullText = [
    ctx.name || '',
    ctx.operationId || '',
    ctx.path || '',
    ctx.summary || '',
    ctx.description || ''
  ]
    .join(' ')
    .toLowerCase();

  // 1. Check for DESTRUCTIVE operations
  const isDeleteMethod = method === 'DELETE';
  const hasDestructiveKeyword = DESTRUCTIVE_KEYWORDS.some(kw => {
    // Word boundary or underscore boundary check
    const regex = new RegExp(`\\b${kw}\\b|_${kw}_|^${kw}_|_${kw}$`, 'i');
    return regex.test(fullText);
  });

  if (isDeleteMethod || hasDestructiveKeyword) {
    const isExplicitlyApproved = false;
    return {
      permissions: {
        type: 'DESTRUCTIVE',
        read: false,
        write: true,
        destructive: true,
        requiresConfirmation: true
      },
      risk: 'high',
      status: isExplicitlyApproved ? 'APPROVED' : 'BLOCKED',
      reason: isDeleteMethod
        ? 'DELETE HTTP method carries destructive risk.'
        : `Operation contains destructive action keyword: "${hasDestructiveKeyword}".`
    };
  }

  // 2. Check for READ operations
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    const autoApproveRead = config?.security?.autoApproveRead ?? true;
    return {
      permissions: {
        type: 'READ',
        read: true,
        write: false,
        destructive: false,
        requiresConfirmation: false
      },
      risk: 'low',
      status: autoApproveRead ? 'APPROVED' : 'PENDING',
      reason: `${method} HTTP method is a safe read-only operation.`
    };
  }

  // 3. WRITE operations (POST, PUT, PATCH)
  const autoApproveWrite = config?.security?.autoApproveWrite ?? false;
  return {
    permissions: {
      type: 'WRITE',
      read: false,
      write: true,
      destructive: false,
      requiresConfirmation: false
    },
    risk: 'medium',
    status: autoApproveWrite ? 'APPROVED' : 'PENDING',
    reason: `${method} HTTP method mutates server state (WRITE operation).`
  };
}
