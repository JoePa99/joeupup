import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request - check if requesting company-wide stats
    const url = new URL(req.url);
    const scope = url.searchParams.get('scope') || 'user'; // 'user' or 'company'
    const includeHistory = url.searchParams.get('includeHistory') === 'true';

    if (scope === 'company') {
      // Get company stats (admin only)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id, role')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ error: 'Profile not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (profile.role !== 'admin') {
        return new Response(
          JSON.stringify({ error: 'Only company admins can view company-wide usage' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get company-wide usage stats using database function
      const { data: companyStats, error: companyError } = await supabase
        .rpc('get_company_usage_stats', { p_company_id: profile.company_id });

      if (companyError) {
        throw companyError;
      }

      // Get company subscription info
      const { data: company } = await supabase
        .from('companies')
        .select(`
          subscription_status,
          subscription_current_period_start,
          subscription_current_period_end,
          plan_id,
          subscription_plans (
            name,
            message_limit_per_seat,
            seat_limit
          )
        `)
        .eq('id', profile.company_id)
        .single();

      return new Response(
        JSON.stringify({
          scope: 'company',
          users: companyStats,
          subscription: company,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      // Get individual user stats
      const { data: currentUsage, error: usageError } = await supabase
        .rpc('get_user_current_usage', { p_user_id: user.id });

      if (usageError) {
        throw usageError;
      }

      let response: any = {
        scope: 'user',
        current: currentUsage?.[0] || null,
      };

      // Include usage history if requested
      if (includeHistory) {
        const { data: history, error: historyError } = await supabase
          .from('usage_history')
          .select('*')
          .eq('user_id', user.id)
          .order('period_start', { ascending: false })
          .limit(12); // Last 12 months

        if (!historyError) {
          response.history = history;
        }
      }

      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error fetching usage stats:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});






