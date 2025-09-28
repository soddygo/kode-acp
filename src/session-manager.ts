// Advanced session management for ACP protocol
// Based on the reference project's session lifecycle patterns

import { EventEmitter } from './event-emitter.ts';
import { log, generateSessionId } from './utils.ts';
import { ToolPermissionManager } from './tool-converter.ts';

export interface SessionConfig {
  id?: string;
  mode?: 'default' | 'accept_edits' | 'bypass_permissions' | 'plan';
  workingDirectory?: string;
  permissionMode?: 'yolo' | 'conservative';
  timeout?: number;
  maxToolCalls?: number;
}

export interface SessionState {
  id: string;
  mode: string;
  workingDirectory: string;
  permissionMode: string;
  createdAt: number;
  lastActivity: number;
  toolCallCount: number;
  isActive: boolean;
  metadata: Map<string, any>;
}

export interface SessionEvent {
  type: 'created' | 'updated' | 'destroyed' | 'timeout' | 'mode_changed';
  sessionId: string;
  timestamp: number;
  data?: any;
}

export class SessionManager extends EventEmitter {
  private sessions: Map<string, SessionState> = new Map();
  private permissionManager: ToolPermissionManager;
  private cleanupInterval: number | null = null;
  private defaultSessionTimeout: number = 1800000; // 30 minutes
  private maxSessions: number = 100;

  constructor() {
    super();
    this.permissionManager = new ToolPermissionManager();
    this.startCleanupInterval();
  }

  async createSession(config: SessionConfig = {}): Promise<string> {
    const sessionId = config.id || generateSessionId();

    if (this.sessions.size >= this.maxSessions) {
      await this.cleanupExpiredSessions();

      if (this.sessions.size >= this.maxSessions) {
        throw new Error(`Maximum session limit (${this.maxSessions}) reached`);
      }
    }

    const session: SessionState = {
      id: sessionId,
      mode: config.mode || 'default',
      workingDirectory: config.workingDirectory || this.getCurrentWorkingDirectory(),
      permissionMode: config.permissionMode || 'yolo',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      toolCallCount: 0,
      isActive: true,
      metadata: new Map(),
    };

    this.sessions.set(sessionId, session);

    // Set permission mode for the session
    this.permissionManager.setMode(session.mode);

    this.emit('session_event', {
      type: 'created',
      sessionId,
      timestamp: Date.now(),
      data: { session },
    });

    log('info', `Session created: ${sessionId} (mode: ${session.mode})`);
    return sessionId;
  }

  async getSession(sessionId: string): Promise<SessionState | null> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    // Update last activity
    session.lastActivity = Date.now();
    this.sessions.set(sessionId, session);

