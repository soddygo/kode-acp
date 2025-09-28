#!/usr/bin/env node

import { createServer } from 'http';
import { KodeAcpAgentSimple, SimpleACPMessage, SimpleACPConnection } from './acp-agent-simple.ts';
import { KodeACPConfig } from './types.ts';
import { log } from './utils.ts';
import { parseArgs } from 'node:util';

// Redirect console.log to stderr to avoid interfering with ACP protocol
console.log = console.error;
console.info = console.error;
console.warn = console.error;
console.debug = console.error;

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Parse command line arguments
const args = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: {
      type: 'boolean',
      short: 'h',
    },
    version: {
      type: 'boolean',
      short: 'v',
    },
    'working-directory': {
      type: 'string',
      short: 'd',
    },
    'permission-mode': {
      type: 'string',
    },
    'log-level': {
      type: 'string',
    },
    port: {
      type: 'string',
      short: 'p',
    },
  },
  allowPositionals: false,
});

if (args.values.help) {
  console.log(`
Kode ACP Agent - Use Kode with ACP-compatible clients

USAGE:
  kode-acp [OPTIONS]

OPTIONS:
  -h, --help                 Show this help message
  -v, --version              Show version information
  -d, --working-directory DIR Set working directory [default: current directory]
      --permission-mode MODE Set permission mode [safe|yolo] [default: yolo]
      --log-level LEVEL      Set log level [debug|info|warn|error] [default: info]
  -p, --port PORT           Run as HTTP server on specified port

EXAMPLES:
  kode-acp                                    Run as stdio agent
  kode-acp --port 8080                       Run as HTTP server
  kode-acp --working-directory /path/to/project  Set working directory
  kode-acp --permission-mode safe           Enable safe mode
  kode-acp --log-level debug                 Enable debug logging

ENVIRONMENT VARIABLES:
  KODE_WORKING_DIRECTORY        Working directory
  KODE_PERMISSION_MODE         Permission mode (safe|yolo)
  KODE_LOG_LEVEL              Log level (debug|info|warn|error)
  KODE_PORT                   HTTP server port

For more information, visit: https://github.com/shareAI-lab/kode
`);
  process.exit(0);
}

if (args.values.version) {
  console.log('kode-acp v0.1.0');
  process.exit(0);
}

// Create configuration
const config: KodeACPConfig = {
  workingDirectory: args.values['working-directory'] || process.env.KODE_WORKING_DIRECTORY || process.cwd(),
  permissionMode: (args.values['permission-mode'] as 'safe' | 'yolo') || (process.env.KODE_PERMISSION_MODE as 'safe' | 'yolo') || 'yolo',
  logLevel: (args.values['log-level'] as 'debug' | 'info' | 'warn' | 'error') || (process.env.KODE_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
};

const port = args.values.port || process.env.KODE_PORT;

async function runAcpAgent() {
  log('info', 'Starting Kode ACP agent...');
  log('info', `Working directory: ${config.workingDirectory}`);
  log('info', `Permission mode: ${config.permissionMode}`);
  log('info', `Log level: ${config.logLevel}`);

  if (port) {
    // Run as HTTP server
    await runHttpServer(port);
  } else {
    // Run as stdio agent
    await runStdioAgent();
  }
}

async function runStdioAgent() {
  try {
    // Create stdio connection
    const connection: SimpleACPConnection = {
      async send(message: SimpleACPMessage) {
        console.log(JSON.stringify(message));
      },

      async *receive() {
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
      },
    };

    const agent = new KodeAcpAgentSimple(connection, config);

    // Initialize the agent
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
    log('error', 'Stdio agent failed:', error);
    process.exit(1);
  }
}

async function runHttpServer(port: string) {
  const server = createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/acp') {
      try {
        const body = await getRequestBody(req);
        const message: SimpleACPMessage = JSON.parse(body);

        const connection: SimpleACPConnection = {
          async send(response: SimpleACPMessage) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
          },

          async *receive() {
            // HTTP server doesn't need receive method for incoming messages
            // since each request is handled separately
            // Return an empty iterator
            return;
          },
        };

        const agent = new KodeAcpAgentSimple(connection, config);
        await agent.initialize();

        const response = await agent.handleMessage(message);
        if (response) {
          await connection.send(response);
        }
      } catch (error) {
        log('error', 'HTTP request failed:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : String(error),
        }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(parseInt(port), () => {
    log('info', `Kode ACP HTTP server listening on port ${port}`);
    log('info', `Health check: http://localhost:${port}/health`);
    log('info', `ACP endpoint: http://localhost:${port}/acp`);
  });

  server.on('error', (error) => {
    log('error', 'HTTP server error:', error);
    process.exit(1);
  });
}

function getRequestBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(body);
    });
    req.on('error', reject);
  });
}

// Start the agent
runAcpAgent().catch((error) => {
  log('error', 'Failed to start Kode ACP agent:', error);
  process.exit(1);
});

// Keep process alive
process.stdin.resume();