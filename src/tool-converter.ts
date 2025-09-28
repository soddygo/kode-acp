// Tool conversion utilities for ACP protocol compatibility
// Based on the reference project's tool mapping patterns

import { KodeToolCall, KodeToolResult } from './types.ts';
import { log } from './utils.ts';

export interface ToolMapping {
  fromACP: string;
  toKode: string;
  transform?: (input: any) => any;
  reverseTransform?: (result: any) => any;
}

export interface ToolConverter {
  // Convert ACP tool call to Kode tool call
  convertToKode(toolCall: any): KodeToolCall | null;

  // Convert Kode tool result back to ACP format
  convertFromKode(result: KodeToolResult): any;

  // Get list of supported tools
  getSupportedTools(): string[];
}

// Default tool mappings based on ACP protocol
const DEFAULT_TOOL_MAPPINGS: ToolMapping[] = [
  {
    fromACP: 'read_file',
    toKode: 'FileRead',
    transform: (input) => ({
      abs_path: input.path,
      file_path: input.path,
    }),
  },
  {
    fromACP: 'write_file',
    toKode: 'FileWrite',
    transform: (input) => ({
      abs_path: input.path,
      file_path: input.path,
      content: input.content,
    }),
  },
  {
    fromACP: 'edit_file',
    toKode: 'FileEdit',
    transform: (input) => ({
      abs_path: input.path,
      file_path: input.path,
      old_string: input.old_string,
      new_string: input.new_string,
    }),
  },
  {
    fromACP: 'run_command',
    toKode: 'Bash',
    transform: (input) => ({
      command: input.command,
    }),
  },
  {
    fromACP: 'glob',
    toKode: 'Glob',
    transform: (input) => ({
      pattern: input.pattern,
      path: input.path,
    }),
  },
  {
    fromACP: 'search',
    toKode: 'Grep',
    transform: (input) => ({
      pattern: input.pattern,
      path: input.path,
    }),
  },
  {
    fromACP: 'create_task',
    toKode: 'Task',
    transform: (input) => ({
      description: input.description,
    }),
  },
  {
    fromACP: 'web_search',
    toKode: 'WebSearch',
    transform: (input) => ({
      query: input.query,
    }),
  },
  {
    fromACP: 'web_fetch',
    toKode: 'WebFetch',
    transform: (input) => ({
      url: input.url,
    }),
  },
];

export class ACPToolConverter implements ToolConverter {
  private mappings: Map<string, ToolMapping> = new Map();
  private reverseMappings: Map<string, ToolMapping> = new Map();

  constructor(mappings: ToolMapping[] = DEFAULT_TOOL_MAPPINGS) {
    this.initializeMappings(mappings);
  }

  private initializeMappings(mappings: ToolMapping[]) {
    for (const mapping of mappings) {
      this.mappings.set(mapping.fromACP, mapping);
      this.reverseMappings.set(mapping.toKode, mapping);
    }
  }

  convertToKode(toolCall: any): KodeToolCall | null {
    if (!toolCall || !toolCall.name) {
      log('warn', 'Invalid tool call received:', toolCall);
      return null;
    }

    const mapping = this.mappings.get(toolCall.name);
    if (!mapping) {
      log('warn', `Unsupported tool: ${toolCall.name}`);
      return null;
    }

    try {
      const input = mapping.transform
        ? mapping.transform(toolCall.input || {})
        : toolCall.input || {};

      return {
        name: mapping.toKode,
        input,
        id: toolCall.id || this.generateToolId(),
      };
    } catch (error) {
      log('error', `Failed to convert tool ${toolCall.name}:`, error);
      return null;
    }
  }

  convertFromKode(result: KodeToolResult): any {
    if (!result || !result.tool_use_id) {
      log('warn', 'Invalid tool result received:', result);
      return result;
    }

    try {
      // Find the original mapping based on the result
      const mapping = Array.from(this.reverseMappings.values())
        .find(m => result.tool_use_id?.toString().includes(m.toKode));

      if (mapping && mapping.reverseTransform) {
        return mapping.reverseTransform(result);
      }

      // Default conversion - just return the result as-is
      return {
        type: 'tool_result',
        tool_use_id: result.tool_use_id,
        content: result.content,
        is_error: result.is_error || false,
      };
    } catch (error) {
      log('error', 'Failed to convert tool result:', error);
      return result;
    }
  }

