import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentThinking } from '../AgentThinking';

describe('AgentThinking Component', () => {
  it('renders with default label "Thinking"', () => {
    render(<AgentThinking />);

    expect(screen.getByText('Thinking…')).toBeInTheDocument();
  });

  it('renders with specific tool label: hybridSearch', () => {
    render(<AgentThinking toolName="hybridSearch" />);

    expect(screen.getByText('Searching products…')).toBeInTheDocument();
  });

  it('renders with specific tool label: addToCart', () => {
    render(<AgentThinking toolName="addToCart" />);

    expect(screen.getByText('Updating cart…')).toBeInTheDocument();
  });

  it('renders with specific tool label: createOrder', () => {
    render(<AgentThinking toolName="createOrder" />);

    expect(screen.getByText('Placing order…')).toBeInTheDocument();
  });

  it('renders with specific tool label: getRecommendations', () => {
    render(<AgentThinking toolName="getRecommendations" />);

    expect(screen.getByText('Finding recommendations…')).toBeInTheDocument();
  });

  it('shows 3 dots with correct structure', () => {
    render(<AgentThinking toolName="hybridSearch" />);

    const dots = document.querySelectorAll('.animate-bounce');
    expect(dots).toHaveLength(3);

    // Check each dot has correct classes
    dots.forEach((dot) => {
      expect(dot).toHaveClass('w-1.5');
      expect(dot).toHaveClass('h-1.5');
      expect(dot).toHaveClass('rounded-full');
      expect(dot).toHaveClass('bg-zinc-500');
    });
  });

  it('has correct animation delays for staggered bounce', () => {
    render(<AgentThinking toolName="hybridSearch" />);

    const dots = document.querySelectorAll('.animate-bounce');
    expect(dots[0]).toHaveStyle('animation-delay: 0ms');
    expect(dots[1]).toHaveStyle('animation-delay: 150ms');
    expect(dots[2]).toHaveStyle('animation-delay: 300ms');
  });

  it('has correct ARIA attributes', () => {
    render(<AgentThinking toolName="hybridSearch" />);

    const statusDiv = screen.getByRole('status');
    expect(statusDiv).toHaveAttribute('aria-live', 'polite');
    expect(statusDiv).toHaveAttribute('aria-label', 'Searching products…');
  });

  it('has correct ARIA attributes with default label', () => {
    render(<AgentThinking />);

    const statusDiv = screen.getByRole('status');
    expect(statusDiv).toHaveAttribute('aria-live', 'polite');
    expect(statusDiv).toHaveAttribute('aria-label', 'Thinking…');
  });

  it('respects max-width constraint', () => {
    render(<AgentThinking toolName="getRecommendations" />);

    const container = screen.getByRole('status');
    expect(container).toHaveClass('max-w-[240px]');
  });

  it('has correct container styling', () => {
    render(<AgentThinking toolName="hybridSearch" />);

    const container = screen.getByRole('status');
    expect(container).toHaveClass('flex');
    expect(container).toHaveClass('items-center');
    expect(container).toHaveClass('gap-2');
    expect(container).toHaveClass('px-3');
    expect(container).toHaveClass('py-2');
    expect(container).toHaveClass('rounded-xl');
    expect(container).toHaveClass('bg-zinc-100');
    expect(container).toHaveClass('w-fit');
  });

  it('has dark mode support classes', () => {
    render(<AgentThinking toolName="hybridSearch" />);

    const container = screen.getByRole('status');
    expect(container).toHaveClass('dark:bg-zinc-800');

    const labelSpan = container.querySelector('span.text-xs');
    expect(labelSpan).toHaveClass('dark:text-zinc-400');

    const dots = document.querySelectorAll('.animate-bounce');
    dots.forEach((dot) => {
      expect(dot).toHaveClass('dark:bg-zinc-400');
    });
  });

  it('has correct label text styling', () => {
    render(<AgentThinking toolName="hybridSearch" />);

    const labelSpan = screen.getByText('Searching products…');
    expect(labelSpan).toHaveClass('text-xs');
    expect(labelSpan).toHaveClass('text-zinc-500');
    expect(labelSpan).toHaveClass('font-medium');
  });

  it('dots container has aria-hidden', () => {
    render(<AgentThinking toolName="hybridSearch" />);

    const dotsContainer = document.querySelector('span[aria-hidden="true"]');
    expect(dotsContainer).toBeInTheDocument();
  });

  it('handles unknown tool name with default label', () => {
    render(<AgentThinking toolName="unknownTool" />);

    expect(screen.getByText('Thinking…')).toBeInTheDocument();
  });
});
