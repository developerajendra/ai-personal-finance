import { BaseAgent, AgentMessage } from './base/BaseAgent';
import { PortfolioManagementAgent } from './PortfolioManagementAgent';

export interface AgentReport {
  agentName: string;
  reportType: string;
  data: any;
  timestamp: number;
}

export class MainOrchestratorAgent {
  private portfolioAgent: PortfolioManagementAgent;
  private reports: AgentReport[] = [];
  private alerts: AgentMessage[] = [];
  private messageProcessorInterval?: NodeJS.Timeout;

  constructor() {
    this.portfolioAgent = new PortfolioManagementAgent();
    this.setupMessageHandlers();
  }

  async start(): Promise<void> {
    console.log('[Main Agent] Starting orchestrator...');
    
    // Start portfolio agent
    await this.portfolioAgent.start();
    
    // Start message processor
    this.startMessageProcessor();
    
    console.log('[Main Agent] Orchestrator started');
  }

  async stop(): Promise<void> {
    console.log('[Main Agent] Stopping orchestrator...');
    
    // Stop portfolio agent
    await this.portfolioAgent.stop();
    
    // Stop message processor
    if (this.messageProcessorInterval) {
      clearInterval(this.messageProcessorInterval);
    }
    
    console.log('[Main Agent] Orchestrator stopped');
  }

  private setupMessageHandlers(): void {
    // Messages will be processed in the message processor loop
  }

  private startMessageProcessor(): void {
    this.messageProcessorInterval = setInterval(() => {
      this.processMessages();
    }, 2000); // Check every 2 seconds
  }

  private processMessages(): void {
    // Collect messages from all agents
    const portfolioMessages = this.portfolioAgent.getMessages();

    // Process portfolio agent messages
    for (const message of portfolioMessages) {
      this.handleMessage(message);
    }
  }

  private handleMessage(message: AgentMessage): void {
    console.log(`[Main Agent] Received ${message.type} from ${message.from}`);

    switch (message.type) {
      case 'report':
        this.reports.push({
          agentName: message.from,
          reportType: message.data.reportType,
          data: message.data,
          timestamp: message.timestamp,
        });
        this.onReportReceived(message);
        break;

      case 'alert':
        this.alerts.push(message);
        this.onAlertReceived(message);
        break;

      case 'request':
        this.handleRequest(message);
        break;

      default:
        console.log(`[Main Agent] Unknown message type: ${message.type}`);
    }
  }

  private onReportReceived(message: AgentMessage): void {
    // Store report, send to API endpoint, update UI, etc.
    console.log(`[Main Agent] Report received: ${message.data.reportType}`);
  }

  private onAlertReceived(message: AgentMessage): void {
    // Handle alerts - notify user, send notifications, etc.
    console.log(`[Main Agent] Alert received: ${JSON.stringify(message.data)}`);
  }

  private handleRequest(message: AgentMessage): void {
    // Handle requests from agents
    // Can send responses back to agents
    if (message.data?.action === 'get-status') {
      // Send status response
    }
  }

  // Public API methods
  getReports(agentName?: string): AgentReport[] {
    if (agentName) {
      return this.reports.filter((r) => r.agentName === agentName);
    }
    return this.reports;
  }

  getAlerts(priority?: string): AgentMessage[] {
    if (priority) {
      return this.alerts.filter((a) => a.priority === priority);
    }
    return this.alerts;
  }

  getLatestReport(agentName: string): AgentReport | null {
    const agentReports = this.reports.filter((r) => r.agentName === agentName);
    return agentReports.length > 0
      ? agentReports[agentReports.length - 1]
      : null;
  }

  // Get portfolio agent instance
  getPortfolioAgent(): PortfolioManagementAgent {
    return this.portfolioAgent;
  }

  // Get agent statuses
  getAgentStatuses(): Array<{ name: string; enabled: boolean; running: boolean }> {
    return [
      this.portfolioAgent.getStatus(),
    ];
  }
}

