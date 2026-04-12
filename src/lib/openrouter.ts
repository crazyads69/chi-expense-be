import OpenAI from 'openai';

// Use lazy initialization or function to avoid crashing at boot
// if OPENROUTER_API_KEY is not set immediately
export const getOpenAIClient = () => {
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  });
};
