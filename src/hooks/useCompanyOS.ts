import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CompanyOS } from '@/types/company-os';

export function useCompanyOS(companyId?: string) {
  return useQuery({
    queryKey: ['company-os', companyId],
    queryFn: async (): Promise<CompanyOS | null> => {
      if (!companyId) return null;

      const { data, error } = await supabase
        .from('company_os' as any)
        .select('*')
        .eq('company_id', companyId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows found
        throw error;
      }

      return data as CompanyOS;
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

