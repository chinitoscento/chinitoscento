// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rsrhuegmzuvowsxbiuwv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_8BU8EJgaVaIFJ2HLIt6QWQ_C7jfBdDF';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);