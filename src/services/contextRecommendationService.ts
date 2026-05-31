import { aiProxyFetch } from '../lib/proxyFetch';
import { GenerationSettings } from './aiService';

export interface EntityCandidate {
  id: string;
  name: string;
  type: 'characters' | 'places' | 'things' | 'technologies' | 'story_bible_entries';
}

export interface TagRecommendation {
  entity: EntityCandidate;
  reason: string;
}

export async function recommendContextTags(
  designBrief: string,
  chapterSummary: string,
  availableEntities: EntityCandidate[],
  settings: GenerationSettings,
): Promise<TagRecommendation[]> {
  const entityList = availableEntities
    .map(e => `[${e.type}] "${e.name}" (id: ${e.id})`)
    .join('\n');

  const prompt = `You are an assistant that analyzes a Design Brief and identifies which franchise entities are relevant to this chapter.

Given the following Design Brief and Chapter Summary, identify ONLY the entities from the Available Entities list that are:
- Directly mentioned in the brief
- Required to understand the chapter's events
- Characters who appear in planned scenes
- Locations where scenes take place
- Objects or technology that play a role

Do NOT include:
- Entities from future books or unrelated story arcs
- Entities only tangentially related
- Entities that are merely part of the broader franchise but not this chapter

=== CHAPTER SUMMARY ===
${chapterSummary}

=== DESIGN BRIEF ===
${designBrief}

=== AVAILABLE ENTITIES ===
${entityList}

Respond with a JSON array of objects. Each object must have:
- "id": the entity id exactly as shown above
- "reason": a brief explanation (under 15 words) of why this entity is needed

Respond ONLY with the JSON array, no other text. Example:
[{"id": "abc-123", "reason": "Main POV character in this chapter"}]`;

  const isChatEndpoint = settings.api_endpoint.includes('/chat/completions');

  const baseBody: Record<string, unknown> = {
    temperature: 0.1,
    max_tokens: 2000,
  };

  if (settings.model_name) baseBody.model = settings.model_name;

  const requestBody: Record<string, unknown> = isChatEndpoint
    ? { ...baseBody, messages: [{ role: 'user', content: prompt }] }
    : { ...baseBody, prompt };

  const response = await aiProxyFetch(
    settings.api_endpoint,
    { ...requestBody, stream: false } as Record<string, unknown>,
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Recommendation request failed: ${response.status} ${errBody}`);
  }

  const data = await response.json();

  const rawText = (
    data.choices?.[0]?.message?.content ||
    data.choices?.[0]?.text ||
    data.text ||
    '[]'
  ).trim();

  // Extract JSON array from response (handle markdown code blocks)
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed: Array<{ id: string; reason: string }> = JSON.parse(jsonMatch[0]);
    const entityMap = new Map(availableEntities.map(e => [e.id, e]));

    return parsed
      .filter(item => entityMap.has(item.id))
      .map(item => ({
        entity: entityMap.get(item.id)!,
        reason: item.reason || 'Relevant to chapter',
      }));
  } catch {
    console.error('Failed to parse tag recommendations:', rawText);
    return [];
  }
}
