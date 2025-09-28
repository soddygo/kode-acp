// Deno entry point for kode-acp
// This file exports the main functionality for Deno users

// Import the main module from the built distribution
export { default } from './dist/index.js';
export * from './dist/index.js';

// Re-export types for TypeScript users
export type {
  KodeACPConfig,
  KodeSession,
  KodeToolCall,
  KodeToolResult,
  SimpleACPMessage,
  SimpleACPConnection,
} from './dist/types.js';

// Deno-specific CLI entry point
export async function main() {
  const module = await import('./dist/index.js');
  return module.default();
}

// If this file is run directly, execute the main function
if (import.meta.main) {
  main();
}