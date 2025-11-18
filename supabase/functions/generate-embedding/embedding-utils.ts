/**
 * Generate a single embedding for query text using OpenAI
 */
export async function generateQueryEmbedding(
  query: string,
  apiKey: string
): Promise<number[]> {
  const model = 'text-embedding-3-large';
  const dimensions = 1536;

  try {
    const requestBody = {
      input: query,
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

    return embedding;
  } catch (error) {
    console.error('Error generating OpenAI embedding:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate embedding: ${errorMessage}`);
  }
}
