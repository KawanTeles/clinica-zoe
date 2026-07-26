import { useCallback, useEffect, useState } from "react";
import { getSupabaseFor } from "@/integrations/supabase/dual-client";

const STAFF_ROLES = ["ADMIN", "RECEPCIONISTA", "PROFISSIONAL"];

/**
 * Indica se existe uma sessão da EQUIPE ativa no navegador (storage isolado).
 * Usado no site público/Área do Cliente para oferecer um atalho ao Painel.
 */
export function useStaffSession() {
  const [hasStaffSession, setHasStaffSession] = useState(false);
  const [loading, setLoading] = useState(true);

  const resolveStaffSession = useCallback(async () => {
    const staff = getSupabaseFor("staff");
    const { data: sessionData } = await staff.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) return false;

    const { data: rolesData } = await staff
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", STAFF_ROLES);

    return (rolesData?.length ?? 0) > 0;
  }, []);

  useEffect(() => {
    const staff = getSupabaseFor("staff");
    let active = true;

    setLoading(true);
    resolveStaffSession()
      .then((valid) => {
        if (active) setHasStaffSession(valid);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data: sub } = staff.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setHasStaffSession(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      setTimeout(() => {
        resolveStaffSession()
          .then((valid) => {
            if (active) setHasStaffSession(valid);
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      }, 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOutStaff = async () => {
    await getSupabaseFor("staff").auth.signOut();
  };

  return { hasStaffSession, loading, signOutStaff };
}
