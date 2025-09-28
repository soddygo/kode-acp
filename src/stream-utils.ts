// Cross-platform stream utilities for JSR compatibility
// Based on the reference project's stream handling patterns

export interface StreamOptions {
  encoding?: 'utf8' | 'ascii' | 'utf16le' | 'ucs2' | 'base64' | 'latin1' | 'binary' | 'hex';
  autoDestroy?: boolean;
}

export class StreamConverter {
  // Convert Node.js Readable to Web Streams
  static nodeToWebReadable(nodeStream: any): ReadableStream<Uint8Array> {
    if (!nodeStream) {
      return new ReadableStream({
        start(controller) {
          controller.close();
        },
      });
    }

    return new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk: any) => {
          if (chunk instanceof Uint8Array) {
            controller.enqueue(chunk);
          } else if (typeof chunk === 'string') {
            controller.enqueue(new TextEncoder().encode(chunk));
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

  // Convert Web Streams to Node.js Writable
  static webToNodeWritable(webStream: WritableStream<Uint8Array>): any {
    const writer = webStream.getWriter();

    return {
      write: (chunk: any, callback: (error?: Error | null) => void) => {
        if (chunk instanceof Uint8Array) {
          writer.write(chunk).then(() => callback(null), callback);
        } else if (typeof chunk === 'string') {
          writer.write(new TextEncoder().encode(chunk)).then(() => callback(null), callback);
        } else {
          writer.write(new TextEncoder().encode(chunk.toString())).then(() => callback(null), callback);
        }
      },

      end: (callback?: (error?: Error | null) => void) => {
        writer.close().then(() => callback?.(null), callback);
      },

      destroy: (error?: Error) => {
        writer.abort(error).catch(() => {});
      },
    };
  }

  // Create a transform stream for text processing
  static createTextTransform(
    transform: (text: string) => string | Promise<string>
  ): TransformStream<string, string> {
    return new TransformStream({
      async transform(chunk, controller) {
        const result = await transform(chunk);
        controller.enqueue(result);
      },
    });
  }

  // Create a line-by-line transform stream
  static createLineTransform(): TransformStream<string, string> {
    let buffer = '';

    return new TransformStream({
      transform(chunk, controller) {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          controller.enqueue(line);
        }
      },

      flush(controller) {
        if (buffer) {
          controller.enqueue(buffer);
        }
      },
    });
  }
}

// Stream helper utilities
export class StreamHelpers {
  // Convert stream to string
  static async streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let result = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }

    return result + decoder.decode();
  }

  // Convert string to stream
  static stringToStream(text: string): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    });
  }

  // Create a passthrough stream
  static createPassthrough(): TransformStream<Uint8Array, Uint8Array> {
    return new TransformStream();
  }

  // Create a stream that emits at intervals
  static createIntervalStream(
    data: string | Uint8Array,
    interval: number,
    count: number = Infinity
  ): ReadableStream<Uint8Array> {
    let counter = 0;

    return new ReadableStream({
      async start(controller) {
        const encoder = data instanceof Uint8Array ? null : new TextEncoder();

        const emit = () => {
          if (counter >= count) {
            controller.close();
            return;
          }

          const chunk = encoder ? encoder.encode(data as string) : data;
          controller.enqueue(chunk as Uint8Array);
          counter++;

          if (counter < count) {
            setTimeout(emit, interval);
          } else {
            controller.close();
          }
        };

        setTimeout(emit, interval);
      },
    });
  }
}

// Error handling utilities
export class StreamError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'StreamError';
  }
}

// Stream validation utilities
export class StreamValidator {
  static validateReadableStream(stream: any): stream is ReadableStream {
    return stream && typeof stream.getReader === 'function';
  }

  static validateWritableStream(stream: any): stream is WritableStream {
    return stream && typeof stream.getWriter === 'function';
  }

  static validateTransformStream(stream: any): stream is TransformStream {
    return stream &&
           typeof stream.readable === 'object' &&
           typeof stream.writable === 'object';
  }
}