import { createClient } from '@supabase/supabase-js';

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/rest\/v1\/?$/, '');
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabase = projectUrl && publishableKey
  ? createClient(projectUrl, publishableKey)
  : null;
