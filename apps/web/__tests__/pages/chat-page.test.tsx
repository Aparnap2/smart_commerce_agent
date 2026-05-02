import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CustomerChatPage from '@/app/(chat)/page'
import { useStream } from '@langchain/langgraph-sdk/react'

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: { user: { id: 'user-1', name: 'Test User' } },
    status: 'authenticated',
  })),
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

// Mock LoadExternalComponent
vi.mock('@langchain/langgraph-sdk/react-ui', () => ({
  LoadExternalComponent: vi.fn(() => null),
  uiMessageReducer: vi.fn((state, event) => [...state, event]),
}))

// Mock useStream hook
const mockSubmit = vi.fn()
vi.mock('@langchain/langgraph-sdk/react', () => ({
  useStream: vi.fn(() => ({
    messages: [],
    values: { ui: [] },
    isLoading: false,
    submit: mockSubmit,
  })),
}))

describe('Customer Chat Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useStream).mockReturnValue({
      messages: [],
      values: { ui: [] },
      isLoading: false,
      submit: mockSubmit,
    })
  })

  it('renders suggested actions', () => {
    render(<CustomerChatPage />)
    const suggestions = screen.getAllByTestId('suggested-action')
    expect(suggestions).toHaveLength(4)
  })

  it('shows personalized greeting with user name', () => {
    render(<CustomerChatPage />)
    expect(screen.getByText(/Hi, Test User!/)).toBeInTheDocument()
  })

  it('sends message when suggested action clicked', () => {
    render(<CustomerChatPage />)
    fireEvent.click(screen.getByText('Show me headphones under ₹15,000'))
    expect(mockSubmit).toHaveBeenCalledWith({
      messages: [{ role: 'user', content: 'Show me headphones under ₹15,000' }],
    })
  })

  it('shows agent thinking indicator when loading', () => {
    vi.mocked(useStream).mockReturnValue({
      messages: [],
      values: { ui: [] },
      isLoading: true,
      submit: vi.fn(),
    })
    render(<CustomerChatPage />)
    expect(screen.getByTestId('agent-thinking')).toBeInTheDocument()
  })

  it('disables send button when input empty', () => {
    render(<CustomerChatPage />)
    expect(screen.getByLabelText('Send message')).toBeDisabled()
  })

  it('enables send button when input has text', async () => {
    render(<CustomerChatPage />)
    const textarea = screen.getByLabelText('Message input')
    fireEvent.change(textarea, { target: { value: 'Hello' } })
    await waitFor(() => {
      expect(screen.getByLabelText('Send message')).not.toBeDisabled()
    })
  })

  it('sends message when send button clicked', async () => {
    render(<CustomerChatPage />)
    const textarea = screen.getByLabelText('Message input')
    fireEvent.change(textarea, { target: { value: 'Test message' } })
    const sendButton = screen.getByLabelText('Send message')
    fireEvent.click(sendButton)
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        messages: [{ role: 'user', content: 'Test message' }],
      })
    })
  })

  it('sends message when Enter key pressed', async () => {
    render(<CustomerChatPage />)
    const textarea = screen.getByLabelText('Message input')
    fireEvent.change(textarea, { target: { value: 'Test message' } })
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        messages: [{ role: 'user', content: 'Test message' }],
      })
    })
  })

  it('does not send empty message on Enter', () => {
    render(<CustomerChatPage />)
    const textarea = screen.getByLabelText('Message input')
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  it('renders header with assistant name', () => {
    render(<CustomerChatPage />)
    expect(screen.getByText('TechTrend Assistant')).toBeInTheDocument()
  })

  it('shows online status indicator', () => {
    render(<CustomerChatPage />)
    expect(screen.getByText('Online')).toBeInTheDocument()
  })
})
