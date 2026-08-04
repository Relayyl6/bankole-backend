import { supabase } from '../config/supabase.config';
import { ActivityType } from '../types/enums';

/**
 * Appends an entry to the append-only activity log.
 * Called as a side-effect from controllers — never exposed as a writable endpoint.
 */
export const logActivity = async (params: {
  projectId: string;
  type: ActivityType;
  message: string;
  actorId: string;
}): Promise<void> => {
  const { projectId, type, message, actorId } = params;

  const { error } = await supabase.from('activity_log').insert({
    project_id: projectId,
    type,
    message,
    actor_id: actorId,
    created_at: new Date().toISOString(),
  });

  if (error) {
    // Activity log failure is non-fatal — log to stderr, do not throw
    console.error('[activity] Failed to write activity log entry:', error.message);
  }
};
