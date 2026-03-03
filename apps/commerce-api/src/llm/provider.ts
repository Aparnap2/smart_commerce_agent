import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';

export function getLLM(options?: { temperature?: number }) {
  if (!process.env.OPENAI_BASE_URL) {
    throw new Error('OPENAI_BASE_URL required');
  }
  return new ChatOpenAI({
    model:       process.env.OPENAI_MODEL ?? 'gpt-oss-120b',
    temperature: options?.temperature ?? 0.2,
    configuration: {
      baseURL: process.env.OPENAI_BASE_URL,
      apiKey:  process.env.OPENAI_API_KEY ?? 'placeholder',
      defaultQuery: process.env.OPENAI_API_VERSION
        ? { 'api-version': process.env.OPENAI_API_VERSION }
        : undefined,
    },
  });
}

export function getEmbeddings() {
  return new OpenAIEmbeddings({
    model: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
    configuration: {
      baseURL: process.env.OPENAI_BASE_URL!,
      apiKey:  process.env.OPENAI_API_KEY ?? 'placeholder',
      defaultQuery: process.env.OPENAI_API_VERSION
        ? { 'api-version': process.env.OPENAI_API_VERSION }
        : undefined,
    },
  });
}
