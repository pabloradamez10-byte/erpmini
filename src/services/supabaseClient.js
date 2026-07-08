import { createClient } from "@supabase/supabase-js";

/*
  ATENÇÃO:
  Na próxima etapa vamos mover a configuração real do Supabase para cá.
  Por enquanto este arquivo é apenas a base para modularização.
*/

export function createERPminiSupabaseClient(url, anonKey) {
  return createClient(url, anonKey);
}
