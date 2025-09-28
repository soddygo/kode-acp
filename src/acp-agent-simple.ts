import { KodeIntegration } from './kode-integration.ts';
import { MultiModelManager } from './multi-model.ts';
import { KodeACPConfig, KodeSession, KodeToolCall } from './types.ts';
import { log, generateSessionId } from './utils.ts';

export interface SimpleACPMessage {
  type: string;
  [key: string]: any;
}

export interface SimpleACPConnection {
  send(message: SimpleACPMessage): Promise<void>;
  receive(): AsyncIterable<SimpleACPMessage>;
}

export class KodeAcpAgentSimple {
  private connection: SimpleACPConnection;
  private kodeIntegration: KodeIntegration;
  private multiModelManager: MultiModelManager;
  private sessions: Map<string, KodeSession> = new Map();
  private config: KodeACPConfig;

  constructor(connection: SimpleACPConnection, config: KodeACPConfig = {}) {
    this.connection = connection;
    this.config = {
      workingDirectory: process.cwd(),
      permissionMode: 'yolo',
      logLevel: 'info',
      ...config,
    };
    this.kodeIntegration = new KodeIntegration(this.config);
    this.multiModelManager = new MultiModelManager(this.config);
  }

  async initialize(): Promise<void> {
    try {
      await this.kodeIntegration.initialize();
      log('info', 'Kode ACP agent initialized successfully');
    } catch (error) {
      log('error', 'Failed to initialize Kode ACP agent:', error);
      throw error;
    }
  }

  async handleMessage(message: SimpleACPMessage): Promise<SimpleACPMessage | void> {
    switch (message.type) {
      case 'initialize':
        return this.handleInitialize(message);
      case 'new_session':
        return this.handleNewSession(message);
      case 'prompt':
        return this.handlePrompt(message);
      case 'tool_call':
        return this.handleToolCall(message);
      case 'model_command':
        return this.handleModelCommand(message);
      case 'list_models':
        return this.handleListModels(message);
      default:
        log('warn', `Unknown message type: ${message.type}`);
        return {
          type: 'error',
          error: `Unknown message type: ${message.type}`,
        };
    }
  }

  private async handleInitialize(message: SimpleACPMessage): Promise<SimpleACPMessage> {
    return {
      type: 'initialize_response',
      protocolVersion: 1,
      capabilities: {
        tools: true,
        multiModel: true,
        fileOperations: true,
        bashCommands: true,
      },
      availableModels: this.multiModelManager.getAvailableModelNames(),
    };
  }

  private async handleNewSession(message: SimpleACPMessage): Promise<SimpleACPMessage> {
    const sessionId = generateSessionId();
    const session: KodeSession = {
      id: sessionId,
      workingDirectory: this.config.workingDirectory || process.cwd(),
      cancelled: false,
      permissionMode: this.config.permissionMode || 'yolo',
    };

    this.sessions.set(sessionId, session);
    log('info', `New session created: ${sessionId}`);

    return {
      type: 'new_session_response',
      sessionId,
    };
  }

  private async handlePrompt(message: SimpleACPMessage): Promise<SimpleACPMessage> {
    const { sessionId, prompt } = message;

    if (!sessionId || !prompt) {
      return {
        type: 'error',
        error: 'Missing sessionId or prompt',
      };
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        type: 'error',
        error: `Session not found: ${sessionId}`,
      };
    }

    if (session.cancelled) {
      return {
        type: 'error',
        error: 'Session was cancelled',
      };
    }

    try {
      // Use the current model to generate a response
      const currentModel = this.multiModelManager.getCurrentModelProfile();
      const response = await this.multiModelManager.executeWithModel(prompt);

      return {
        type: 'prompt_response',
        sessionId,
        response: {
          type: 'text',
          text: `[${currentModel?.name || 'Unknown'}] ${response}`,
          model: currentModel?.name || 'Unknown',
        },
      };
    } catch (error) {
      log('error', 'Model execution failed:', error);
      return {
        type: 'error',
        error: `Model execution failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async handleToolCall(message: SimpleACPMessage): Promise<SimpleACPMessage> {
    const { sessionId, toolCall } = message;

    if (!sessionId || !toolCall) {
      return {
        type: 'error',
        error: 'Missing sessionId or toolCall',
      };
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        type: 'error',
        error: `Session not found: ${sessionId}`,
      };
    }

    try {
      const kodeToolCall: KodeToolCall = {
        name: toolCall.name,
        input: toolCall.input,
        id: toolCall.id || generateSessionId(),
      };

      // Execute the tool
      const result = await this.kodeIntegration.executeTool(kodeToolCall);

      return {
        type: 'tool_call_response',
        sessionId,
        toolCallId: kodeToolCall.id,
        result,
      };
    } catch (error) {
      log('error', 'Tool call failed:', error);
      return {
        type: 'error',
        error: `Tool call failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async handleModelCommand(message: SimpleACPMessage): Promise<SimpleACPMessage> {
    const { command, modelName } = message;

    switch (command) {
      case 'switch':
        if (modelName && this.multiModelManager.getModelProfile(modelName)) {
          this.multiModelManager.setCurrentModel(modelName);
          return {
            type: 'model_response',
            success: true,
            message: `Switched to model: ${modelName}`,
            currentModel: modelName,
          };
        } else {
          const availableModels = this.multiModelManager.getAvailableModelNames();
          return {
            type: 'model_response',
            success: false,
            message: `Model not found: ${modelName}`,
            availableModels,
          };
        }

      case 'ask':
        if (!modelName || !message.prompt) {
          return {
            type: 'error',
            error: 'Missing modelName or prompt for ask command',
          };
        }

        const expertModel = this.multiModelManager.getModelProfile(modelName);
        if (!expertModel) {
          return {
            type: 'error',
            error: `Model not found: ${modelName}`,
          };
        }

        try {
          const response = await this.multiModelManager.executeWithModel(message.prompt, modelName);
          return {
            type: 'model_response',
            success: true,
            model: modelName,
            response,
          };
        } catch (error) {
          return {
            type: 'error',
            error: `Expert model call failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }

      default:
        return {
          type: 'error',
          error: `Unknown model command: ${command}`,
        };
    }
  }

  private async handleListModels(message: SimpleACPMessage): Promise<SimpleACPMessage> {
    const models = this.multiModelManager.getAllModelProfiles();
    const currentModel = this.multiModelManager.getCurrentModel();

    return {
      type: 'models_response',
      models: models.map(model => ({
        name: model.name,
        provider: model.provider,
        isCurrent: model.name === currentModel,
      })),
      currentModel,
    };
  }

  async cleanup(): Promise<void> {
    // Clean up all sessions
    for (const session of this.sessions.values()) {
      session.cancelled = true;
    }
    this.sessions.clear();

    // Clean up Kode integration
    await this.kodeIntegration.cleanup();

    log('info', 'Kode ACP agent cleaned up');
  }
}