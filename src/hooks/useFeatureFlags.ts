import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useFeatureFlags() {
  const [loading, setLoading] = useState(true);
  const [fttEnabled, setFttEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        if (!cancelled) {
          setFttEnabled(false);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select("ftt_enabled")
        .eq("id", user.id)
        .single();

      if (!cancelled) {
        setFttEnabled(!error && !!data?.ftt_enabled);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, fttEnabled };
}