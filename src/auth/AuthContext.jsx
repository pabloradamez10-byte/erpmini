import { createContext, useContext, useEffect, useState } from "react";
import { clearPasswordRecoveryFlow, isPasswordRecoveryFlow, markPasswordRecoveryFlow, supabase } from "../services/supabaseClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(() => isPasswordRecoveryFlow());

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user || null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        markPasswordRecoveryFlow();
        setPasswordRecovery(true);
      }
      setUser(session?.user || null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password });
  const signUp = (email, password, businessType) => supabase.auth.signUp({
    email,
    password,
    options: { data: { business_type: businessType === "servicos" ? "servicos" : "comercio" } }
  });
  const signOut = () => supabase.auth.signOut();
  const requestPasswordReset = (email) => supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/`
  });
  const updatePassword = (password) => supabase.auth.updateUser({ password });
  const completePasswordRecovery = () => {
    clearPasswordRecoveryFlow();
    setPasswordRecovery(false);
  };

  return <AuthContext.Provider value={{ user, authLoading, passwordRecovery, signIn, signUp, signOut, requestPasswordReset, updatePassword, completePasswordRecovery }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
