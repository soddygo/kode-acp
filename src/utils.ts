// Cross-platform utilities for JSR compatibility

// Try to import crypto.randomUUID for UUID generation
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback implementation for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Conditional import for Node.js stream utilities (only when available)
export function nodeToWebReadable(nodeStream: any): ReadableStream<Uint8Array> {
  try {
    // Only import stream if it's available
    const { Readable } = require('stream');
    if (nodeStream instanceof Readable) {
      return new ReadableStream({
        start(controller) {
          nodeStream.on('data', (chunk: any) => {
            if (chunk instanceof Uint8Array) {
              controller.enqueue(chunk);
            } else {
              controller.enqueue(new TextEncoder().encode(chunk.toString()));
            }
          });
          nodeStream.on('end', () => {
            controller.close();
          });
          nodeStream.on('error', (error: any) => {
            controller.error(error);
          });
        },
      });
    }
  } catch {
    // If stream is not available, return a simple readable stream
    return new ReadableStream({
      start(controller) {
        controller.close();
      },
    });
  }

  // Fallback for other cases
  return new ReadableStream({
    start(controller) {
      controller.close();
    },
  });
}

export function nodeToWebWritable(nodeStream: any): WritableStream<Uint8Array> {
  try {
    // Only import stream if it's available
    const { Writable } = require('stream');
    if (nodeStream instanceof Writable) {
      return new WritableStream({
        write(chunk) {
          return new Promise((resolve, reject) => {
            nodeStream.write(chunk, (error: any) => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          });
        },
        close() {
          return new Promise((resolve) => {
            nodeStream.end(resolve);
          });
        },
        abort(error) {
          return new Promise((resolve) => {
            nodeStream.destroy(error);
            resolve();
          });
        },
      });
    }
  } catch {
    // If stream is not available, return a simple writable stream
    return new WritableStream({
      write(chunk) {
        return Promise.resolve();
      },
      close() {
        return Promise.resolve();
      },
      abort() {
        return Promise.resolve();
      },
    });
  }

  // Fallback for other cases
  return new WritableStream({
    write(chunk) {
      return Promise.resolve();
    },
    close() {
      return Promise.resolve();
    },
    abort() {
      return Promise.resolve();
    },
  });
}

export function unreachable(x: never): never {
  throw new Error(`Unreachable code reached: ${x}`);
}

export function generateSessionId(): string {
  return generateUUID();
}

export function sanitizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || Boolean(path.match(/^[A-Za-z]:/));
}

export function joinPaths(base: string, path: string): string {
  const sanitizedBase = sanitizePath(base);
  const sanitizedPath = sanitizePath(path);

  if (isAbsolutePath(sanitizedPath)) {
    return sanitizedPath;
  }

  return `${sanitizedBase}/${sanitizedPath}`;
}

export function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  if (args.length > 0) {
    console.error(formattedMessage, ...args);
  } else {
    console.error(formattedMessage);
  }
}