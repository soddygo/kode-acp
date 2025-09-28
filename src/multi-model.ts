import { KodeACPConfig } from './types.ts';
import { log } from './utils.ts';

export interface ModelProfile {
  name: string;
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  contextWindow?: number;
  cost?: {
    input: number;
    output: number;
    currency: string;
  };
}

export interface ModelPointers {
  main: string;        // Default model for main conversation
  task: string;        // Default model for sub-agents
  reasoning: string;   // Default model for reasoning tasks
  quick: string;       // Default model for quick tasks
}

export class MultiModelManager {
  private config: KodeACPConfig;
  private modelProfiles: Map<string, ModelProfile> = new Map();
  private modelPointers: ModelPointers;
  private currentModel: string;

  constructor(config: KodeACPConfig) {
    this.config = config;
    this.modelPointers = {
      main: 'claude-sonnet',
      task: 'qwen-coder',
      reasoning: 'gpt-4',
      quick: 'claude-haiku',
    };
    this.currentModel = this.modelPointers.main;
    this.initializeDefaultModels();
  }

  private initializeDefaultModels(): void {
    // Initialize with common model profiles
    const defaultModels: ModelProfile[] = [
      {
        name: 'claude-sonnet',
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        maxTokens: 200000,
        temperature: 0.3,
        contextWindow: 200000,
      },
      {
        name: 'claude-haiku',
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        maxTokens: 200000,
        temperature: 0.3,
        contextWindow: 200000,
      },
      {
        name: 'gpt-4',
        provider: 'openai',
        model: 'gpt-4',
        maxTokens: 128000,
        temperature: 0.3,
        contextWindow: 128000,
      },
      {
        name: 'gpt-4o',
        provider: 'openai',
        model: 'gpt-4o',
        maxTokens: 128000,
        temperature: 0.3,
        contextWindow: 128000,
      },
      {
        name: 'qwen-coder',
        provider: 'alibaba',
        model: 'qwen-coder-plus',
        maxTokens: 32000,
        temperature: 0.3,
        contextWindow: 32000,
      },
      {
        name: 'gemini-pro',
        provider: 'google',
        model: 'gemini-1.5-pro',
        maxTokens: 2097152,
        temperature: 0.3,
        contextWindow: 2097152,
      },
    ];

    defaultModels.forEach(model => {
      this.modelProfiles.set(model.name, model);
    });
  }

  getModelProfile(name: string): ModelProfile | undefined {
    return this.modelProfiles.get(name);
  }

  addModelProfile(profile: ModelProfile): void {
    this.modelProfiles.set(profile.name, profile);
    log('info', `Added model profile: ${profile.name}`);
  }

  removeModelProfile(name: string): boolean {
    const removed = this.modelProfiles.delete(name);
    if (removed) {
      log('info', `Removed model profile: ${name}`);
    }
    return removed;
  }

  getAllModelProfiles(): ModelProfile[] {
    return Array.from(this.modelProfiles.values());
  }

  getAvailableModelNames(): string[] {
    return Array.from(this.modelProfiles.keys());
  }

  setCurrentModel(name: string): boolean {
    if (this.modelProfiles.has(name)) {
      this.currentModel = name;
      log('info', `Switched to model: ${name}`);
      return true;
    }
    return false;
  }

  getCurrentModel(): string {
    return this.currentModel;
  }

  getCurrentModelProfile(): ModelProfile | undefined {
    return this.modelProfiles.get(this.currentModel);
  }

  setModelPointers(pointers: Partial<ModelPointers>): void {
    this.modelPointers = { ...this.modelPointers, ...pointers };
    log('info', 'Updated model pointers:', this.modelPointers);
  }

  getModelPointers(): ModelPointers {
    return { ...this.modelPointers };
  }

  getModelForPurpose(purpose: keyof ModelPointers): ModelProfile | undefined {
    const modelName = this.modelPointers[purpose];
    return this.modelProfiles.get(modelName);
  }

