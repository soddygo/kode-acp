// Cross-platform process management for JSR compatibility
// This module provides platform-agnostic process spawning capabilities

export interface ProcessOptions {
  cwd?: string;
  env?: Record<string, string>;
  shell?: boolean;
  timeout?: number;
}

export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
}

export interface ProcessInfo {
  pid: number;
  command: string;
  args: string[];
  running: boolean;
}

// Cross-platform process interface
export interface CrossPlatformProcess {
  readonly pid: number;
  readonly stdout?: ReadableStream<string>;
  readonly stderr?: ReadableStream<string>;

  kill(signal?: string | number): boolean;
  on(event: string, listener: (...args: any[]) => void): any;
  once(event: string, listener: (...args: any[]) => void): any;
  emit(event: string, ...args: any[]): boolean;
}

// Type for Node.js signals
type Signals = number;

// Process manager for cross-platform compatibility
export class ProcessManager {
  private static instance: ProcessManager;
  private activeProcesses: Map<number, CrossPlatformProcess> = new Map();

  static getInstance(): ProcessManager {
    if (!ProcessManager.instance) {
      ProcessManager.instance = new ProcessManager();
    }
    return ProcessManager.instance;
  }

  async executeCommand(
    command: string,
    options: ProcessOptions = {}
  ): Promise<ProcessResult> {
    const { cwd, timeout = 30000 } = options;

    try {
      // Try to use Deno's command API if available
      if (typeof (globalThis as any).Deno !== 'undefined') {
        return await this.executeWithDeno(command, { cwd, timeout });
      }

      // Fall back to Node.js child_process if available
      try {
        const { execSync } = await import('child_process');
        return this.executeWithNodeSync(command, { cwd, timeout });
      } catch {
        throw new Error('Process execution not supported on this platform');
      }
    } catch (error) {
      throw new Error(`Command execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async spawnProcess(
    command: string,
    args: string[] = [],
    options: ProcessOptions = {}
  ): Promise<CrossPlatformProcess> {
    try {
      // Try to use Deno's command API if available
      if (typeof (globalThis as any).Deno !== 'undefined') {
        return await this.spawnWithDeno(command, args, options);
      }

      // Fall back to Node.js child_process if available
      try {
        const { spawn } = await import('child_process');
        return this.spawnWithNode(command, args, options);
      } catch {
        throw new Error('Process spawning not supported on this platform');
      }
    } catch (error) {
      throw new Error(`Process spawning failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async executeWithDeno(
    command: string,
    options: { cwd?: string; timeout?: number }
  ): Promise<ProcessResult> {
    const { cwd, timeout } = options;
    const Deno = (globalThis as any).Deno;

    const commandProcess = new Deno.Command('sh', {
      args: ['-c', command],
      cwd,
      stdout: 'piped',
      stderr: 'piped',
    });

    const { code, stdout, stderr } = await Promise.race([
      commandProcess.output(),
      new Promise<{ code: number; stdout: Uint8Array; stderr: Uint8Array }>((_, reject) =>
        setTimeout(() => reject(new Error('Command timeout')), timeout)
      ),
    ]);

    return {
      stdout: new TextDecoder().decode(stdout),
      stderr: new TextDecoder().decode(stderr),
      exitCode: code,
      signal: null,
    };
  }

  private executeWithNodeSync(
    command: string,
    options: { cwd?: string; timeout?: number }
  ): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      const { execSync } = require('child_process');
      const { cwd, timeout } = options;

      const timeoutId = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, timeout);

      try {
        const stdout = execSync(command, {
          cwd,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        clearTimeout(timeoutId);
        resolve({
          stdout: stdout as string,
          stderr: '',
          exitCode: 0,
          signal: null,
        });
      } catch (error: any) {
        clearTimeout(timeoutId);
        resolve({
          stdout: error.stdout || '',
          stderr: error.stderr || error.message,
          exitCode: error.status || 1,
          signal: error.signal || null,
        });
      }
    });
  }

  private async spawnWithDeno(
    command: string,
    args: string[],
    options: ProcessOptions
  ): Promise<CrossPlatformProcess> {
    const Deno = (globalThis as any).Deno;

    const process = new Deno.Command(command, {
      args,
      cwd: options.cwd,
      env: options.env,
      stdout: 'piped',
      stderr: 'piped',
    });

    const child = process.spawn();

    const denoProcess: CrossPlatformProcess = {
      pid: child.pid || 0,

      get stdout(): ReadableStream<string> | undefined {
        return child.stdout?.getReader() as any;
      },

      get stderr(): ReadableStream<string> | undefined {
        return child.stderr?.getReader() as any;
      },

      kill(signal?: string | number): boolean {
        try {
          child.kill(signal);
          return true;
        } catch {
          return false;
        }
      },

      on(event: string, listener: (...args: any[]) => void): any {
        // Deno processes don't have event emitters like Node.js
        // This is a compatibility shim
        return this;
      },

      once(event: string, listener: (...args: any[]) => void): any {
        return this;
      },

      emit(event: string, ...args: any[]): boolean {
        return false;
      },
    };

    this.activeProcesses.set(child.pid, denoProcess);
    return denoProcess;
  }

  private async spawnWithNode(
    command: string,
    args: string[],
    options: ProcessOptions
  ): Promise<CrossPlatformProcess> {
    const { spawn } = await import('child_process');

    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: options.shell,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const nodeProcess: CrossPlatformProcess = {
      pid: child.pid || 0,

      get stdout(): ReadableStream<string> | undefined {
        return child.stdout as any;
      },

      get stderr(): ReadableStream<string> | undefined {
        return child.stderr as any;
      },

      kill(signal?: string | number): boolean {
        return child.kill(signal as any);
      },

      on(event: string, listener: (...args: any[]) => void): any {
        child.on(event, listener);
        return this;
      },

      once(event: string, listener: (...args: any[]) => void): any {
        child.once(event, listener);
        return this;
      },

      emit(event: string, ...args: any[]): boolean {
        return child.emit(event, ...args);
      },
    };

    this.activeProcesses.set(child.pid || 0, nodeProcess);

    child.on('exit', () => {
      this.activeProcesses.delete(child.pid || 0);
    });

    return nodeProcess;
  }

  async isCommandAvailable(command: string): Promise<boolean> {
    try {
      await this.executeCommand(`command -v ${command} || which ${command} || where ${command}`);
      return true;
    } catch {
      return false;
    }
  }

  getActiveProcesses(): ProcessInfo[] {
    return Array.from(this.activeProcesses.entries()).map(([pid, process]) => ({
      pid: pid || 0,
      command: 'unknown',
      args: [],
      running: true,
    }));
  }

  async killAllProcesses(): Promise<void> {
    for (const [pid, process] of this.activeProcesses) {
      try {
        process.kill();
        this.activeProcesses.delete(pid);
      } catch (error) {
        console.error(`Failed to kill process ${pid}:`, error);
      }
    }
  }
}

// Export singleton instance and utilities
export const processManager: ProcessManager = ProcessManager.getInstance();

// Utility functions for common operations
export async function executeCommand(command: string, options?: ProcessOptions): Promise<ProcessResult> {
  return processManager.executeCommand(command, options);
}

export async function spawnProcess(command: string, args?: string[], options?: ProcessOptions): Promise<CrossPlatformProcess> {
  return processManager.spawnProcess(command, args || [], options || {});
}

export async function isCommandAvailable(command: string): Promise<boolean> {
  return processManager.isCommandAvailable(command);
}