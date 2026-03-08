import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StreamingMessage } from '../StreamingMessage';

describe('StreamingMessage Component', () => {
  it('renders content correctly', () => {
    render(<StreamingMessage content="Hello world" isStreaming={false} />);

    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('shows cursor when isStreaming=true', () => {
    render(<StreamingMessage content="Streaming text" isStreaming={true} />);

    const cursor = document.querySelector('.animate-pulse');
    expect(cursor).toBeInTheDocument();
    expect(cursor).toHaveAttribute('aria-hidden', 'true');
  });

  it('hides cursor when isStreaming=false', () => {
    render(<StreamingMessage content="Static text" isStreaming={false} />);

    const cursor = document.querySelector('.animate-pulse');
    expect(cursor).not.toBeInTheDocument();
  });

  it('updates content smoothly (no flicker)', async () => {
    const { rerender } = render(<StreamingMessage content="Initial" isStreaming={true} />);

    expect(screen.getByText('Initial')).toBeInTheDocument();

    rerender(<StreamingMessage content="Updated" isStreaming={true} />);

    // Wait for transition to complete
    await waitFor(() => {
      expect(screen.getByText('Updated')).toBeInTheDocument();
    });
  });

  it('handles empty content', () => {
    const { container } = render(<StreamingMessage content="" isStreaming={false} />);

    const paragraph = container.querySelector('p');
    expect(paragraph).toBeInTheDocument();
    expect(paragraph?.textContent).toBe('');
  });

  it('handles long content with word wrap', () => {
    const longContent =
      'This is a very long piece of text that should wrap correctly ' +
      'and maintain readability even with extremely long words like ' +
      'supercalifragilisticexpialidocious or technical terms like ' +
      'pneumonoultramicroscopicsilicovolcanoconiosis without breaking layout.';

    render(<StreamingMessage content={longContent} isStreaming={false} />);

    expect(screen.getByText(longContent)).toBeInTheDocument();

    // Check for break-words class
    const paragraph = screen.getByText(longContent).closest('p');
    expect(paragraph).toHaveClass('break-words');
  });

  it('preserves whitespace with whitespace-pre-wrap', () => {
    const contentWithWhitespace = `Line 1
    Line 2
        Line 3 with indentation`;

    render(<StreamingMessage content={contentWithWhitespace} isStreaming={false} />);

    const paragraph = screen.getByText(contentWithWhitespace).closest('p');
    expect(paragraph).toHaveClass('whitespace-pre-wrap');
  });

  it('has correct accessibility attributes', () => {
    render(<StreamingMessage content="Accessible content" isStreaming={true} />);

    const paragraph = screen.getByText('Accessible content').closest('p');
    expect(paragraph).toHaveAttribute('aria-live', 'polite');
    expect(paragraph).toHaveAttribute('aria-atomic', 'false');
  });

  it('applies correct styling classes', () => {
    render(<StreamingMessage content="Styled text" isStreaming={false} />);

    const paragraph = screen.getByText('Styled text').closest('p');
    expect(paragraph).toHaveClass('text-sm');
    expect(paragraph).toHaveClass('leading-relaxed');
  });

  it('cursor has correct styling when streaming', () => {
    render(<StreamingMessage content="With cursor" isStreaming={true} />);

    const cursor = document.querySelector('.animate-pulse');
    expect(cursor).toHaveClass('inline-block');
    expect(cursor).toHaveClass('w-[2px]');
    expect(cursor).toHaveClass('h-[1em]');
    expect(cursor).toHaveClass('bg-current');
    expect(cursor).toHaveClass('align-text-bottom');
  });
});
