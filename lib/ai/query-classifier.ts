export type QueryClassification = 'follow-up' | 'new-analysis';

export async function classifyQuery(
  query: string,
  conversationHistory: string
): Promise<QueryClassification> {
  try {
    const response = await fetch('/api/classify-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, conversationHistory }),
    });

    if (!response.ok) {
      console.error('Error classifying query:', response.statusText);
      return 'new-analysis'; // Default to new analysis on error
    }

    const classification: QueryClassification = await response.json();
    return classification;

  } catch (error) {
    console.error('Error fetching from /api/classify-query:', error);
    return 'new-analysis'; // Default to new analysis on error
  }
}
