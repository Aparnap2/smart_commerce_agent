/**
 * Direct test of Azure LLM
 */

import { createChatCompletion } from '../../lib/llm/provider';

describe('Azure LLM Direct', () => {
  it('should make a direct LLM call', async () => {
    const result = await createChatCompletion({
      messages: [{ role: 'user', content: 'Say hi' }],
      maxTokens: 10
    });
    
    console.log('Result:', result);
    expect(result).toBeDefined();
    expect(result.content).toBeTruthy();
  });
});
