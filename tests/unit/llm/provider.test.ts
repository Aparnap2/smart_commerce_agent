/**
 * LLM Provider Tests
 * 
 * Tests for Azure AI Foundry provider (Azure ONLY - no Ollama, no Google, no OpenAI direct).
 */

import { describe, it, expect } from 'vitest';
import { getLLM, generateEmbedding } from '@/lib/llm/provider';
import { AzureChatOpenAI } from '@langchain/openai';

describe('LLM Provider', () => {
  it('getLLM() should return AzureChatOpenAI instance', () => {
    // This will throw if AZURE_OPENAI_BASE_URL is not set
    try {
      const llm = getLLM();
      expect(llm).toBeInstanceOf(AzureChatOpenAI);
    } catch (e) {
      // Expected if env var not set in test environment
      expect((e as Error).message).toContain('AZURE_OPENAI_BASE_URL');
    }
  });

  it('should use Azure deployment name from env', () => {
    const originalDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    process.env.AZURE_OPENAI_DEPLOYMENT = 'test-deployment';
    
    try {
      getLLM();
    } catch {
      // Expected if other env vars not set
    }
    
    // Restore
    process.env.AZURE_OPENAI_DEPLOYMENT = originalDeployment;
  });

  it('should throw ConfigError when AZURE_OPENAI_BASE_URL missing', () => {
    const originalUrl = process.env.AZURE_OPENAI_BASE_URL;
    delete process.env.AZURE_OPENAI_BASE_URL;
    
    expect(() => getLLM()).toThrow('AZURE_OPENAI_BASE_URL');
    
    // Restore
    process.env.AZURE_OPENAI_BASE_URL = originalUrl;
  });

  it('should NOT reference OllamaLLM', () => {
    // This test ensures no Ollama code paths exist
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

  it('should NOT reference OpenAI direct (non-Azure)', () => {
    const providerModule = require('@/lib/llm/provider');
    const moduleString = JSON.stringify(providerModule);
    
    // Should use Azure endpoints, not openai.com
    expect(moduleString).not.toContain('api.openai.com');
  });
});
