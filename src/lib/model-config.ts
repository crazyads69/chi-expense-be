// OpenRouter Model Configuration for Chi Expense
// Pricing: per 1K tokens (prompt / completion)
// Updated: 2026-05

export interface ModelConfig {
  id: string;
  purpose: 'text' | 'image' | 'both';
  promptPrice: number; // per 1K tokens
  completionPrice: number; // per 1K tokens
  contextLength: number;
  vision: boolean;
  recommended: boolean;
  notes: string;
}

/** Top 5 recommended models for expense parsing */
export const RECOMMENDED_MODELS: ModelConfig[] = [
  {
    id: 'qwen/qwen3-8b',
    purpose: 'text',
    promptPrice: 0.00005,
    completionPrice: 0.0004,
    contextLength: 40960,
    vision: false,
    recommended: true,
    notes: 'Primary text model. Excellent Vietnamese support. Best price/performance ratio. Keep as default for text parsing.',
  },
  {
    id: 'google/gemini-2.5-flash-lite',
    purpose: 'image',
    promptPrice: 0.0001,
    completionPrice: 0.0004,
    contextLength: 1048576,
    vision: true,
    recommended: true,
    notes: 'Primary image model. 33% cheaper than GPT-4o-mini. 1M context. Excellent OCR for receipts. Recommended to replace GPT-4o-mini.',
  },
  {
    id: 'qwen/qwen3.5-flash-02-23',
    purpose: 'image',
    promptPrice: 0.000065,
    completionPrice: 0.00026,
    contextLength: 1000000,
    vision: true,
    recommended: true,
    notes: 'Budget image model. 57% cheaper than GPT-4o-mini. Native vision-language. Great for cost-sensitive receipt parsing.',
  },
  {
    id: 'qwen/qwen3-32b',
    purpose: 'text',
    promptPrice: 0.00008,
    completionPrice: 0.00024,
    contextLength: 40960,
    vision: false,
    recommended: false,
    notes: 'Text upgrade path. Better reasoning for ambiguous/complex expense descriptions. Still very cheap. Use when qwen3-8b fails.',
  },
  {
    id: 'openai/gpt-4o-mini',
    purpose: 'image',
    promptPrice: 0.00015,
    completionPrice: 0.0006,
    contextLength: 128000,
    vision: true,
    recommended: false,
    notes: 'Reliable fallback image model. Proven track record. Use if Gemini/Qwen vision models produce poor results.',
  },
];

/** Current production defaults */
export const DEFAULT_TEXT_MODEL = 'qwen/qwen3-8b';
export const DEFAULT_IMAGE_MODEL = 'google/gemini-2.5-flash-lite'; // Was 'openai/gpt-4o-mini'

/** Model selection by environment */
export function getModelForTask(task: 'text' | 'image', tier: 'budget' | 'balanced' | 'quality' = 'balanced'): string {
  if (task === 'text') {
    switch (tier) {
      case 'budget': return 'qwen/qwen3-8b';
      case 'balanced': return 'qwen/qwen3-8b';
      case 'quality': return 'qwen/qwen3-32b';
    }
  }
  if (task === 'image') {
    switch (tier) {
      case 'budget': return 'qwen/qwen3.5-flash-02-23';
      case 'balanced': return 'google/gemini-2.5-flash-lite';
      case 'quality': return 'openai/gpt-4o-mini';
    }
  }
  return task === 'text' ? DEFAULT_TEXT_MODEL : DEFAULT_IMAGE_MODEL;
}

/** Fallback chain for image models (primary → fallback) */
export const IMAGE_MODEL_FALLBACKS: string[] = [
  'google/gemini-2.5-flash-lite',
  'qwen/qwen3.5-flash-02-23',
  'openai/gpt-4o-mini',
];

/** Get next fallback model in the chain */
export function getFallbackModel(currentModel: string, task: 'image'): string | null {
  if (task !== 'image') return null;
  const idx = IMAGE_MODEL_FALLBACKS.indexOf(currentModel);
  if (idx >= 0 && idx < IMAGE_MODEL_FALLBACKS.length - 1) {
    return IMAGE_MODEL_FALLBACKS[idx + 1];
  }
  return null;
}

/** Cost estimation (per request, approximate) */
export function estimateCost(modelId: string, promptTokens: number, completionTokens: number): number {
  const model = RECOMMENDED_MODELS.find(m => m.id === modelId);
  if (!model) return 0;
  return (promptTokens * model.promptPrice + completionTokens * model.completionPrice) / 1000;
}
