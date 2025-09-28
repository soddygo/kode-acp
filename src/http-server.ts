// Cross-platform HTTP server implementation
// This file provides HTTP server functionality for platforms that support it

import { KodeAcpAgentSimple, SimpleACPMessage, SimpleACPConnection } from './acp-agent-simple.ts';
import { KodeACPConfig } from './types.ts';
import { log } from './utils.ts';

// Type definitions for HTTP server
export interface HttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
}

export interface HttpServer {
  listen(port: number, callback?: () => void): void;
  close(): void;
  on(event: string, callback: (req: HttpRequest, res: HttpResponse) => void): void;
}

// Factory function to create HTTP server (platform-specific)
export async function createHttpServer(): Promise<HttpServer> {
  // Try to use Node.js http module if available
  try {
    const http = await import('http');
    return new NodeHttpServer(http);
  } catch {
    // Try to use Deno HTTP server if available
    try {
      // @ts-ignore - Deno specific APIs
      if (typeof Deno !== 'undefined') {
        return new DenoHttpServer();
      }
    } catch {
      throw new Error('HTTP server not supported on this platform');
    }
    throw new Error('HTTP server not supported on this platform');
  }
}

// Node.js HTTP server implementation
class NodeHttpServer implements HttpServer {
  private server: any;
  private requestHandlers: Array<(req: HttpRequest, res: HttpResponse) => void> = [];

  constructor(private http: any) {
    this.server = this.http.createServer();
    this.setupServer();
  }

  private setupServer() {
    this.server.on('request', (req: any, res: any) => {
      const httpRequest: HttpRequest = {
        method: req.method,
        url: req.url,
        headers: req.headers,
      };

      const httpResponse: HttpResponse = {
        statusCode: 200,
        headers: {},
        body: '',
      };

      // Call all handlers
      for (const handler of this.requestHandlers) {
        handler(httpRequest, httpResponse);
      }

      // Send response
      res.writeHead(httpResponse.statusCode, httpResponse.headers);
      if (httpResponse.body) {
        res.end(httpResponse.body);
      } else {
        res.end();
      }
    });
  }

  listen(port: number, callback?: () => void): void {
    this.server.listen(port, callback);
  }

  close(): void {
    this.server.close();
  }

  on(event: string, callback: (req: HttpRequest, res: HttpResponse) => void): void {
    if (event === 'request') {
      this.requestHandlers.push(callback);
    }
  }
}

// Deno HTTP server implementation
class DenoHttpServer implements HttpServer {
  private server?: any;
  private requestHandlers: Array<(req: HttpRequest, res: HttpResponse) => void> = [];

  async listen(port: number, callback?: () => void): Promise<void> {
    try {
      // @ts-ignore - Deno specific APIs
      this.server = Deno.listen({ port });
      callback?.();

      // Start serving requests
      this.handleConnections();
    } catch (error) {
      throw new Error(`Failed to start Deno HTTP server: ${error}`);
    }
  }

  private async handleConnections() {
    if (!this.server) return;

    try {
      // @ts-ignore - Deno specific APIs
      for await (const conn of this.server) {
        this.handleConnection(conn);
      }
    } catch (error) {
      log('error', 'HTTP server connection error:', error);
    }
  }

  private async handleConnection(conn: any) {
    try {
      // @ts-ignore - Deno specific APIs
      const httpConn = Deno.serveHttp(conn);

      // @ts-ignore - Deno specific APIs
      for await (const requestEvent of httpConn) {
        const httpRequest: HttpRequest = {
          method: requestEvent.request.method,
          url: requestEvent.request.url,
          headers: Object.fromEntries(requestEvent.request.headers.entries()),
        };

        const httpResponse: HttpResponse = {
          statusCode: 200,
          headers: {},
          body: '',
        };

        // Call all handlers
        for (const handler of this.requestHandlers) {
          handler(httpRequest, httpResponse);
        }

        // Send response
        await requestEvent.respondWith(
          // @ts-ignore - Deno specific APIs
          new Response(httpResponse.body, {
            status: httpResponse.statusCode,
            headers: httpResponse.headers,
          })
        );
      }
    } catch (error) {
      log('error', 'HTTP connection handling error:', error);
    }
  }

  close(): void {
    if (this.server) {
      // @ts-ignore - Deno specific APIs
      this.server.close();
    }
  }

  on(event: string, callback: (req: HttpRequest, res: HttpResponse) => void): void {
    if (event === 'request') {
      this.requestHandlers.push(callback);
    }
  }
}

// HTTP server factory for Kode ACP
export async function createKodeAcpHttpServer(
  config: KodeACPConfig = {},
  port: number = 8080
): Promise<HttpServer> {
  const server = await createHttpServer();

  server.on('request', async (req: HttpRequest, res: HttpResponse) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.statusCode = 200;
      res.headers = { 'Content-Type': 'application/json' };
      res.body = JSON.stringify({ status: 'healthy' });
      return;
    }

    if (req.method === 'POST' && req.url === '/acp') {
      try {
        const message: SimpleACPMessage = JSON.parse(req.body || '{}');

        const connection: SimpleACPConnection = {
          async send(response: SimpleACPMessage): Promise<void> {
            res.statusCode = 200;
            res.headers = { 'Content-Type': 'application/json' };
            res.body = JSON.stringify(response);
          },

          async *receive(): AsyncIterable<SimpleACPMessage> {
            // HTTP server doesn't need receive method for incoming messages
            // since each request is handled separately
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
        res.statusCode = 500;
        res.headers = { 'Content-Type': 'application/json' };
        res.body = JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    // 404 for other routes
    res.statusCode = 404;
    res.headers = { 'Content-Type': 'application/json' };
    res.body = JSON.stringify({ error: 'Not found' });
  });

  server.listen(port, () => {
    log('info', `Kode ACP HTTP server listening on port ${port}`);
    log('info', `Health check: http://localhost:${port}/health`);
    log('info', `ACP endpoint: http://localhost:${port}/acp`);
  });

  server.on('error', (error: any) => {
    log('error', 'HTTP server error:', error);
  });

  return server;
}