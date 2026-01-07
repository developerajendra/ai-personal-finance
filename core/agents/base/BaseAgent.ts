export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'analysis' | 'alert' | 'report' | 'request' | 'response';
  timestamp: number;
  data: any;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface AgentConfig {
  name: string;
  enabled: boolean;
  analysisInterval: number; // milliseconds
  alertThresholds?: Record<string, number>;
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected messageQueue: AgentMessage[] = [];
  protected isRunning: boolean = false;
  protected analysisIntervalId?: NodeJS.Timeout;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  // Start the agent
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[${this.config.name}] Agent started`);
    await this.onStart();
    this.startAnalysisLoop();
  }

  // Stop the agent
  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.analysisIntervalId) {
      clearInterval(this.analysisIntervalId);
    }
    await this.onStop();
    console.log(`[${this.config.name}] Agent stopped`);
  }

  // Main analysis loop
  private startAnalysisLoop(): void {
    this.analysisIntervalId = setInterval(async () => {
      if (this.config.enabled && this.isRunning) {
        try {
          await this.analyze();
        } catch (error) {
          console.error(`[${this.config.name}] Analysis error:`, error);
        }
      }
    }, this.config.analysisInterval);
  }

  // Send message to main agent
  protected sendMessage(message: Omit<AgentMessage, 'id' | 'from' | 'timestamp' | 'to'>): void {
    const fullMessage: AgentMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from: this.config.name,
      to: 'main-agent',
      timestamp: Date.now(),
      ...message,
    };
    this.messageQueue.push(fullMessage);
    this.onMessageSent(fullMessage);
  }

  // Receive message from main agent
  receiveMessage(message: AgentMessage): void {
    this.onMessageReceived(message);
  }

  // Abstract methods to be implemented by subclasses
  protected abstract analyze(): Promise<void>;
  protected abstract onStart(): Promise<void>;
  protected abstract onStop(): Promise<void>;
  protected abstract onMessageSent(message: AgentMessage): void;
  protected abstract onMessageReceived(message: AgentMessage): void;

  // Get pending messages
  getMessages(): AgentMessage[] {
    return this.messageQueue.splice(0); // Return and clear queue
  }

  // Get agent status
  getStatus(): { name: string; enabled: boolean; running: boolean } {
    return {
      name: this.config.name,
      enabled: this.config.enabled,
      running: this.isRunning,
    };
  }
}

