'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Send, RotateCcw, X, ShoppingCart, Star, Search } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { useState, useRef, useEffect, useCallback } from 'react';

// Product data
const products = [
  { id: 1, name: 'Premium Laptop', price: 1299.99, description: 'High-performance laptop with 16GB RAM and 512GB SSD', image: '/laptop.jpg', category: 'Computers' },
  { id: 2, name: 'Wireless Earbuds', price: 149.99, description: 'Noise-cancelling earbuds with 24-hour battery life', image: '/earbuds.jpg', category: 'Audio' },
  { id: 3, name: 'Smartphone Pro', price: 999.99, description: 'Latest smartphone with advanced camera system and all-day battery', image: '/smartphone.jpg', category: 'Phones' },
  { id: 4, name: 'Smart Watch', price: 299.99, description: 'Fitness tracker with heart rate monitor and GPS', image: '/smartwatch.jpg', category: 'Wearables' },
];

// Categories
const categories = [
  { name: 'All', icon: '' },
  { name: 'Computers', icon: '' },
  { name: 'Phones', icon: '' },
  { name: 'Audio', icon: '' },
  { name: 'Wearables', icon: '' },
  { name: 'Gaming', icon: '' },
  { name: 'Accessories', icon: '' }
];

// Message type definition
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [chatInput, setChatInput] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset chat
  const resetChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMessages([]);
    toast.success('Chat history reset!');
  }, []);

  // Send message with SSE streaming
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
    };

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      // Add empty assistant message to show streaming
      setMessages(prev => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const chunk = JSON.parse(data);
              if (chunk.error) {
                throw new Error(chunk.message);
              }

              const contentDelta = chunk.choices?.[0]?.delta?.content;
              if (contentDelta) {
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.id === assistantMessageId) {
                    return [...prev.slice(0, -1), {
                      ...last,
                      content: last.content + contentDelta,
                    }];
                  }
                  return prev;
                });
              }
            } catch (parseError) {
              // Skip invalid JSON
              console.warn('Failed to parse chunk:', data);
            }
          }
        }
      }

      toast.success('Response received');
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[UI] Request aborted');
        return;
      }

      console.error('[UI] Chat error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send message');

      // Remove empty assistant message on error
      setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [messages, isLoading]);

  // Render message content with markdown
  const renderMessageContent = (content: string) => {
    if (!content) {
      return (
        <div className="text-gray-500 dark:text-gray-400 text-sm">
          No response content available.
        </div>
      );
    }
    return (
      <div className="prose dark:prose-invert prose-sm max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={{
            h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
            h2: ({ node, ...props }) => <h2 className="text-lg font-semibold mt-3 mb-1" {...props} />,
            p: ({ node, ...props }) => <p className="mb-2" {...props} />,
            ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-2" {...props} />,
            li: ({ node, ...props }) => <li className="mb-1" {...props} />,
            table: ({ node, ...props }) => <table className="border-collapse border border-gray-300 dark:border-gray-600 mb-2" {...props} />,
            th: ({ node, ...props }) => <th className="border border-gray-300 dark:border-gray-600 p-2 bg-gray-100 dark:bg-gray-700" {...props} />,
            td: ({ node, ...props }) => <td className="border border-gray-300 dark:border-gray-600 p-2" {...props} />,
            code: ({ node, ...props }) => <code className="bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5" {...props} />,
            pre: ({ node, ...props }) => <pre className="bg-gray-100 dark:bg-gray-800 rounded p-2 overflow-x-auto" {...props} />,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  };

  // Filter products
  const filteredProducts = products.filter(
    (product) =>
      (searchQuery === '' ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (selectedCategory === 'All' || product.category === selectedCategory)
  );

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Toaster position="top-center" />
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">TechTrend</h1>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search products..."
                className="px-4 py-2 rounded-full text-sm text-gray-800 w-64 focus:outline-none focus:ring-2 focus:ring-blue-300"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
            <button
              onClick={() => setIsChatOpen(true)}
              className="bg-white text-blue-600 px-4 py-2 rounded-full text-sm font-medium hover:bg-blue-50 transition"
            >
              Chat Support
            </button>
          </div>
        </div>
      </header>
      <div className="container mx-auto p-4">
        <div className="flex overflow-x-auto pb-2 space-x-2">
          {categories.map((category) => (
            <button
              key={category.name}
              onClick={() => setSelectedCategory(category.name)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
                selectedCategory === category.name
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="mr-2">{category.icon}</span>
              {category.name}
            </button>
          ))}
        </div>
      </div>
      <div className="container mx-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition"
            >
              <div className="h-48 bg-gray-200 dark:bg-gray-700 relative flex items-center justify-center">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="object-contain h-full w-full"
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <ShoppingCart size={48} className="text-gray-400 dark:text-gray-500" />
                )}
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-lg">{product.name}</h3>
                  <div className="flex items-center text-amber-500">
                    <Star className="h-4 w-4 fill-current" />
                    <span className="ml-1 text-xs">4.5</span>
                  </div>
                </div>
                <p className="text-blue-600 dark:text-blue-400 font-bold mt-1">${product.price.toFixed(2)}</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-2 line-clamp-2">{product.description}</p>
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                    {product.category}
                  </span>
                  <button
                    onClick={() => toast.success(`Added ${product.name} to cart!`)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            className="fixed bottom-4 right-4 w-96 h-[600px] bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden flex flex-col z-50"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="bg-gradient-to-r from-blue-700 to-indigo-600 text-white p-4 flex justify-between items-center rounded-t-2xl">
              <h3 className="font-bold text-lg">TechTrend Support</h3>
              <div>
                <button
                  onClick={resetChat}
                  title="Reset Chat"
                  className="text-sm mr-3 p-1 hover:bg-white/20 rounded-full transition"
                >
                  <RotateCcw size={18} />
                </button>
                 <button
                   onClick={() => setIsChatOpen(false)}
                  title="Close Chat"
                  className="text-xl p-1 hover:bg-white/20 rounded-full transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                  <div className="mb-4">
                    <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <ShoppingCart className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <h3 className="font-medium text-lg mb-2">Welcome to TechTrend Support</h3>
                  <p className="text-sm">
                    Ask about your orders, products, or get help with any issues.
                  </p>
                </div>
              )}
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className={`inline-block p-3 rounded-xl text-sm max-w-[85%] shadow-sm ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-gray-200'
                  }`}>
                    {message.role === 'user' ? (
                      message.content
                    ) : (
                      renderMessageContent(message.content)
                    )}
                  </div>
                </motion.div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <motion.div
                  className="flex justify-start"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="inline-block p-3 rounded-xl text-sm bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-gray-200 max-w-[85%] shadow-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs">Thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (chatInput.trim()) {
                  await sendMessage(chatInput);
                  setChatInput('');
                }
              }}
              className="border-t border-gray-200 dark:border-gray-700 p-4 flex items-center"
            >
              <input
                type="text"
                name="chat-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about orders, products, or support..."
                className="flex-1 p-2 rounded-l-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={isLoading}
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-r-lg transition disabled:opacity-50"
                disabled={isLoading || !chatInput.trim()}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
      {!isChatOpen && (
        <motion.button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </motion.button>
      )}
    </main>
  );
}
