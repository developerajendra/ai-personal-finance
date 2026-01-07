import { MainOrchestratorAgent } from './MainOrchestratorAgent';

let orchestratorInstance: MainOrchestratorAgent | null = null;

export function getMainOrchestrator(): MainOrchestratorAgent {
  if (!orchestratorInstance) {
    orchestratorInstance = new MainOrchestratorAgent();
  }
  return orchestratorInstance;
}

export async function initializeAgents(): Promise<void> {
  const orchestrator = getMainOrchestrator();
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

// Note: Agents should be initialized explicitly via API route or server startup
// Not automatically on module load to avoid issues with Next.js edge runtime

