import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Json } from '@/integrations/supabase/types';

export type ActionCategory = 
  | 'product' 
  | 'supplier' 
  | 'competitor' 
  | 'colleague' 
  | 'user' 
  | 'crawl' 
  | 'email'
  | 'collection';

export type EntityType = 
  | 'product' 
  | 'supplier' 
  | 'competitor' 
  | 'colleague' 
  | 'user' 
  | 'collection';

export interface ActivityLogEntry {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  action_category: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  details: Json;
  created_at: string;
}

export function useActivityLog() {
  const { user } = useAuth();

  const logActivity = useCallback(
    async (
      action: string,
      actionCategory: ActionCategory,
      entityType?: EntityType,
      entityId?: string,
      entityName?: string,
      details?: Record<string, unknown>
    ) => {
      if (!user) return;

      try {
        await supabase.from('activity_log').insert([{
          user_id: user.id,
          user_email: user.email,
          action,
          action_category: actionCategory,
          entity_type: entityType || null,
          entity_id: entityId || null,
          entity_name: entityName || null,
          details: (details || {}) as Json,
        }]);
      } catch (error) {
        console.error('Failed to log activity:', error);
      }
    },
    [user]
  );

  return { logActivity };
}
