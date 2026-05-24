/**
 * TDD Test: ApprovalCard must use submit callback for agent communication
 *
 * RED: Human writes failing test first (this file)
 * GREEN: Implementation to pass test
 *
 * Test verifies that ApprovalCard uses onSubmitDecision callback for agent communication
 * instead of direct fetch() API calls.
 *
 * NOTE: safePrice() expects paise values (integer cents). Divide by 100 for display.
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ApprovalCard from "../../../components/genui/ApprovalCard"

describe("ApprovalCard", () => {
  const mockSubmitDecision = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls onSubmitDecision when Approve is clicked, NOT fetch()", async () => {
    const fetchSpy = vi.spyOn(global, "fetch")

    render(
      <ApprovalCard
        pr={{
          id: "pr_123",
          prNumber: "PR-001",
          status: "PENDING",
          requestedBy: "Test User",
          department: "Engineering",
          total: 5000000, // ₹50,000 in paise
          lineItems: [],
          createdAt: new Date().toISOString(),
        }}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onSubmitDecision={mockSubmitDecision}
      />
    )

    // Click approve button - should trigger submit callback NOT fetch
    await act(async () => {
      fireEvent.click(screen.getByTestId("approve-pr-btn"))
    })

    // Verify submit callback was called with correct parameters
    expect(mockSubmitDecision).toHaveBeenCalledWith(
      'APPROVED',
      'PR-001',
      5000000,
      ''
    )

    // Verify fetch was NOT called (no direct API call - agent flow only)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("calls onSubmitDecision when Reject is clicked, NOT fetch()", async () => {
    const fetchSpy = vi.spyOn(global, "fetch")

    render(
      <ApprovalCard
        pr={{
          id: "pr_456",
          prNumber: "PR-002",
          status: "PENDING",
          requestedBy: "Another User",
          department: "Sales",
          total: 2500000, // ₹25,000 in paise
          lineItems: [],
        }}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onSubmitDecision={mockSubmitDecision}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByTestId("reject-pr-btn"))
    })

    expect(mockSubmitDecision).toHaveBeenCalledWith(
      'REJECTED',
      'PR-002',
      2500000,
      ''
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("displays PR details correctly", () => {
    render(
      <ApprovalCard
        pr={{
          id: "pr_789",
          prNumber: "PR-003",
          status: "HIGH",
          requestedBy: "Jane Doe",
          department: "Marketing",
          total: 7500000, // ₹75,000 in paise
          lineItems: [
            { id: "1", name: "Laptop", quantity: 2, totalPrice: 60000 },
            { id: "2", name: "Mouse", quantity: 5, totalPrice: 15000 },
          ],
        }}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onSubmitDecision={mockSubmitDecision}
      />
    )

    expect(screen.getByTestId("approval-card")).toBeTruthy()
    expect(screen.getByText("Purchase Request #PR-003")).toBeTruthy()
    // Name renders with department as concatenated text
    expect(screen.getByText(/Jane Doe/)).toBeTruthy()
    // safePrice(7500000/100) = ₹75,000 + fraction digits
    const totalEl = screen.getByTestId("approval-card")
    expect(totalEl.textContent).toContain("₹75,000")
  })

  it("renders Approve and Reject buttons with correct testids", () => {
    render(
      <ApprovalCard
        pr={{
          id: "pr_test",
          prNumber: "PR-TEST",
          status: "PENDING",
          requestedBy: "Test",
          department: "Test",
          total: 1000000, // ₹10,000 in paise
          lineItems: [],
        }}
        onSubmitDecision={mockSubmitDecision}
      />
    )

    expect(screen.getByTestId("approve-pr-btn")).toBeTruthy()
    expect(screen.getByTestId("reject-pr-btn")).toBeTruthy()
  })

  it("passes comments in the submit decision", async () => {
    const commentsText = "Approved for Q4 budget"

    render(
      <ApprovalCard
        pr={{
          id: "pr_comment",
          prNumber: "PR-CMT",
          status: "PENDING",
          requestedBy: "User",
          department: "IT",
          total: 1000000,
          lineItems: [],
        }}
        onApprove={vi.fn()}
        onSubmitDecision={mockSubmitDecision}
      />
    )

    const textarea = screen.getByPlaceholderText("Comments (optional)")
    await act(async () => {
      fireEvent.change(textarea, { target: { value: commentsText } })
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId("approve-pr-btn"))
    })

    expect(mockSubmitDecision).toHaveBeenCalledWith(
      'APPROVED',
      'PR-CMT',
      1000000,
      commentsText
    )
  })
})
