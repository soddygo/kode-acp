import { EventEmitter } from 'events';
import { KodeToolCall, KodeToolResult, KodeACPConfig } from './types.ts';
import { log } from './utils.ts';
import {
  CrossPlatformProcess,
  executeCommand,
  spawnProcess,
  isCommandAvailable,
  ProcessManager
} from './process-manager.ts';

export class KodeIntegration extends EventEmitter {
  private config: KodeACPConfig;
  private kodeProcess: CrossPlatformProcess | null = null;
  private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map();
  private initialized: boolean = false;
  private processManager: ProcessManager;

  constructor(config: KodeACPConfig) {
    super();
    this.config = {
      workingDirectory: typeof process !== 'undefined' ? process.cwd() : (globalThis as any).Deno?.cwd() || '.',
      permissionMode: 'yolo',
      logLevel: 'info',
      ...config,
    };
    this.processManager = ProcessManager.getInstance();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Check if kode is installed
      const kodeAvailable = await isCommandAvailable('kode');
      if (!kodeAvailable) {
        throw new Error('Kode is not installed or not in PATH. Please install Kode first.');
      }

      this.initialized = true;
      log('info', 'Kode integration initialized');
    } catch (error) {
      log('error', 'Failed to initialize Kode integration:', error);
      throw error;
    }
  }

  async executeTool(toolCall: KodeToolCall): Promise<KodeToolResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const requestId = `kode_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Tool execution timeout: ${toolCall.name}`));
      }, 300000); // 5 minutes timeout

      // Execute the tool using Kode's API
      this.executeToolInternal(toolCall)
        .then((result) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(requestId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(requestId);
          reject(error);
        });
    });
  }

  private async executeToolInternal(toolCall: KodeToolCall): Promise<KodeToolResult> {
    const { name, input } = toolCall;

    log('debug', `Executing Kode tool: ${name}`, input);

    try {
      // For now, we'll simulate tool execution
      // In a real implementation, this would interface with Kode's internal API
      const result = await this.simulateToolExecution(toolCall);

      log('debug', `Tool ${name} executed successfully`);
      return result;
    } catch (error) {
      log('error', `Tool ${name} execution failed:`, error);
      return {
        type: 'tool_result',
        content: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
        tool_use_id: toolCall.id || '',
        is_error: true,
      };
    }
  }

  private async simulateToolExecution(toolCall: KodeToolCall): Promise<KodeToolResult> {
    // This is a temporary simulation until we can properly integrate with Kode's API
    // In the real implementation, this would call Kode's actual tool execution system

    const { name, input } = toolCall;

    switch (name) {
      case 'FileRead':
        try {
          const fs = await import('fs');
          const path = input.file_path || input.abs_path;
          const content = fs.readFileSync(path, 'utf8');
          return {
            type: 'tool_result',
            content: [{ type: 'text', text: content }],
            tool_use_id: toolCall.id || '',
            is_error: false,
          };
        } catch (error) {
          return {
            type: 'tool_result',
            content: `File not found: ${input.file_path}`,
            tool_use_id: toolCall.id || '',
            is_error: true,
          };
        }

      case 'FileWrite':
        try {
          const fs = await import('fs');
          const path = input.abs_path || input.file_path;
          const dir = path.split('/').slice(0, -1).join('/');

          if (dir) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.writeFileSync(path, input.content);
          return {
            type: 'tool_result',
            content: `File written successfully: ${path}`,
            tool_use_id: toolCall.id || '',
            is_error: false,
          };
        } catch (error) {
          return {
            type: 'tool_result',
            content: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
            tool_use_id: toolCall.id || '',
            is_error: true,
          };
        }

      case 'Bash':
        try {
          const result = await executeCommand(input.command, {
            cwd: this.config.workingDirectory,
            shell: true,
          });

          if (result.exitCode === 0) {
            return {
              type: 'tool_result',
              content: result.stdout || result.stderr,
              tool_use_id: toolCall.id || '',
              is_error: false,
            };
          } else {
            return {
              type: 'tool_result',
              content: `Command failed with exit code ${result.exitCode}: ${result.stderr}`,
              tool_use_id: toolCall.id || '',
              is_error: true,
            };
          }
        } catch (error) {
          return {
            type: 'tool_result',
            content: `Command execution failed: ${error instanceof Error ? error.message : String(error)}`,
            tool_use_id: toolCall.id || '',
            is_error: true,
          };
        }

      case 'Glob':
        try {
          const { glob } = await import('glob');
          const pattern = input.pattern;
          const cwd = input.path || this.config.workingDirectory;

          const files = await glob(pattern, { cwd });
          return {
            type: 'tool_result',
            content: files.join('\n'),
            tool_use_id: toolCall.id || '',
            is_error: false,
          };
        } catch (error) {
          return {
            type: 'tool_result',
            content: `Glob failed: ${error instanceof Error ? error.message : String(error)}`,
            tool_use_id: toolCall.id || '',
            is_error: true,
          };
        }

      case 'Task':
        return {
          type: 'tool_result',
          content: `Task created: ${input.description || 'Unnamed task'}`,
          tool_use_id: toolCall.id || '',
          is_error: false,
        };

      default:
        return {
          type: 'tool_result',
          content: `Tool ${name} not yet implemented in Kode ACP adapter`,
          tool_use_id: toolCall.id || '',
          is_error: true,
        };
    }
  }

  async getAvailableTools(): Promise<string[]> {
    return [
      'FileRead',
      'FileWrite',
      'FileEdit',
      'MultiEdit',
      'Bash',
      'Glob',
      'Grep',
      'Task',
      'TodoWrite',
      'WebSearch',
      'WebFetch',
      'NotebookRead',
      'NotebookEdit',
      'MemoryRead',
      'MemoryWrite',
      'ThinkTool',
      'AskExpertModelTool',
      'LS',
    ];
  }

  async cleanup(): Promise<void> {
    if (this.kodeProcess) {
      this.kodeProcess.kill();
      this.kodeProcess = null;
    }

    // Clean up all processes managed by the process manager
    await this.processManager.killAllProcesses();

    // Clear pending requests
    for (const [requestId, { reject }] of this.pendingRequests) {
      reject(new Error('Kode integration shutting down'));
      this.pendingRequests.delete(requestId);
    }

    this.initialized = false;
    log('info', 'Kode integration cleaned up');
  }
}