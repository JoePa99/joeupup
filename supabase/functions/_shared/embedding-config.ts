/**
 * Centralized embedding configuration to prevent model drift
 * between document indexing and query-time search
 */

export interface EmbeddingConfig {
  model: string;
  dimensions: number;
  maxTokens: number;
  chunkSize: number;
  overlap: number;
}

export const EMBEDDING_CONFIG: EmbeddingConfig = {
  model: 'text-embedding-3-large',
  dimensions: 1536,
  maxTokens: 4000,
  chunkSize: 1000,
  overlap: 50
};

/**
 * Generate embeddings using the standardized configuration
 */
export async function generateEmbeddings(
  text: string, 
  apiKey: string
): Promise<number[][]> {
  const { model, dimensions, maxTokens, chunkSize, overlap } = EMBEDDING_CONFIG;
  
  try {
    // Estimate tokens (roughly 3.5 characters per token for English text)
    const estimatedTokens = Math.ceil(text.length / 3.5);
    
    console.log(`Token estimation: ${text.length} characters = ~${estimatedTokens} tokens (limit: ${maxTokens})`);
    
    // Check if we need to chunk the text
    if (estimatedTokens <= maxTokens && text.length <= 10000) {
      // Text is within limits, process normally
      console.log('Text within token limits, processing normally');
      
      const requestBody = {
        input: text,
        model,
        dimensions
      };
      
      console.log('Using OpenAI model:', model);
      console.log('Requesting dimensions:', dimensions);
      
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', response.status, errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.message) {
            console.error('OpenAI error details:', errorData.error);
            throw new Error(`OpenAI API error: ${response.status} - ${errorData.error.message}`);
          }
        } catch (parseError) {
          // If we can't parse the error, use the raw text
        }
        
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.data || !result.data[0] || !result.data[0].embedding) {
        throw new Error('Invalid response from OpenAI API');
      }

      const embedding = result.data[0].embedding;
      console.log(`Successfully generated embedding with ${embedding.length} dimensions`);
      
      // Verify we have the correct dimensions
      if (embedding.length !== dimensions) {
        console.warn(`Warning: Expected ${dimensions} dimensions for ${model}, but got ${embedding.length}`);
        console.warn('This might indicate the wrong model was used or there was an API issue');
      }
      
      return [embedding];
    } else {
      // Text is too long, we need to chunk it
      console.log(`Text too long (${estimatedTokens} estimated tokens, ${text.length} characters), chunking into smaller pieces`);
      
      // Create chunks with overlap to maintain context
      const chunks: string[] = [];
      
      for (let i = 0; i < text.length; i += chunkSize - overlap) {
        const chunk = text.substring(i, i + chunkSize);
        if (chunk.trim().length > 0) {
          chunks.push(chunk);
        }
      }
      
      console.log(`Created ${chunks.length} chunks for processing`);
      
      // Process all chunks and return all embeddings
      const embeddings: number[][] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const estimatedChunkTokens = Math.ceil(chunk.length / 3.5);
        console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} characters, ~${estimatedChunkTokens} tokens)`);
        
        // Double-check that the chunk is within limits
        let processedChunk = chunk;
        if (estimatedChunkTokens > maxTokens) {
          console.warn(`Chunk ${i + 1} still too large (${estimatedChunkTokens} tokens), truncating further`);
          processedChunk = chunk.substring(0, 2000); // ~2000 characters max (~570 tokens)
          console.log(`Truncated chunk to ${processedChunk.length} characters (~${Math.ceil(processedChunk.length / 3.5)} tokens)`);
        }
        
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: processedChunk,
            model,
            dimensions
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`OpenAI API error on chunk ${i + 1}:`, response.status, errorText);
          throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        
        if (!result.data || !result.data[0] || !result.data[0].embedding) {
          throw new Error(`Invalid response from OpenAI API for chunk ${i + 1}`);
        }

        const embedding = result.data[0].embedding;
        embeddings.push(embedding);
        
        console.log(`Successfully processed chunk ${i + 1}, embedding has ${embedding.length} dimensions`);
        
        // Verify we have the correct dimensions
        if (embedding.length !== dimensions) {
          console.warn(`Warning: Expected ${dimensions} dimensions for ${model}, but got ${embedding.length}`);
          console.warn('This might indicate the wrong model was used or there was an API issue');
        }
        
        // Add a small delay between requests to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`Successfully processed all ${chunks.length} chunks, returning ${embeddings.length} embeddings`);
      return embeddings;
    }
  } catch (error) {
    console.error('Error generating OpenAI embedding:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate embedding: ${errorMessage}`);
  }
}

/**
 * Generate a single embedding for query text
 */
export async function generateQueryEmbedding(
  query: string,
  apiKey: string
): Promise<number[]> {
  const embeddings = await generateEmbeddings(query, apiKey);
  if (embeddings.length === 0) {
    throw new Error('No embeddings generated for query');
  }
  return embeddings[0];
}
