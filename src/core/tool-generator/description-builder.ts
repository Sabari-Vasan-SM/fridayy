/**
 * Fridayy - Tool Description Builder
 * Formats rich, semantic tool descriptions for LLMs.
 */

export interface DescriptionBuildContext {
  summary?: string;
  description?: string;
  method?: string;
  path?: string;
  tags?: string[];
  permissionType?: string;
  risk?: string;
}

export function buildToolDescription(ctx: DescriptionBuildContext): string {
  const parts: string[] = [];

  // 1. Primary summary or description
  if (ctx.summary) {
    parts.push(ctx.summary.trim());
  } else if (ctx.description) {
    // Take first sentence or full short description
    const firstLine = ctx.description.split('\n')[0].trim();
    parts.push(firstLine);
  } else if (ctx.method && ctx.path) {
    parts.push(`Execute ${ctx.method.toUpperCase()} request to ${ctx.path}`);
  }

  // 2. Additional context if different from summary
  if (ctx.description && ctx.summary && ctx.description.trim() !== ctx.summary.trim()) {
    const cleanDesc = ctx.description.replace(/\r?\n/g, ' ').trim();
    if (cleanDesc.length > 0 && !parts.includes(cleanDesc)) {
      parts.push(`Details: ${cleanDesc}`);
    }
  }

  // 3. Risk / Permission advisory for LLM safety
  if (ctx.permissionType === 'DESTRUCTIVE') {
    parts.push('[CAUTION: Destructive operation - permanent deletion or irreversible state change]');
  }

  return parts.join('. ').replace(/\.\./g, '.');
}
