import { AgentState } from '../utils/types';

export { AgentState };

// Export state descriptions for UI
export const AgentStateDescriptions: Record<AgentState, string> = {
  [AgentState.IDLE]: 'Agent is idle, waiting to start',
  [AgentState.MONITORING]: 'Monitoring financial news sources',
  [AgentState.ANALYZING]: 'Analyzing news impact with AI',
  [AgentState.DECIDING]: 'Making trading decision',
  [AgentState.RISK_CHECK]: 'Performing risk assessment',
  [AgentState.EXECUTING]: 'Executing trade on blockchain',
  [AgentState.EXPLAINING]: 'Generating explanation',
};

// Export state colors for UI
export const AgentStateColors: Record<AgentState, string> = {
  [AgentState.IDLE]: 'gray',
  [AgentState.MONITORING]: 'blue',
  [AgentState.ANALYZING]: 'yellow',
  [AgentState.DECIDING]: 'orange',
  [AgentState.RISK_CHECK]: 'purple',
  [AgentState.EXECUTING]: 'red',
  [AgentState.EXPLAINING]: 'green',
};