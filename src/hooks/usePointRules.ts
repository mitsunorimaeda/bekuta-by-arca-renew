// src/hooks/usePointRules.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function usePointRules() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("point_rules_public")
          .select("*")
          .order("sort_order", { ascending: true });
        if (error) throw error;
        setRules(data ?? []);
        setError(null);
      } catch (e:any) {
        setError(e?.message ?? "ポイントルールの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { rules, loading, error };
}