  getSupportedTools(): string[] {
    return Array.from(this.mappings.keys());
  }

  addMapping(mapping: ToolMapping): void {
    this.mappings.set(mapping.fromACP, mapping);
    this.reverseMappings.set(mapping.toKode, mapping);
    log('info', `Added tool mapping: ${mapping.fromACP} -> ${mapping.toKode}`);
  }

  removeMapping(acpToolName: string): void {
    const mapping = this.mappings.get(acpToolName);
    if (mapping) {
      this.mappings.delete(acpToolName);
      this.reverseMappings.delete(mapping.toKode);
      log('info', `Removed tool mapping: ${acpToolName} -> ${mapping.toKode}`);
    }
  }

  private generateToolId(): string {
    return `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Tool permission system
export interface ToolPermission {
  toolName: string;
  allowed: boolean;
  reason?: string;
  timestamp: number;
}

export interface PermissionMode {
  name: string;
  description: string;
  autoApprove?: string[];
  autoDeny?: string[];
}

export class ToolPermissionManager {
  private permissions: Map<string, ToolPermission> = new Map();
  private currentMode: string = 'default';
  private modes: Map<string, PermissionMode> = new Map();

  constructor() {
    this.initializeModes();
  }

  private initializeModes() {
    const modes: PermissionMode[] = [
      {
        name: 'default',
        description: 'Manual approval for all tools',
        autoApprove: ['read_file', 'glob', 'search'],
        autoDeny: ['run_command', 'edit_file', 'write_file'],
      },
      {
        name: 'accept_edits',
        description: 'Auto-approve read operations, prompt for writes',
        autoApprove: ['read_file', 'glob', 'search'],
        autoDeny: ['run_command'],
      },
      {
        name: 'bypass_permissions',
        description: 'Auto-approve all operations',
        autoApprove: ['*'],
      },
      {
        name: 'plan',
        description: 'Planning mode - no actual operations',
        autoDeny: ['*'],
      },
    ];

    for (const mode of modes) {
      this.modes.set(mode.name, mode);
    }
  }

  async requestPermission(
    toolName: string,
    input?: any
  ): Promise<boolean> {
    const mode = this.modes.get(this.currentMode);
    if (!mode) {
      log('warn', `Unknown permission mode: ${this.currentMode}`);
      return false;
    }

    // Check auto-approve
    if (mode.autoApprove?.includes('*') || mode.autoApprove?.includes(toolName)) {
      this.setPermission(toolName, true, 'Auto-approved by mode');
      return true;
    }

    // Check auto-deny
    if (mode.autoDeny?.includes('*') || mode.autoDeny?.includes(toolName)) {
      this.setPermission(toolName, false, 'Auto-denied by mode');
      return false;
    }

    // Default behavior - deny and require explicit approval
    this.setPermission(toolName, false, 'Requires explicit approval');
    return false;
  }

  setPermission(toolName: string, allowed: boolean, reason?: string): void {
    this.permissions.set(toolName, {
      toolName,
      allowed,
      reason,
      timestamp: Date.now(),
    });
  }

  getPermission(toolName: string): ToolPermission | undefined {
    return this.permissions.get(toolName);
  }

  setMode(modeName: string): void {
    if (this.modes.has(modeName)) {
      this.currentMode = modeName;
      log('info', `Permission mode changed to: ${modeName}`);
      // Clear existing permissions when mode changes
      this.permissions.clear();
    } else {
      log('warn', `Unknown permission mode: ${modeName}`);
    }
  }

  getCurrentMode(): string {
    return this.currentMode;
  }

  getAvailableModes(): PermissionMode[] {
    return Array.from(this.modes.values());
  }

  clearExpiredPermissions(timeout: number = 3600000): void {
    const now = Date.now();
    for (const [key, permission] of this.permissions) {
      if (now - permission.timestamp > timeout) {
        this.permissions.delete(key);
      }
    }
  }
}

// Export utilities
export const defaultToolConverter: ACPToolConverter = new ACPToolConverter();
export const defaultPermissionManager: ToolPermissionManager = new ToolPermissionManager();