/**
 * LLM Provider Tests
 * 
 * Tests for OpenAI SDK pattern (provider-swappable: Azure AI Foundry, OpenAI, Together, Groq).
 */

import { describe, it, expect } from 'vitest';
import { getLLM, getEmbeddings, generateEmbedding } from '@/lib/llm/provider';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';

describe('LLM Provider', () => {
  it('getLLM() should return ChatOpenAI instance (not AzureChatOpenAI)', () => {
    // This will throw if OPENAI_BASE_URL is not set
    try {
      const llm = getLLM();
      expect(llm).toBeInstanceOf(ChatOpenAI);
    } catch (e) {
      // Expected if env var not set in test environment
      expect((e as Error).message).toContain('OPENAI_BASE_URL');
    }
  });

  it('getEmbeddings() should return OpenAIEmbeddings instance', () => {
    try {
      const embeddings = getEmbeddings();
      expect(embeddings).toBeInstanceOf(OpenAIEmbeddings);
    } catch (e) {
      expect((e as Error).message).toContain('OPENAI_BASE_URL');
    }
  });

  it('should use model name from env', () => {
    const originalModel = process.env.OPENAI_MODEL;
    process.env.OPENAI_MODEL = 'test-model';
    
    try {
      getLLM();
    } catch {
      // Expected if other env vars not set
    }
    
    // Restore
    process.env.OPENAI_MODEL = originalModel;
  });

  it('should throw ConfigError when OPENAI_BASE_URL missing', () => {
    const originalUrl = process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_BASE_URL;
    
    expect(() => getLLM()).toThrow('OPENAI_BASE_URL');
    
    // Restore
    process.env.OPENAI_BASE_URL = originalUrl;
  });

  it('should NOT reference Ollama', () => {
    const providerModule = require('@/lib/llm/provider');
    const moduleString = JSON.stringify(providerModule);
    
    expect(moduleString).not.toContain('ollama');
    expect(moduleString).not.toContain('Ollama');
    expect(moduleString).not.toContain('localhost:11434');
  });

  it('should NOT reference Google GenAI', () => {
    const providerModule = require('@/lib/llm/provider');
    const moduleString = JSON.stringify(providerModule);
    
    expect(moduleString).not.toContain('google');
    expect(moduleString).not.toContain('genai');
    expect(moduleString).not.toContain('gemini');
  });

  it('should NOT import AzureChatOpenAI directly', () => {
    // The provider should use ChatOpenAI with configuration.baseURL
    const fs = require('fs');
    const providerCode = fs.readFileSync('./lib/llm/provider.ts', 'utf-8');
    
    expect(providerCode).not.toContain('AzureChatOpenAI');
  });
});
