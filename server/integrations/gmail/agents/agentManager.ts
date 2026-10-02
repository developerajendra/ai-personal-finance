import { MainOrchestratorAgent } from './MainOrchestratorAgent';

let orchestratorInstance: MainOrchestratorAgent | null = null;

export function getMainOrchestrator(userId: string): MainOrchestratorAgent {
  if (!orchestratorInstance) {
    orchestratorInstance = new MainOrchestratorAgent(userId);
  }
  return orchestratorInstance;
}

export async function initializeAgents(userId: string): Promise<void> {
  const orchestrator = getMainOrchestrator(userId);
  await orchestrator.start();
  console.log('[Agent Manager] All agents initialized');
}

export async function shutdownAgents(): Promise<void> {
  if (orchestratorInstance) {
    await orchestratorInstance.stop();
    orchestratorInstance = null;
  }
  console.log('[Agent Manager] All agents shut down');
}
