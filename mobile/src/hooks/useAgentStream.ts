import { useRef, useCallback } from 'react';
import EventSource from 'react-native-sse';
import { useChatStore, type UIEventName, type UIEvent } from '../store/chat.store';
import { useAuthStore } from '../store/auth.store';

type SSEEvents = 'messages/partial' | 'custom' | 'end' | 'error';
const AGENT = process.env.EXPO_PUBLIC_AGENT_URL || 'http://localhost:8000';

export function useAgentStream() {
  const esRef = useRef<InstanceType<typeof EventSource<SSEEvents>> | null>(null);
  const messages = useChatStore(s => s.messages);
  const threadId = useChatStore(s => s.threadId);
  const addMessage = useChatStore(s => s.addMessage);
  const upsertMessage = useChatStore(s => s.upsertMessage);
  const pushUIEvent = useChatStore(s => s.pushUIEvent);
  const setStreaming = useChatStore(s => s.setStreaming);
  const setError = useChatStore(s => s.setError);
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);

  const submit = useCallback((text: string) => {
    const userMsgId = `human-${Date.now()}`;
    addMessage({ id: userMsgId, role: 'human', content: text, timestamp: Date.now() });
    setStreaming(true); setError(null);
    esRef.current?.close(); esRef.current = null;
    const history = [...messages, { id: userMsgId, role: 'human' as const, content: text, timestamp: Date.now() }].map(m => ({ role: m.role, content: m.content }));
    let lastAiMsgId = `ai-${Date.now()}`;

    const es = new EventSource<SSEEvents>(`${AGENT}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ messages: history, user_id: user?.id ?? 'anonymous', thread_id: threadId }),
    });
    esRef.current = es;

    es.addEventListener('messages/partial', (e) => {
      if (!e.data) return;
      try {
        const msgs = JSON.parse(e.data);
        for (const msg of Array.isArray(msgs) ? msgs : [msgs]) {
          if (msg.type !== 'ai' || !msg.content) continue;
          lastAiMsgId = msg.id ?? lastAiMsgId;
          upsertMessage(lastAiMsgId, msg.content);
        }
      } catch {}
    });
    es.addEventListener('custom', (e) => {
      if (!e.data) return;
      try {
        const data = JSON.parse(e.data);
        if (data?.type === 'ui' && data.name) {
          const eventName = data.name as UIEventName;
          pushUIEvent({
            id: `${data.name}-${Date.now()}`,
            name: eventName,
            props: data.props ?? {},
            afterMsgId: lastAiMsgId,
            timestamp: Date.now(),
          } as UIEvent);
        }
      } catch {}
    });
    es.addEventListener('end', () => { setStreaming(false); es.close(); esRef.current = null; });
    es.addEventListener('error', (e) => { setStreaming(false); setError((e as any)?.message ?? 'Connection failed'); es.close(); esRef.current = null; });
  }, [messages, threadId, token, user, addMessage, upsertMessage, pushUIEvent, setStreaming, setError]);

  const stop = useCallback(() => { esRef.current?.close(); esRef.current = null; setStreaming(false); }, [setStreaming]);
  return { submit, stop };
}
