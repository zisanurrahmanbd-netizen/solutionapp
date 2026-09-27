import { CaseFile, User } from '../types';

/**
 * Whether a case belongs to an agent. Files link to agents in two ways:
 * assigned_agent_id (proper link) OR only the agent_name string written in
 * the sheet upload (AGENT_NAME column). Mirrors dataService.getCases()
 * matching so every analytics view agrees with the per-agent case list.
 */
export const caseMatchesAgent = (c: CaseFile, agent: User): boolean => {
  if (c.assigned_agent_id === agent.id) return true;

  const uName = (agent.name || '').trim().toLowerCase();
  const uEmp = (agent.employee_id || '').trim().toLowerCase();
  const uEmail = (agent.email || '').trim().toLowerCase();
  const rawAgent = (
    c.agent_name ||
    c.extra_attributes?.AGENT_NAME ||
    c.extra_attributes?.AGENT ||
    c.extra_attributes?.FIELD_AGENT ||
    ''
  ).trim().toLowerCase();

  if (!rawAgent) return false;

  return (
    rawAgent === uName ||
    (!!uEmp && rawAgent === uEmp) ||
    (!!uEmail && (rawAgent === uEmail || uEmail.startsWith(rawAgent))) ||
    (!!uName && uName.includes(rawAgent)) ||
    (!!uName && rawAgent.includes(uName))
  );
};

/**
 * Collections / check-ins credit an agent when their agent_id matches OR the
 * record belongs to one of the agent's cases (legacy rows with agent_id 0).
 */
export const recordBelongsToAgentCases = (
  record: { agent_id?: number; case_file_id: number },
  agentCaseIds: Set<number>,
  agentId: number
): boolean => record.agent_id === agentId || agentCaseIds.has(record.case_file_id);
