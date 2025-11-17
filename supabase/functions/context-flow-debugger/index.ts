import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { buildAssistantPrompt, buildDynamicContext, expandQuery, parseUserQuery } from "../_shared/dynamic-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DebugRequestBody {
  agentId: string;
  userMessage: string;
  companyId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { agentId, userMessage, companyId }: DebugRequestBody = await req.json();

    if (!agentId || !userMessage) {
      return new Response(
        JSON.stringify({ success: false, error: "agentId and userMessage are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Supabase configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: agentData, error: agentError } = await supabaseClient
      .from("agents")
      .select("id, name, role, description, system_instructions, configuration, company_id")
      .eq("id", agentId)
      .single();

    if (agentError || !agentData) {
      const message = agentError?.message || "Agent not found";
      return new Response(
        JSON.stringify({ success: false, error: message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resolvedCompanyId = companyId || agentData.company_id;
    const parsedQuery = parseUserQuery(userMessage);
    const expanded = await expandQuery(parsedQuery || userMessage, openaiApiKey);

    const expandedQueries = expanded.expanded?.length
      ? expanded.expanded
      : (expanded.original ? [expanded.original] : [parsedQuery || userMessage]);

    const dynamicContext = await buildDynamicContext({
      supabaseClient,
      companyId: resolvedCompanyId,
      agentId,
      queries: expandedQueries,
      baseQuery: expanded.original || parsedQuery || userMessage,
      openaiApiKey,
    });

    const prompt = buildAssistantPrompt({
      agent: {
        displayName: agentData.name,
        personaInstructions: agentData.system_instructions || agentData.configuration?.instructions,
        responseStructure: agentData.configuration?.response_structure,
        specialtyLabel: agentData.configuration?.specialty_label,
        role: agentData.role,
        description: agentData.description,
      },
      context: dynamicContext.tieredContext,
      userQuery: userMessage,
    });

    const summarizeTier = (tier: string, items: any[]) => items.map((chunk) => ({
      id: chunk.id,
      tier: chunk.tier || tier,
      relevanceScore: chunk.relevanceScore,
      metadata: chunk.metadata,
      contentPreview: (chunk.content || "").slice(0, 280),
    }));

    const contextSummary = {
      companyOS: summarizeTier("companyOS", dynamicContext.tieredContext.companyOS || []),
      agentDocs: summarizeTier("agentDocs", dynamicContext.tieredContext.agentDocs || []),
      playbooks: summarizeTier("playbooks", dynamicContext.tieredContext.playbooks || []),
      keywords: summarizeTier("keywords", dynamicContext.tieredContext.keywords || []),
      structuredSummary: dynamicContext.tieredContext.structuredSummary,
      documentSummary: dynamicContext.documentSummary,
      contextUsed: dynamicContext.contextUsed,
    };

    const journey = {
      step1_parse: parsedQuery,
      step2_expand: expandedQueries,
      step3_retrieval_counts: {
        companyOS: dynamicContext.tieredContext.companyOS.length,
        agentDocs: dynamicContext.tieredContext.agentDocs.length,
        playbooks: dynamicContext.tieredContext.playbooks.length,
        keywords: dynamicContext.tieredContext.keywords.length,
      },
      step4_prompt_length: prompt.length,
      step5_prompt_preview: prompt.slice(0, 1200),
    };

    return new Response(
      JSON.stringify({
        success: true,
        companyId: resolvedCompanyId,
        parsedQuery,
        expandedQueries,
        contextSummary,
        prompt: {
          length: prompt.length,
          preview: prompt.slice(0, 1200),
        },
        journey,
      }, null, 2),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Context flow debugger failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
