// JSR-compatible entry point for @soddygo/kode-acp
// This file provides a cross-platform compatible version

import { KodeAcpAgentSimple, SimpleACPMessage, SimpleACPConnection } from './acp-agent-simple.ts';
import { KodeACPConfig } from './types.ts';
import { log } from './utils.ts';

// Export the main class
export { KodeAcpAgentSimple } from './acp-agent-simple.ts';

// Export config type
export type { KodeACPConfig } from './types.ts';

// Export session and tool types
export type {
  KodeSession,
  KodeToolCall,
  KodeToolResult
} from './types.ts';

// Export message and connection interfaces
export type {
  SimpleACPMessage,
  SimpleACPConnection
} from './acp-agent-simple.ts';

// Re-export utility functions
export {
  generateSessionId,
  log as logger,
  sanitizePath,
  isAbsolutePath,
  joinPaths
} from './utils.ts';

// Re-export process management utilities
export {
  ProcessManager,
  executeCommand,
  spawnProcess,
  isCommandAvailable,
  processManager
} from './process-manager.ts';

// Re-export event emitter
export { EventEmitter } from './event-emitter.ts';

// Re-export stream utilities
export {
  StreamConverter,
  StreamHelpers,
  StreamError,
  StreamValidator,
} from './stream-utils.ts';

// Re-export tool converter
export {
  ACPToolConverter,
  ToolPermissionManager,
  defaultToolConverter,
} from './tool-converter.ts';
export type {
  ToolPermission,
  PermissionMode,
  ToolMapping,
  ToolConverter,
} from './tool-converter.ts';

// Re-export session manager
export {
  SessionManager,
  sessionManager,
  SessionUtils,
  type SessionConfig,
  type SessionState,
  type SessionEvent,
} from './session-manager.ts';

// Lazy import for HTTP server (only when needed)
export async function getHttpServer(): Promise<any> {
  try {
    const httpModule = await import('./http-server.ts');
    return httpModule.createKodeAcpHttpServer;
  } catch {
    throw new Error('HTTP server not available on this platform');
  }
}

// Create a factory function for creating agent instances
export function createKodeAcpAgent(
  connection: SimpleACPConnection,
  config: KodeACPConfig = {}
): KodeAcpAgentSimple {
  return new KodeAcpAgentSimple(connection, config);
}

// Create a simple stdio connection factory
export function createStdioConnection(): SimpleACPConnection {
  return {
    async send(message: SimpleACPMessage): Promise<void> {
      console.log(JSON.stringify(message));
    },

    async *receive(): AsyncIterable<SimpleACPMessage> {
      // Try to use Node.js readline if available
      try {
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          terminal: false,
        });

        for await (const line of rl) {
          try {
            const message: SimpleACPMessage = JSON.parse(line);
            yield message;
          } catch (error) {
            log('error', 'Failed to parse message:', error);
          }
        }
      } catch {
        // Fallback for Deno or other environments
        const decoder = new TextDecoder();
        const buffer = new Uint8Array(1024);

        while (true) {
          const n = await Deno.stdin.read(buffer);
          if (n === null) break;

          const line = decoder.decode(buffer.subarray(0, n)).trim();
          if (line) {
            try {
              const message: SimpleACPMessage = JSON.parse(line);
              yield message;
            } catch (error) {
              log('error', 'Failed to parse message:', error);
            }
          }
        }
      }
    },
  };
}

// Main function for JSR users
export async function runKodeAcp(config?: KodeACPConfig): Promise<void> {
  const connection = createStdioConnection();
  const agent = createKodeAcpAgent(connection, config);

  try {
    await agent.initialize();

    // Handle incoming messages
    for await (const message of connection.receive()) {
      try {
        const response = await agent.handleMessage(message);
        if (response) {
          await connection.send(response);
        }
      } catch (error) {
        log('error', 'Failed to handle message:', error);
        await connection.send({
          type: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    log('error', 'Kode ACP agent failed:', error);
    if (typeof process !== 'undefined') {
      process.exit(1);
    } else {
      Deno.exit(1);
    }
  }
}

// Default export
export default runKodeAcp;