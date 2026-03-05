'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic } from 'lucide-react';

interface InputBarProps {
    onSend: (message: string) => void;
    disabled?: boolean;
}

export const InputBar: React.FC<InputBarProps> = ({ onSend, disabled }) => {
    const [message, setMessage] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSend = () => {
        if (message.trim() && !disabled) {
            onSend(message);
            setMessage('');
        }
    };

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [message]);

    return (
        <div className="p-4 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 sticky bottom-0 z-10">
            <div className="max-w-4xl mx-auto relative group">
                <textarea
                    ref={textareaRef}
                    rows={1}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask me anything — search, cart, orders, returns..."
                    className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-2xl pl-12 pr-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none text-[15px] shadow-sm border border-gray-200 dark:border-gray-800"
                    style={{ maxHeight: '200px' }}
                />

                <div className="absolute left-3 bottom-3 flex gap-1">
                    <button className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                        <Paperclip size={20} />
                    </button>
                </div>

                <div className="absolute right-3 bottom-3 flex gap-1">
                    <button className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                        <Mic size={20} />
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={!message.trim() || disabled}
                        className={`p-1.5 rounded-lg transition-all ${message.trim() && !disabled
                                ? 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30'
                                : 'text-gray-300'
                            }`}
                    >
                        <Send size={20} />
                    </button>
                </div>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-2 lg:block hidden">
                AI may produce inaccurate info. Verify important details.
            </p>
        </div>
    );
};
