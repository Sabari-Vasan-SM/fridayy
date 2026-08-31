/**
 * Fridayy - MCP Prompt Registry
 * Provides pre-configured guided prompts for AI clients to safely explore and operate tools.
 */

export interface McpPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: McpPromptArgument[];
}

export class PromptRegistry {
  public listPrompts(): McpPrompt[] {
    return [
      {
        name: 'explore-api',
        description: 'Guides the AI assistant to explore the available tools, understand their permissions, and plan operations safely.',
        arguments: [
          {
            name: 'task',
            description: 'The task or objective you want to accomplish using this API.',
            required: false
          }
        ]
      },
      {
        name: 'safe-query',
        description: 'Instructs the AI assistant to strictly use read-only (READ) tools without executing write or destructive operations.',
        arguments: [
          {
            name: 'query',
            description: 'The information or data you want to retrieve.',
            required: true
          }
        ]
      }
    ];
  }

  public getPrompt(name: string, args: Record<string, string> = {}): {
    description?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: { type: 'text'; text: string } }>;
  } {
    if (name === 'explore-api') {
      const taskText = args.task ? `\n\nGoal: ${args.task}` : '';
      return {
        description: 'Explore the API safely',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `You are connected to an API via Fridayy MCP Server. Please list the available tools, identify whether each tool is READ, WRITE, or DESTRUCTIVE, and propose a step-by-step plan to achieve the goal.${taskText}`
            }
          }
        ]
      };
    }

    if (name === 'safe-query') {
      return {
        description: 'Execute a read-only query',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please answer the following query using ONLY safe READ tools. Do NOT invoke any WRITE or DESTRUCTIVE tools.\n\nQuery: ${args.query || 'Retrieve summary data'}`
            }
          }
        ]
      };
    }

    throw new Error(`Prompt not found: ${name}`);
  }
}