    return { ...session };
  }

  async updateSession(
    sessionId: string,
    updates: Partial<SessionConfig>
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return false;
    }

    const oldMode = session.mode;
    const changes: string[] = [];

    if (updates.mode && updates.mode !== session.mode) {
      session.mode = updates.mode;
      this.permissionManager.setMode(updates.mode);
      changes.push(`mode: ${updates.mode}`);
    }

    if (updates.workingDirectory && updates.workingDirectory !== session.workingDirectory) {
      session.workingDirectory = updates.workingDirectory;
      changes.push(`workingDirectory: ${updates.workingDirectory}`);
    }

    if (updates.permissionMode && updates.permissionMode !== session.permissionMode) {
      session.permissionMode = updates.permissionMode;
      changes.push(`permissionMode: ${updates.permissionMode}`);
    }

    session.lastActivity = Date.now();
    this.sessions.set(sessionId, session);

    if (changes.length > 0) {
      this.emit('session_event', {
        type: 'updated',
        sessionId,
        timestamp: Date.now(),
        data: { changes },
      });

      if (oldMode !== session.mode) {
        this.emit('session_event', {
          type: 'mode_changed',
          sessionId,
          timestamp: Date.now(),
          data: { oldMode, newMode: session.mode },
        });
      }

      log('info', `Session updated: ${sessionId} (${changes.join(', ')})`);
    }

    return true;
  }

  async destroySession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return false;
    }

    session.isActive = false;
    this.sessions.delete(sessionId);

    this.emit('session_event', {
      type: 'destroyed',
      sessionId,
      timestamp: Date.now(),
      data: { session },
    });

    log('info', `Session destroyed: ${sessionId}`);
    return true;
  }

  async incrementToolCall(sessionId: string): Promise<number> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return 0;
    }

    session.toolCallCount++;
    session.lastActivity = Date.now();
    this.sessions.set(sessionId, session);

    return session.toolCallCount;
  }

  async checkToolPermission(
    sessionId: string,
    toolName: string,
    input?: any
  ): Promise<boolean> {
    const session = await this.getSession(sessionId);

    if (!session) {
      log('warn', `Session not found: ${sessionId}`);
      return false;
    }

    return this.permissionManager.requestPermission(toolName, input);
  }

  async listSessions(): Promise<SessionState[]> {
    return Array.from(this.sessions.values()).map(session => ({ ...session }));
  }

  async getActiveSessions(): Promise<SessionState[]> {
    return Array.from(this.sessions.values())
      .filter(session => session.isActive)
      .map(session => ({ ...session }));
  }

  async getSessionStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    totalToolCalls: number;
  }> {
    const now = Date.now();
    const sessions = Array.from(this.sessions.values());

    const active = sessions.filter(s => s.isActive && (now - s.lastActivity) < this.defaultSessionTimeout).length;
    const expired = sessions.filter(s => !s.isActive || (now - s.lastActivity) >= this.defaultSessionTimeout).length;
    const totalToolCalls = sessions.reduce((sum, s) => sum + s.toolCallCount, 0);

    return {
      total: sessions.length,
      active,
      expired,
      totalToolCalls,
    };
  }

  private async cleanupExpiredSessions(): Promise<number> {
    const now = Date.now();
    const expired: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (!session.isActive || (now - session.lastActivity) >= this.defaultSessionTimeout) {
        expired.push(sessionId);
      }
    }

    for (const sessionId of expired) {
      await this.destroySession(sessionId);
    }

    if (expired.length > 0) {
      this.emit('session_event', {
        type: 'timeout',
        sessionId: '',
        timestamp: now,
        data: { expiredSessions: expired },
      });
    }

    return expired.length;
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions().catch(error => {
        log('error', 'Session cleanup failed:', error);
      });
    }, 300000); // Run every 5 minutes

    // Clear interval on process exit
    process.on('exit', () => {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
    });
  }

  private getCurrentWorkingDirectory(): string {
    return typeof process !== 'undefined' ? process.cwd() : (globalThis as any).Deno?.cwd() || '.';
  }

  // Session metadata management
  async setSessionMetadata(
    sessionId: string,
    key: string,
    value: any
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return false;
    }

    session.metadata.set(key, value);
    session.lastActivity = Date.now();
    this.sessions.set(sessionId, session);

    return true;
  }

  async getSessionMetadata(
    sessionId: string,
    key: string
  ): Promise<any | undefined> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return undefined;
    }

    return session.metadata.get(key);
  }

  async getAllSessionMetadata(sessionId: string): Promise<Record<string, any>> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return {};
    }

    return Object.fromEntries(session.metadata);
  }

  // Session migration and export
  async exportSession(sessionId: string): Promise<object | null> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return null;
    }

    return {
      id: session.id,
      mode: session.mode,
      workingDirectory: session.workingDirectory,
      permissionMode: session.permissionMode,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      toolCallCount: session.toolCallCount,
      metadata: Object.fromEntries(session.metadata),
    };
  }

  async importSession(sessionData: any): Promise<string> {
    const sessionId = sessionData.id || generateSessionId();

    const session: SessionState = {
      id: sessionId,
      mode: sessionData.mode || 'default',
      workingDirectory: sessionData.workingDirectory || this.getCurrentWorkingDirectory(),
      permissionMode: sessionData.permissionMode || 'yolo',
      createdAt: sessionData.createdAt || Date.now(),
      lastActivity: sessionData.lastActivity || Date.now(),
      toolCallCount: sessionData.toolCallCount || 0,
      isActive: true,
      metadata: new Map(Object.entries(sessionData.metadata || {})),
    };

    this.sessions.set(sessionId, session);
    this.permissionManager.setMode(session.mode);

    this.emit('session_event', {
      type: 'created',
      sessionId,
      timestamp: Date.now(),
      data: { session, imported: true },
    });

    log('info', `Session imported: ${sessionId}`);
    return sessionId;
  }

  // Cleanup
  async destroyAllSessions(): Promise<number> {
    const sessionIds = Array.from(this.sessions.keys());
    let destroyed = 0;

    for (const sessionId of sessionIds) {
      if (await this.destroySession(sessionId)) {
        destroyed++;
      }
    }

    return destroyed;
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.removeAllListeners();
  }
}

// Export singleton instance
export const sessionManager: SessionManager = new SessionManager();

// Session utilities
export class SessionUtils {
  static validateSessionId(sessionId: string): boolean {
    return typeof sessionId === 'string' && sessionId.length > 0 && /^[a-zA-Z0-9_-]+$/.test(sessionId);
  }

  static formatSessionDuration(session: SessionState): string {
    const duration = Date.now() - session.createdAt;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  static getSessionHealth(session: SessionState): 'excellent' | 'good' | 'warning' | 'critical' {
    const age = Date.now() - session.createdAt;
    const inactivity = Date.now() - session.lastActivity;

    if (inactivity > this.defaultSessionTimeout * 0.8) {
      return 'critical';
    } else if (inactivity > this.defaultSessionTimeout * 0.5) {
      return 'warning';
    } else if (age > this.defaultSessionTimeout * 0.3) {
      return 'good';
    } else {
      return 'excellent';
    }
  }

  private static defaultSessionTimeout: number = 1800000;
}