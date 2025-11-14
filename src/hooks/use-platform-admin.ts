import { useQuery } from "@tanstack/react-query";
import { isPlatformAdmin } from "@/lib/default-agent-utils";

/**
 * Hook to check if the current user is a platform admin
 */
export function usePlatformAdmin() {
  return useQuery({
    queryKey: ['platform-admin'],
    queryFn: async () => {
      const result = await isPlatformAdmin();
      return result;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
