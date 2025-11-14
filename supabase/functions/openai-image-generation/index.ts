import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Provider-specific prompt optimization
function optimizePromptForProvider(prompt: string, provider: string, model: string): string {
  if (provider === 'openai' && model.includes('gpt-image')) {
    // OpenAI-specific optimizations: concise but descriptive
    return `${prompt}. High quality, detailed, professional photography style.`;
  } else if (provider === 'google') {
    // Google/Gemini provider falls back to OpenAI, use OpenAI-style optimization
    return `${prompt}. High quality, detailed, professional photography style.`;
  }
  return prompt; // fallback for unknown providers
}

interface ImageGenerationRequest {
  prompt: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  n?: number;
  ai_provider?: string;
  ai_model?: string;
  optimize_prompt?: boolean;
}

interface ImageGenerationResponse {
  success: boolean;
  images: Array<{
    url: string;
    revised_prompt?: string;
  }>;
  metadata: {
    original_prompt: string;
    size: string;
    quality: string;
    model: string;
    generated_at: string;
    execution_time: number;
  };
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    // Initialize Supabase client with service role for storage operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from request
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      prompt,
      size = '1024x1024',
      quality = 'standard',
      n = 1,
      ai_provider = 'openai',
      ai_model = 'gpt-image-1',
      optimize_prompt = true // New parameter to enable/disable optimization
    }: ImageGenerationRequest = await req.json();

    // Optimize prompt based on provider if enabled
    const optimizedPrompt = optimize_prompt 
      ? optimizePromptForProvider(prompt, ai_provider, ai_model)
      : prompt;

    console.log(`Image generation request - Provider: ${ai_provider}, Model: ${ai_model}`);
    console.log(`Original prompt: ${prompt}`);
    if (optimize_prompt) {
      console.log(`Optimized prompt: ${optimizedPrompt}`);
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Prompt is required and must be a non-empty string'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Generating ${n} image(s) with prompt: "${prompt}" using ${ai_provider}/${ai_model}`);

    let imageData;

    // Route based on AI provider
    if (ai_provider === 'google') {
      // Google/Gemini models cannot generate images via their APIs - fallback to OpenAI
      console.log('Google/Gemini models cannot generate images without additional setup - falling back to OpenAI DALL-E');
      
      if (!openaiApiKey) {
        throw new Error('OpenAI API key not configured for Gemini fallback');
      }
      
      const validImageModels = ['gpt-image-1', 'gpt-image-1-mini', 'gpt-image-0721-mini-alpha', 'dall-e-2', 'dall-e-3'];
      const finalModel = validImageModels.includes(ai_model) ? ai_model : 'gpt-image-1';
      
      const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: finalModel,
          prompt: optimizedPrompt,
          size,
          quality,
          n: Math.min(n, 4)
        }),
      });
      
      if (!openaiResponse.ok) {
        const errorData = await openaiResponse.json().catch(() => ({}));
        console.error('OpenAI API error:', errorData);
        throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorData.error?.message || 'Unknown error'}`);
      }
      
      imageData = await openaiResponse.json();
      console.log('OpenAI fallback image generation completed for Google provider');
      
    } else if (ai_provider === 'anthropic') {
      // Anthropic/Claude cannot generate images - fallback to OpenAI
      console.log('Anthropic/Claude models cannot generate images - falling back to OpenAI DALL-E');
      
      if (!openaiApiKey) {
        throw new Error('OpenAI API key not configured for Claude fallback');
      }
      
      const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: optimizedPrompt,
          size,
          quality,
          n: Math.min(n, 4)
        }),
      });
      
      if (!openaiResponse.ok) {
        const errorData = await openaiResponse.json().catch(() => ({}));
        console.error('OpenAI API error:', errorData);
        throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorData.error?.message || 'Unknown error'}`);
      }
      
      imageData = await openaiResponse.json();
      console.log('OpenAI fallback image generation completed');
      
    } else {
      // OpenAI provider - use native OpenAI image generation
      console.log('Using OpenAI DALL-E for image generation');
      
      if (!openaiApiKey) {
        throw new Error('OpenAI API key not configured');
      }
      
      const validImageModels = ['gpt-image-1', 'gpt-image-1-mini', 'gpt-image-0721-mini-alpha', 'dall-e-2', 'dall-e-3'];
      const finalModel = validImageModels.includes(ai_model) ? ai_model : 'gpt-image-1';
      
      const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: finalModel,
          prompt: optimizedPrompt,
          size,
          quality,
          n: Math.min(n, 4)
        }),
      });
      
      if (!openaiResponse.ok) {
        const errorData = await openaiResponse.json().catch(() => ({}));
        console.error('OpenAI API error:', errorData);
        throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorData.error?.message || 'Unknown error'}`);
      }
      
      imageData = await openaiResponse.json();
      console.log('OpenAI image generation completed');
    }

    // Download and store images in Supabase Storage
    const storedImages = [];
    
    for (let i = 0; i < imageData.data.length; i++) {
      const imgData = imageData.data[i];
      try {
        let imageUint8Array: Uint8Array;

        // Handle base64 encoded images (from gpt-image-1)
        if (imgData.b64_json) {
          const base64Data = imgData.b64_json;
          const binaryString = atob(base64Data);
          imageUint8Array = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            imageUint8Array[j] = binaryString.charCodeAt(j);
          }
        } else if (imgData.url) {
          // Handle URL-based images (from older DALL-E models)
          const imageResponse = await fetch(imgData.url);
          if (!imageResponse.ok) {
            console.error(`Failed to download image ${i + 1}:`, imageResponse.status);
            continue;
          }
          const imageBuffer = await imageResponse.arrayBuffer();
          imageUint8Array = new Uint8Array(imageBuffer);
        } else {
          console.error(`No valid image data for image ${i + 1}`);
          continue;
        }
        
        // Generate a unique filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `generated-image-${user.id}-${timestamp}-${i + 1}.png`;
        const filePath = `generated-images/${filename}`;
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, imageUint8Array, {
            contentType: 'image/png',
            cacheControl: '3600'
          });
        
        if (uploadError) {
          console.error(`Failed to upload image ${i + 1}:`, uploadError);
          continue;
        }
        
        // Get the public URL
        const { data: urlData } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(filePath);
        
        storedImages.push({
          url: urlData.publicUrl,
          revised_prompt: imgData.revised_prompt,
          storage_path: filePath
        });
        
        console.log(`Successfully stored image ${i + 1} at:`, urlData.publicUrl);
        
      } catch (error) {
        console.error(`Error processing image ${i + 1}:`, error);
        // Continue with other images even if one fails
      }
    }

    if (storedImages.length === 0) {
      throw new Error('Failed to store any generated images');
    }

    const response: ImageGenerationResponse = {
      success: true,
      images: storedImages,
      metadata: {
        original_prompt: prompt,
        size,
        quality,
        model: `${ai_provider}/${ai_model}`,
        generated_at: new Date().toISOString(),
        execution_time: Date.now() - startTime
      }
    };

    console.log('Image generation completed successfully:', {
      prompt: prompt.substring(0, 50) + '...',
      imagesGenerated: storedImages.length,
      executionTime: response.metadata.execution_time
    });

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in openai-image-generation:', error);
    
    const response: ImageGenerationResponse = {
      success: false,
      images: [],
      metadata: {
        original_prompt: '',
        size: '1024x1024',
        quality: 'standard',
        model: 'openai/gpt-image-1',
        generated_at: new Date().toISOString(),
        execution_time: Date.now()
      },
      error: error instanceof Error ? error.message : String(error)
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});



