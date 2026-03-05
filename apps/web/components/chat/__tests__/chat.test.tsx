/**
 * ChatCanvas and InputBar Tests
 *
 * Tests for the chat UI components with the new useChatStream hook integration.
 *
 * @packageDocumentation
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatCanvas } from '../ChatCanvas';
import { InputBar } from '../InputBar';
import type { UseChatStreamReturn, ChatMessage } from '@/hooks/useChatStream';

/**
 * Creates a mock chat stream for testing
 */
function createMockChatStream(
  messages: ChatMessage[] = [],
  isLoading = false
): UseChatStreamReturn {
  return {
    messages,
    isLoading,
    error: null,
    sendMessage: vi.fn(),
    stopStreaming: vi.fn(),
    clearMessages: vi.fn(),
  };
}

/**
 * Creates a mock chat message for testing
 */
function createMessage(
  id: string,
  role: 'user' | 'assistant',
  content: string,
  type: ChatMessage['type'] = 'text'
): ChatMessage {
  return {
    id,
    role,
    content,
    type,
    createdAt: Date.now(),
  };
}

describe('ChatCanvas Component', () => {
  const mockMessages: ChatMessage[] = [
    createMessage('1', 'assistant', 'Hello! How can I help you today?'),
    createMessage('2', 'user', 'Show me headphones under $100'),
    createMessage('3', 'assistant', 'Here are some great options:'),
  ];

  it('renders chat canvas container', () => {
    const chatStream = createMockChatStream(mockMessages, false);
    const { container } = render(<ChatCanvas chatStream={chatStream} />);

    // Check for the scroll container
    expect(container.querySelector('.overflow-y-auto')).toBeInTheDocument();
  });

  it('sets correct height for virtualizer', () => {
    const chatStream = createMockChatStream(mockMessages, false);
    const { container } = render(<ChatCanvas chatStream={chatStream} />);

    // Check that virtualizer container has height set
    const virtualContainer = container.querySelector('[style*="height"]');
    expect(virtualContainer).toBeInTheDocument();
  });

  it('renders UI actions with full width', () => {
    const messagesWithUI: ChatMessage[] = [
      ...mockMessages,
      {
        id: '4',
        role: 'assistant',
        content: 'Product results',
        type: 'ui_actions',
        uiActions: [
          { component: 'ProductGrid', props: { products: [] } },
        ],
        createdAt: Date.now(),
      },
    ];

    const chatStream = createMockChatStream(messagesWithUI, false);
    const { container } = render(<ChatCanvas chatStream={chatStream} />);

    // Check that the component renders without error
    expect(container.querySelector('.overflow-y-auto')).toBeInTheDocument();
  });

  it('has correct ARIA attributes for accessibility', () => {
    const chatStream = createMockChatStream(mockMessages, false);
    const { container } = render(<ChatCanvas chatStream={chatStream} />);

    // Check for ARIA attributes
    const logElement = container.querySelector('[role="log"]');
    expect(logElement).toBeInTheDocument();
    expect(logElement).toHaveAttribute('aria-label', 'Chat messages');
    expect(logElement).toHaveAttribute('aria-live', 'polite');
  });
});

describe('InputBar Component', () => {
  it('renders textarea with placeholder', () => {
    render(<InputBar onSend={vi.fn()} />);

    expect(
      screen.getByPlaceholderText(
        'Ask me anything — search, cart, orders, returns...'
      )
    ).toBeInTheDocument();
  });

  it('calls onSend when message is submitted', () => {
    const handleSend = vi.fn();
    render(<InputBar onSend={handleSend} />);

    const textarea = screen.getByRole('textbox');
    // Get send button by position (last button)
    const buttons = screen.getAllByRole('button');
    const sendButton = buttons[buttons.length - 1];

    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);

    expect(handleSend).toHaveBeenCalledWith('Test message');
  });

  it('calls onSend when Enter is pressed', () => {
    const handleSend = vi.fn();
    render(<InputBar onSend={handleSend} />);

    const textarea = screen.getByRole('textbox');

    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(handleSend).toHaveBeenCalledWith('Test message');
  });

  it('does not send empty messages', () => {
    const handleSend = vi.fn();
    render(<InputBar onSend={handleSend} />);

    const buttons = screen.getAllByRole('button');
    const sendButton = buttons[buttons.length - 1];
    fireEvent.click(sendButton);

    expect(handleSend).not.toHaveBeenCalled();
  });

  it('auto-resizes textarea as user types', () => {
    render(<InputBar onSend={vi.fn()} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    // Initial state
    const initialHeight = textarea.style.height;

    // Add multi-line content
    fireEvent.change(textarea, {
      target: { value: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5' },
    });

    // Height should be set (component handles auto-resize)
    expect(textarea.style.height).toBeTruthy();
  });

  it('disables send button when disabled prop is true', () => {
    render(<InputBar onSend={vi.fn()} disabled={true} />);

    const textarea = screen.getByRole('textbox');
    const buttons = screen.getAllByRole('button');
    const sendButton = buttons[buttons.length - 1];

    fireEvent.change(textarea, { target: { value: 'Test message' } });

    expect(sendButton).toBeDisabled();
  });

  it('renders attachment and voice buttons', () => {
    render(<InputBar onSend={vi.fn()} />);

    const buttons = screen.getAllByRole('button');
    // Should have at least 3 buttons: attachment, voice, send
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it('clears textarea after sending message', () => {
    const handleSend = vi.fn();
    render(<InputBar onSend={handleSend} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const buttons = screen.getAllByRole('button');
    const sendButton = buttons[buttons.length - 1];

    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);

    expect(textarea.value).toBe('');
  });
});
