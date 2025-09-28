// Deno entry point for kode-acp
// This file exports the main functionality for Deno users

// Import from JSR-compatible entry point
export { default as runKodeAcp } from './src/jsr-index.ts';
export * from './src/jsr-index.ts';

// Re-export types for TypeScript users
export type {
  KodeACPConfig,
  KodeSession,
  KodeToolCall,
  KodeToolResult,
} from './src/types.ts';
export type {
  SimpleACPMessage,
  SimpleACPConnection,
} from './src/acp-agent-simple.ts';

// Deno-specific CLI entry point
export async function main() {
  const { runKodeAcp } = await import('./src/jsr-index.ts');
  return runKodeAcp();
}

// If this file is run directly, execute the main function
if (import.meta.main) {
  main();
}