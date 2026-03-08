// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActionConfirm } from '../../../app/dashboard/components/genui/action-confirm'
import { describe, it, expect, vi } from 'vitest'

const actions = [
  { stepId:'s-1', step:'Initiate payment of ₹2,999', tool:'stripe', type:'CONFIRM' },
  { stepId:'s-2', step:'Place order',                 tool:'graphql.mutate', type:'CONFIRM' },
]

describe('ActionConfirm', () => {
  it('renders one card per action', () => {
    render(<ActionConfirm actions={actions} onDecision={vi.fn()} />)
    expect(screen.getByTestId('action-confirm')).toBeTruthy()
    expect(screen.getByTestId('approve-s-1')).toBeTruthy()
    expect(screen.getByTestId('approve-s-2')).toBeTruthy()
  })

  it('approve fires onDecision with (stepId, true)', () => {
    const onDecision = vi.fn()
    render(<ActionConfirm actions={actions} onDecision={onDecision} />)
    fireEvent.click(screen.getByTestId('approve-s-1'))
    expect(onDecision).toHaveBeenCalledWith('s-1', true)
  })

  it('cancel fires onDecision with (stepId, false)', () => {
    const onDecision = vi.fn()
    render(<ActionConfirm actions={actions} onDecision={onDecision} />)
    fireEvent.click(screen.getByTestId('cancel-s-2'))
    expect(onDecision).toHaveBeenCalledWith('s-2', false)
  })

  it('returns null for empty actions', () => {
    const { container } = render(
      <ActionConfirm actions={[]} onDecision={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })
})
