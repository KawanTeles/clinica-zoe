import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMetaStatus, getMetaConfig } from "@/lib/meta.functions";

export const META_KEYS = {
  status: ["meta-status"] as const,
  config: ["meta-config"] as const,
  templates: ["meta-templates"] as const,
  metrics: ["meta-metrics"] as const,
  logs: (search?: string) => ["meta-logs", search ?? ""] as const,
};

export function useMetaStatus() {
  const fnStatus = useServerFn(getMetaStatus);
  const fnConfig = useServerFn(getMetaConfig);

  const statusQuery = useQuery({
    queryKey: META_KEYS.status,
    queryFn: () => fnStatus({ data: undefined as any }),
    refetchInterval: 20_000,
    staleTime: 5_000,
  });

  const configQuery = useQuery({
    queryKey: META_KEYS.config,
    queryFn: () => fnConfig({ data: undefined as any }),
    staleTime: 10_000,
  });

  return {
    status: statusQuery.data,
    isLoadingStatus: statusQuery.isLoading,
    refetchStatus: statusQuery.refetch,
    config: configQuery.data,
    isLoadingConfig: configQuery.isLoading,
    refetchConfig: configQuery.refetch,
  };
}
