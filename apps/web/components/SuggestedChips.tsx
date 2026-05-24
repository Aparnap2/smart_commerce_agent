// SuggestedChips - Role-aware suggestion chips for GenUI
// Shows different chips based on user role (EMPLOYEE vs MANAGER)

'use client'

import React from 'react'
import type { FC } from 'react'

interface Props {
  role?: 'EMPLOYEE' | 'MANAGER' | 'ADMIN'
  onSelect?: (text: string) => void
}

// Employee-specific chips
const EMPLOYEE_CHIPS = [
  "Create PR",
  "View budget",
  "Add to cart",
  "View my PRs",
  "Track order",
]

// Manager-specific chips  
const MANAGER_CHIPS = [
  "Approve PR",
  "Team spending",
  "Department budget",
  "Pending approvals",
  "Generate report",
]

// Admin-specific chips (all)
const ADMIN_CHIPS = [
  "System health",
  "User management",
  "Audit logs",
  "Budget settings",
]

interface ChipButtonProps {
  text: string
  onClick?: () => void
}

const ChipButton: FC<ChipButtonProps> = ({ text, onClick }) => (
  <button
    onClick={onClick}
    data-testid={`chip-${text.toLowerCase().replace(/\s+/g, '-')}`}
    className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
  >
    {text}
  </button>
)

const SuggestedChips: FC<Props> = ({ role = 'EMPLOYEE', onSelect }) => {
  // Determine which chips to show based on role
  const getChips = () => {
    switch (role) {
      case 'MANAGER':
        return MANAGER_CHIPS
      case 'ADMIN':
        // Admin sees all chips
        return [...EMPLOYEE_CHIPS, ...MANAGER_CHIPS, ...ADMIN_CHIPS]
      case 'EMPLOYEE':
      default:
        return EMPLOYEE_CHIPS
    }
  }

  const chips = getChips()

  const handleSelect = (text: string) => {
    onSelect?.(text)
  }

  return (
    <div 
      data-testid="suggested-chips" 
      className="flex flex-wrap gap-2"
      role="group"
      aria-label={`Suggested actions for ${role}`}
    >
      {chips.map((chip) => (
        <ChipButton
          key={chip}
          text={chip}
          onClick={() => handleSelect(chip)}
        />
      ))}
    </div>
  )
}

export default SuggestedChips