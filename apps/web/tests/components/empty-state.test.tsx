/**
 * EmptyState Component Tests
 *
 * Tests for the chat empty state with suggested prompts.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../../components/chat/EmptyState';

describe('EmptyState', () => {
  const mockOnSend = vi.fn();

  beforeEach(() => {
    mockOnSend.mockClear();
  });

  it('renders greeting message', () => {
    render(<EmptyState onSend={mockOnSend} />);
    
    const greeting = screen.getByText(/👋 Hi! I'm your TechTrend shopping assistant/i);
    expect(greeting).not.toBeNull();
    expect(greeting.tagName).toBe('H1');
  });

  it('renders description text', () => {
    render(<EmptyState onSend={mockOnSend} />);
    
    const description = screen.getByText(/I can help you find products, manage your cart/i);
    expect(description).not.toBeNull();
  });

  it('renders all four suggested prompts', () => {
    render(<EmptyState onSend={mockOnSend} />);
    
    expect(screen.getByText(/Headphones under ₹15,000/i)).not.toBeNull();
    expect(screen.getByText(/Where's my last order\?/i)).not.toBeNull();
    expect(screen.getByText(/Show my cart/i)).not.toBeNull();
    expect(screen.getByText(/Gift ideas under ₹3,000/i)).not.toBeNull();
  });

  it('renders prompt icons', () => {
    render(<EmptyState onSend={mockOnSend} />);
    
    // Check for emoji icons (they're rendered as text)
    const promptButtons = screen.getAllByRole('button');
    expect(promptButtons).toHaveLength(4);
  });

  it('calls onSend with correct message when first prompt is clicked', () => {
    render(<EmptyState onSend={mockOnSend} />);
    
    const headphonesPrompt = screen.getByText(/Headphones under ₹15,000/i).closest('button');
    fireEvent.click(headphonesPrompt!);
    
    expect(mockOnSend).toHaveBeenCalledWith('Show me wireless headphones under ₹15,000');
    expect(mockOnSend).toHaveBeenCalledTimes(1);
  });

  it('calls onSend with correct message when order tracking prompt is clicked', () => {
    render(<EmptyState onSend={mockOnSend} />);
    
    const orderPrompt = screen.getByText(/Where's my last order\?/i).closest('button');
    fireEvent.click(orderPrompt!);
    
    expect(mockOnSend).toHaveBeenCalledWith('Where is my order?');
  });

  it('calls onSend with correct message when cart prompt is clicked', () => {
    render(<EmptyState onSend={mockOnSend} />);
    
    const cartPrompt = screen.getByText(/Show my cart/i).closest('button');
    fireEvent.click(cartPrompt!);
    
    expect(mockOnSend).toHaveBeenCalledWith("What's in my cart?");
  });

  it('calls onSend with correct message when gift prompt is clicked', () => {
    render(<EmptyState onSend={mockOnSend} />);
    
    const giftPrompt = screen.getByText(/Gift ideas under ₹3,000/i).closest('button');
    fireEvent.click(giftPrompt!);
    
    expect(mockOnSend).toHaveBeenCalledWith('Show me gift ideas under ₹3,000');
  });

  it('has proper accessibility attributes on prompt buttons', () => {
    render(<EmptyState onSend={mockOnSend} />);
    
    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button.getAttribute('type')).toBe('button');
      expect(button.getAttribute('aria-label')).toContain('Send:');
    });
  });

  it('uses proper semantic HTML structure', () => {
    render(<EmptyState onSend={mockOnSend} />);
    
    // Check for heading
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).not.toBeNull();
    
    // Check for grid layout (4 buttons)
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
  });
});
