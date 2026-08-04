import { supabase } from '../config/supabase.config';
import { buildError } from './response';

export interface LedgerReleaseResult {
  fundsReleased: number;
  fundsInEscrow: number;
}

/**
 * Atomically releases escrow for a milestone via a Supabase RPC.
 * Enforces the ledger invariant: fundsReleased + fundsInEscrow === totalBudget.
 * Returns the project's updated fund totals.
 */
export const releaseMilestoneEscrow = async (
  milestoneId: string,
  projectId: string
): Promise<LedgerReleaseResult> => {
  const { data, error } = await supabase.rpc('release_milestone_escrow', {
    p_milestone_id: milestoneId,
    p_project_id: projectId,
  });

  if (error) throw new Error(error.message);

  return {
    fundsReleased: data.funds_released,
    fundsInEscrow: data.funds_in_escrow,
  };
};

/**
 * Asserts the ledger invariant for a project.
 * Throws a descriptive error if violated — used in tests and as a sanity check.
 */
export const assertLedgerInvariant = async (projectId: string): Promise<void> => {
  const { data: project, error } = await supabase
    .from('projects')
    .select('total_budget, funds_released, funds_in_escrow')
    .eq('id', projectId)
    .single();

  if (error || !project) throw new Error('Project not found for ledger invariant check');

  const { total_budget, funds_released, funds_in_escrow } = project;
  if (funds_released + funds_in_escrow !== total_budget) {
    throw new Error(
      `Ledger invariant violated for project ${projectId}: ` +
        `${funds_released} + ${funds_in_escrow} !== ${total_budget}`
    );
  }
};
