import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fxahftlnanvcyzxwejhe.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_PAIUP7LETrzQfZLMWcpsfw_8v8IeXTx";
const PASSWORD_RECOVERY_KEY = "erpmini_password_recovery";

// O cliente do Supabase limpa os tokens da URL logo ao iniciar. Guardamos a
// intenção antes disso para que celulares mais rápidos não percam a tela de
// criação da nova senha.
const initialAuthUrl = typeof window !== "undefined"
  ? `${window.location.search || ""}&${window.location.hash || ""}`.toLowerCase()
  : "";

if (typeof window !== "undefined" && /(?:type=|type%3d)recovery/.test(initialAuthUrl)) {
  sessionStorage.setItem(PASSWORD_RECOVERY_KEY, "1");
}

export function isPasswordRecoveryFlow() {
  return typeof window !== "undefined" && sessionStorage.getItem(PASSWORD_RECOVERY_KEY) === "1";
}

export function markPasswordRecoveryFlow() {
  if (typeof window !== "undefined") sessionStorage.setItem(PASSWORD_RECOVERY_KEY, "1");
}

export function clearPasswordRecoveryFlow() {
  if (typeof window !== "undefined") sessionStorage.removeItem(PASSWORD_RECOVERY_KEY);
}

export function createERPminiSupabaseClient(url, anonKey) {
  return createClient(url, anonKey);
}

export const supabase = createERPminiSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
