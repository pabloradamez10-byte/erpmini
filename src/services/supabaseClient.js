import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fxahftlnanvcyzxwejhe.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_PAIUP7LETrzQfZLMWcpsfw_8v8IeXTx";

export function createERPminiSupabaseClient(url, anonKey) {
  return createClient(url, anonKey);
}

export const supabase = createERPminiSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
