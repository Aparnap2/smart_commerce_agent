/**
 * TDD Test: SuggestedChips must be role-aware
 * 
 * RED: Human writes failing test first (this file)
 * GREEN: Implementation to pass test
 * 
 * Test verifies that SuggestedChips shows different chips based on user role.
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SuggestedChips from "../../components/SuggestedChips"

describe("SuggestedChips", () => {
  const mockOnSelect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows EMPLOYEE chips when role=EMPLOYEE", () => {
    render(
      <SuggestedChips
        role="EMPLOYEE"
        onSelect={mockOnSelect}
      />
    )

    // Employee should see procurement-related chips
    expect(screen.getByText("Create PR")).toBeTruthy()
    expect(screen.getByText("View budget")).toBeTruthy()
    expect(screen.getByText("Add to cart")).toBeTruthy()
    
    // Should NOT see manager-only chips
    expect(screen.queryByText("Approve PR")).toBeNull()
    expect(screen.queryByText("Team spending")).toBeNull()
  })

  it("shows MANAGER chips when role=MANAGER", () => {
    render(
      <SuggestedChips
        role="MANAGER"
        onSelect={mockOnSelect}
      />
    )

    // Manager should see approval and team-related chips
    expect(screen.getByText("Approve PR")).toBeTruthy()
    expect(screen.getByText("Team spending")).toBeTruthy()
    expect(screen.getByText("Department budget")).toBeTruthy()
    
    // Should NOT see employee-only chips
    expect(screen.queryByText("Create PR")).toBeNull()
    expect(screen.queryByText("Add to cart")).toBeNull()
  })

  it("calls onSelect when chip is clicked", () => {
    render(
      <SuggestedChips
        role="EMPLOYEE"
        onSelect={mockOnSelect}
      />
    )

    const chip = screen.getByText("Create PR")
    chip.click()

    expect(mockOnSelect).toHaveBeenCalledWith("Create PR")
  })

  it("renders all chips as buttons", () => {
    render(
      <SuggestedChips
        role="EMPLOYEE"
        onSelect={mockOnSelect}
      />
    )

    const buttons = screen.getAllByRole("button")
    expect(buttons.length).toBeGreaterThan(0)
  })
})