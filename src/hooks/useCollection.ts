import { useEffect, useState } from "react";
import type { IconifyJSON } from "@iconify/types";

export function useCollection(prefix: string | null) {
  const [data, setData] = useState<IconifyJSON | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!prefix) {
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    import(`@iconify/json/json/${prefix}.json`)
      .then((mod) => {
        setData(mod.default as IconifyJSON);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "加载图标包失败");
        setLoading(false);
      });
  }, [prefix]);

  return { data, loading, error };
}
