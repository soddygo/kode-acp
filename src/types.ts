export interface KodeSession {
  id: string;
  workingDirectory: string;
  cancelled: boolean;
  permissionMode: 'safe' | 'yolo';
}

export interface KodeToolCall {
  name: string;
  input: any;
  id?: string;
}

export interface KodeToolResult {
  type: 'tool_result';
  content: any;
  tool_use_id: string;
  is_error: boolean;
}

export interface ACPToolInfo {
  title: string;
  kind: 'read' | 'write' | 'edit' | 'execute' | 'search' | 'fetch' | 'think' | 'other';
  content: ACPToolCallContent[];
  locations?: ACPToolCallLocation[];
}

export interface ACPToolCallContent {
  type: 'content' | 'diff';
  content?: { type: 'text'; text: string };
  path?: string;
  oldText?: string;
  newText?: string;
}

export interface ACPToolCallLocation {
  path: string;
  line?: number;
}

export interface KodeACPConfig {
  workingDirectory?: string;
  permissionMode?: 'safe' | 'yolo';
  defaultModel?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}