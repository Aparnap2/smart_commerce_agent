import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Shell } from '../Shell';
import { Rail } from '../Rail';
import { Header } from '../Header';

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { name: 'Test User', email: 'test@example.com' } },
    status: 'authenticated',
  }),
}));

describe('Shell Component', () => {
  it('renders children and rail correctly', () => {
    render(
      <Shell rail={<div data-testid="rail">Rail Content</div>}>
        <div data-testid="main">Main Content</div>
      </Shell>
    );

    expect(screen.getByTestId('rail')).toBeInTheDocument();
    expect(screen.getByTestId('main')).toBeInTheDocument();
  });

  it('applies correct grid layout classes', () => {
    const { container } = render(
      <Shell rail={<div>Rail</div>}>
        <div>Main</div>
      </Shell>
    );

    const shell = container.firstChild as HTMLElement;
    expect(shell).toHaveClass('shell');
  });
});

describe('Rail Component', () => {
  it('renders brand logo and name', () => {
    render(<Rail />);

    expect(screen.getByText('TT')).toBeInTheDocument();
    expect(screen.getByText('TechTrend')).toBeInTheDocument();
  });

  it('renders new thread button', () => {
    render(<Rail />);

    expect(screen.getByText('New thread')).toBeInTheDocument();
  });

  it('displays live context section with cart total', () => {
    render(<Rail />);

    expect(screen.getByText('Live Context')).toBeInTheDocument();
    expect(screen.getByText('Cart Total')).toBeInTheDocument();
    expect(screen.getByText('₹44,890')).toBeInTheDocument();
  });

  it('shows user profile information', () => {
    render(<Rail />);

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('Pro Member')).toBeInTheDocument();
  });

  it('renders thread history section', () => {
    render(<Rail />);

    expect(screen.getByText('Recent Threads')).toBeInTheDocument();
    expect(screen.getByText('Headphones under ₹15k')).toBeInTheDocument();
    expect(screen.getByText('Order tracking ORD-992')).toBeInTheDocument();
  });
});

describe('Header Component', () => {
  it('renders with default title', () => {
    render(<Header />);

    expect(screen.getByText('New Conversation')).toBeInTheDocument();
  });

  it('renders with custom title', () => {
    render(<Header title="Custom Title" />);

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  it('renders search bar', () => {
    render(<Header />);

    expect(screen.getByPlaceholderText('Search in thread...')).toBeInTheDocument();
  });

  it('renders share and menu buttons', () => {
    render(<Header />);

    // Get all buttons - there should be 2 (share and more)
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });
});