  async switchToModel(purpose: keyof ModelPointers): Promise<boolean> {
    const modelName = this.modelPointers[purpose];
    if (this.modelProfiles.has(modelName)) {
      this.currentModel = modelName;
      log('info', `Switched to ${purpose} model: ${modelName}`);
      return true;
    }
    return false;
  }

  async executeWithModel(
    prompt: string,
    modelName?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<string> {
    const targetModel = modelName || this.currentModel;
    const profile = this.modelProfiles.get(targetModel);

    if (!profile) {
      throw new Error(`Model profile not found: ${targetModel}`);
    }

    log('debug', `Executing with model ${targetModel}:`, prompt.substring(0, 100) + '...');

    // This is a placeholder implementation
    // In a real implementation, this would call the actual model API
    try {
      const response = await this.simulateModelCall(profile, prompt, options);
      return response;
    } catch (error) {
      log('error', `Model call failed for ${targetModel}:`, error);
      throw error;
    }
  }

  private async simulateModelCall(
    profile: ModelProfile,
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<string> {
    // Simulate model call with a simple response
    // In a real implementation, this would make actual API calls
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    const systemPrompt = options?.systemPrompt || 'You are a helpful AI assistant.';
    const temperature = options?.temperature ?? profile.temperature ?? 0.3;

    // Generate a simulated response based on the model type
    if (profile.provider === 'anthropic') {
      return `[Claude ${profile.model}] I understand your request about: "${prompt.substring(0, 50)}..." This is a simulated response from the Anthropic API.`;
    } else if (profile.provider === 'openai') {
      return `[GPT ${profile.model}] I received your message: "${prompt.substring(0, 50)}..." This is a simulated response from the OpenAI API.`;
    } else if (profile.provider === 'alibaba') {
      return `[Qwen ${profile.model}] 我理解您的问题："${prompt.substring(0, 50)}..." 这是来自阿里云API的模拟响应。`;
    } else if (profile.provider === 'google') {
      return `[Gemini ${profile.model}] I've processed your request about: "${prompt.substring(0, 50)}..." This is a simulated response from Google's API.`;
    } else {
      return `[${profile.name}] Response to: "${prompt.substring(0, 50)}..." This is a simulated response.`;
    }
  }

  async executeInParallel(
    requests: Array<{
      prompt: string;
      modelName?: string;
      purpose?: keyof ModelPointers;
      options?: {
        temperature?: number;
        maxTokens?: number;
        systemPrompt?: string;
      };
    }>
  ): Promise<Array<{ model: string; response: string; error?: string }>> {
    const promises = requests.map(async (request) => {
      try {
        const modelName = request.modelName ||
          (request.purpose ? this.modelPointers[request.purpose] : this.currentModel);

        const response = await this.executeWithModel(
          request.prompt,
          modelName,
          request.options
        );

        return {
          model: modelName,
          response,
        };
      } catch (error) {
        return {
          model: request.modelName || this.currentModel,
          response: '',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    return Promise.all(promises);
  }

  exportConfig(): object {
    return {
      modelProfiles: Array.from(this.modelProfiles.entries()).reduce((acc, [name, profile]) => {
        acc[name] = profile;
        return acc;
      }, {} as Record<string, ModelProfile>),
      modelPointers: this.modelPointers,
      currentModel: this.currentModel,
    };
  }

  importConfig(config: { modelProfiles?: Record<string, ModelProfile>; modelPointers?: ModelPointers; currentModel?: string }): void {
    if (config.modelProfiles) {
      this.modelProfiles.clear();
      Object.entries(config.modelProfiles).forEach(([name, profile]) => {
        this.modelProfiles.set(name, profile);
      });
    }

    if (config.modelPointers) {
      this.modelPointers = config.modelPointers;
    }

    if (config.currentModel && this.modelProfiles.has(config.currentModel)) {
      this.currentModel = config.currentModel;
    }

    log('info', 'Multi-model configuration imported successfully');
  }
}