import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessCompanyOSRequest {
  company_id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  bucket?: string;
  description?: string;
  tags?: string[];
  additional_context?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !serviceKey || !anonKey) {
      throw new Error("Missing Supabase environment configuration");
    }

    const serviceClient = createClient(supabaseUrl, serviceKey);
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ProcessCompanyOSRequest = await req.json();
    const {
      company_id,
      file_path,
      file_name,
      file_type,
      file_size,
      uploaded_by,
      bucket = "documents",
      description,
      tags,
      additional_context,
    } = body;

    if (!company_id || !file_path || !file_name || !file_type || !file_size || !uploaded_by) {
      return new Response(JSON.stringify({
        success: false,
        error: "company_id, file_path, file_name, file_type, file_size, and uploaded_by are required",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify authorization: allow platform admins or members of the target company
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("company_id, role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Failed to fetch profile for authorization", profileError);
      return new Response(JSON.stringify({ success: false, error: "Unable to verify permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isPlatformAdmin = profile?.role === "platform-admin";
    const isCompanyMember = profile?.company_id === company_id;

    if (!isPlatformAdmin && !isCompanyMember) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert document archive record so CompanyOS uploads use the shared storage/table
    const { data: document, error: insertError } = await serviceClient
      .from("document_archives")
      .insert({
        company_id,
        name: file_name.replace(/\.[^/.]+$/, "") || file_name,
        description: description ?? "CompanyOS source document",
        doc_type: "other",
        file_name,
        file_type,
        file_size,
        storage_path: file_path,
        uploaded_by,
        tags: tags ?? ["company_os", "document_upload"],
        is_editable: false,
      })
      .select()
      .single();

    if (insertError || !document) {
      console.error("Failed to create document archive entry", insertError);
      throw new Error(insertError?.message ?? "Failed to record CompanyOS upload");
    }

    let embeddingsTriggered = false;
    try {
      const { error: embeddingError } = await serviceClient.functions.invoke("process-documents-embeddings", {
        body: {
          document_archive_id: document.id,
          company_id,
          user_id: uploaded_by,
        },
      });

      if (embeddingError) {
        console.error("Failed to trigger embeddings for CompanyOS upload", embeddingError);
      } else {
        embeddingsTriggered = true;
      }
    } catch (embeddingException) {
      console.error("Unexpected error triggering embeddings", embeddingException);
    }

    return new Response(JSON.stringify({
      success: true,
      document_archive_id: document.id,
      embeddingsTriggered,
      bucket,
      file_path,
      additional_context,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in process-company-os function", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
