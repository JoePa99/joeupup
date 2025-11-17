import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const defaultCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// RESOLVED: Kept the dynamic CORS helper function from the 'codex' branch
const createCorsHeaders = (req: Request, extraHeaders: Record<string, string> = {}) => {
  const origin = req.headers.get('origin');
  const requestedHeaders = req.headers.get('access-control-request-headers');
  const fallbackOrigin = Deno.env.get('CORS_FALLBACK_ORIGIN') || '*';
  const allowOrigin = origin || fallbackOrigin;

  const allowHeaders = requestedHeaders
    ? requestedHeaders
    : defaultCorsHeaders['Access-Control-Allow-Headers'];

  const dynamicHeaders: Record<string, string> = {
    ...defaultCorsHeaders,
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': allowHeaders,
  };

  if (origin) {
    dynamicHeaders['Vary'] = 'Origin';
  }

  if (allowOrigin !== '*' && origin) {
    dynamicHeaders['Access-Control-Allow-Credentials'] = 'true';
  }

  return {
    ...dynamicHeaders,
    ...extraHeaders,
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    // RESOLVED: Updated to use the new helper function
    const headers = createCorsHeaders(req);
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: createCorsHeaders(req, { 'Content-Type': 'application/json' }) }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase configuration.');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: createCorsHeaders(req, { 'Content-Type': 'application/json' }) }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: createCorsHeaders(req, { 'Content-Type': 'application/json' }) }
      );
    }

    const body = await req.json().catch(() => ({}));
    const workspaceName = typeof body.workspaceName === 'string' ? body.workspaceName.trim() : '';
    const companyWebsite = typeof body.companyWebsite === 'string' && body.companyWebsite.trim().length > 0
      ? body.companyWebsite.trim()
      : null;
    const firstName = typeof body.firstName === 'string' && body.firstName.trim().length > 0
      ? body.firstName.trim()
      : null;
    const lastName = typeof body.lastName === 'string' && body.lastName.trim().length > 0
      ? body.lastName.trim()
      : null;

    if (!workspaceName) {
      return new Response(
        JSON.stringify({ error: 'Workspace name is required' }),
        { status: 400, headers: createCorsHeaders(req, { 'Content-Type': 'application/json' }) }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error(profileError?.message || 'Unable to load profile');
    }

    let companyId = profile.company_id;

    if (!companyId) {
      const { data: companyResult, error: companyError } = await supabaseAdmin
        .rpc('create_company_and_link_profile', {
          p_company_name: workspaceName,
          p_user_id: user.id
        });

      if (companyError) {
        console.error('create_company_and_link_profile error:', companyError);
        throw new Error(companyError.message);
      }

      const createdCompany = Array.isArray(companyResult)
        ? companyResult[0]
        : companyResult;
      companyId = createdCompany?.company_id || createdCompany?.id || null;
    }

    if (!companyId) {
      throw new Error('Unable to determine company ID after creation');
    }

    await supabaseAdmin
      .from('companies')
      .update({
        name: workspaceName,
        domain: companyWebsite,
        created_by: user.id,
      })
      .eq('id', companyId);

    const profileUpdates: Record<string, any> = {
      company_id: companyId,
      role: 'platform-admin',
    };

    if (firstName !== null) profileUpdates.first_name = firstName;
    if (lastName !== null) profileUpdates.last_name = lastName;

    await supabaseAdmin
      .from('profiles')
      .update(profileUpdates)
      .eq('id', user.id);

    await supabaseAdmin
      .from('onboarding_sessions')
      .upsert({
        user_id: user.id,
        company_id: companyId,
        status: 'completed',
        current_step: 1,
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
        session_data: { workspaceName, onboardingPath: 'single_form' },
      }, { onConflict: 'user_id' });

    return new Response(
      JSON.stringify({ success: true, companyId }),
      { status: 200, headers: createCorsHeaders(req, { 'Content-Type': 'application/json' }) }
    );
  } catch (error) {
    console.error('Error creating workspace:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error creating workspace';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: createCorsHeaders(req, { 'Content-Type': 'application/json' }) }
    );
  }
});