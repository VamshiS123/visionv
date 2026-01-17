import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create Supabase client
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export interface Observation {
  narration: string;
  priority?: string;
}

/**
 * Store an observation in Supabase
 * Filters out "unchanged" observations and runs asynchronously (fire and forget)
 */
export async function storeObservation(observation: Observation): Promise<void> {
  // Skip if Supabase not configured
  if (!supabase) {
    console.warn('Supabase not configured - skipping observation storage');
    return;
  }

  // Skip if unchanged
  if (observation.narration?.toLowerCase() === 'unchanged') {
    return;
  }

  try {
    const { error } = await supabase
      .from('observations')
      .insert({
        narration: observation.narration,
        priority: observation.priority || 'medium',
      });

    if (error) {
      console.error('Error storing observation:', error);
    } else {
      console.log('Observation stored successfully:', observation.narration);
    }
  } catch (error) {
    console.error('Exception storing observation:', error);
  }
}

/**
 * Fetch recent observations from Supabase
 */
export async function fetchRecentObservations(limit: number = 20): Promise<Observation[]> {
  if (!supabase) {
    console.warn('Supabase not configured - cannot fetch observations');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('observations')
      .select('narration, priority')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching observations:', error);
      return [];
    }

    return (data || []) as Observation[];
  } catch (error) {
    console.error('Exception fetching observations:', error);
    return [];
  }
}
