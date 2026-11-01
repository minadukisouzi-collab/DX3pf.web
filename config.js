// config.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

// ★ ここを書き換えるだけで、全ページに反映されます
export const SUPABASE_URL = 'https://iraddangbcsovgjiihzz.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Wo_OFiMCNAqVG1snXLOD_A_B_v_8GS_';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);