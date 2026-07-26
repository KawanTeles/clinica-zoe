import { useEffect, useState } from "react";
import { getSupabaseFor } from "@/integrations/supabase/dual-client";

/**
 * Indica se existe uma sessão da EQUIPE ativa no navegador (storage isolado).
 * Usado no site público/Área do Cliente para oferecer um atalho ao Painel.
 */
export function useStaffSession() {
  const [hasStaffSession, setHasStaffSession] = useState(false);

  useEffect(() => {
    const staff = getSupabaseFor("staff");
    let active = true;

    staff.auth.getSession().then(({ data }) => {
      if (active) setHasStaffSession(!!data.session);
    });

    const { data: sub } = staff.auth.onAuthStateChange((_event, session) => {
      setHasStaffSession(!!session);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOutStaff = async () => {
    await getSupabaseFor("staff").auth.signOut();
  };

  return { hasStaffSession, signOutStaff };
}
