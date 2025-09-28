import { v7 as uuidv7 } from 'uuid';
import { Readable, Writable } from 'stream';
import { TextDecoder, TextEncoder } from 'util';

export function nodeToWebReadable(nodeStream: Readable): ReadableStream<Uint8Array> {
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
      nodeStream.on('error', (error) => {
        controller.error(error);
      });
    },
  });
}

export function nodeToWebWritable(nodeStream: Writable): WritableStream<Uint8Array> {
  return new WritableStream({
    write(chunk) {
      return new Promise((resolve, reject) => {
        nodeStream.write(chunk, (error) => {
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

export function unreachable(x: never): never {
  throw new Error(`Unreachable code reached: ${x}`);
}

export function generateSessionId(): string {
  return uuidv7();
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