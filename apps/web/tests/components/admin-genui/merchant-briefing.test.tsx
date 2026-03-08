/**
 * Merchant Briefing Component Tests
 *
 * Tests for the MerchantBriefing dashboard card component.
 * Validates rendering of anomalies, metrics, and action buttons.
 *
 * @file apps/web/components/admin-genui/__tests__/merchant-briefing.test.tsx
 */

// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MerchantBriefing } from "@/components/admin-genui/merchant-briefing";
import type { Anomaly } from "@/lib/agent/tools/merchant-briefing";

describe("MerchantBriefing", () => {
  const defaultProps = {
    revenueDelta: {
      today: 50000,
      yesterday: 45000,
      deltaPercent: 11,
      isPositive: true,
    },
    stockVelocity: [
      {
        productId: "1",
        name: "Low Stock Product",
        stock: 5,
        dailyVelocity: 2.3,
        daysUntilStockout: 2,
        isLowStock: true,
        isUrgent: true,
      },
    ],
    refundRate: {
      today: 5,
      total: 50,
      ratePercent: 10,
      avgRatePercent: 7.5,
      isAboveAvg: true,
    },
    cartAbandonment: {
      abandoned: 40,
      checkouts: 10,
      ratePercent: 80,
      isUnusual: true,
    },
    searchZeroResults: {
      terms: [],
      total: 0,
    },
    anomalies: [] as Anomaly[],
  };

  it("renders header with greeting", () => {
    render(<MerchantBriefing {...defaultProps} />);

    expect(
      screen.getByText(/good morning/i)
    ).toBeInTheDocument();
  });

  it("renders revenue metrics correctly", () => {
    render(<MerchantBriefing {...defaultProps} />);

    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("₹50,000")).toBeInTheDocument();
    expect(screen.getByText("11% vs yesterday")).toBeInTheDocument();
    expect(screen.getByText("↑")).toBeInTheDocument();
  });

  it("renders refund metrics correctly", () => {
    render(<MerchantBriefing {...defaultProps} />);

    expect(screen.getByText("Refunds")).toBeInTheDocument();
    expect(screen.getByText("10%")).toBeInTheDocument();
    expect(screen.getByText(/vs 7\.5% average/i)).toBeInTheDocument();
  });

  it("renders cart abandonment metrics correctly", () => {
    render(<MerchantBriefing {...defaultProps} />);

    expect(screen.getByText("Cart Abandonment")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText(/last 4 hours/i)).toBeInTheDocument();
  });

  it("renders low stock metrics correctly", () => {
    render(<MerchantBriefing {...defaultProps} />);

    expect(screen.getByText("Low Stock Items")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("1 urgent")).toBeInTheDocument();
  });

  it("renders high priority anomalies section", () => {
    const highPriorityAnomalies: Anomaly[] = [
      {
        type: "revenue",
        severity: "high",
        message: "Revenue down 25% vs yesterday",
        action: "investigate",
      },
    ];

    render(
      <MerchantBriefing
        {...defaultProps}
        anomalies={highPriorityAnomalies}
      />
    );

    expect(
      screen.getByText(/high priority/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/revenue down 25%/i)
    ).toBeInTheDocument();
  });

  it("renders medium priority anomalies section", () => {
    const mediumPriorityAnomalies: Anomaly[] = [
      {
        type: "refunds",
        severity: "medium",
        message: "Refund rate 12% vs 7% average",
        action: "investigate",
      },
    ];

    render(
      <MerchantBriefing
        {...defaultProps}
        anomalies={mediumPriorityAnomalies}
      />
    );

    expect(
      screen.getByText(/medium priority/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/refund rate 12%/i)
    ).toBeInTheDocument();
  });

  it("renders low priority anomalies section", () => {
    const lowPriorityAnomalies: Anomaly[] = [
      {
        type: "search",
        severity: "low",
        message: "10 searches with zero results today",
        action: "promote",
      },
    ];

    render(
      <MerchantBriefing
        {...defaultProps}
        anomalies={lowPriorityAnomalies}
      />
    );

    expect(
      screen.getByText(/low priority/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/10 searches with zero results/i)
    ).toBeInTheDocument();
  });

  it("renders action buttons", () => {
    render(<MerchantBriefing {...defaultProps} />);

    expect(screen.getByText("Investigate")).toBeInTheDocument();
    expect(screen.getByText("View Full Report")).toBeInTheDocument();
  });

  it("shows positive revenue delta with up arrow", () => {
    render(<MerchantBriefing {...defaultProps} />);

    expect(screen.getByText("↑")).toBeInTheDocument();
  });

  it("shows negative revenue delta with down arrow", () => {
    render(
      <MerchantBriefing
        {...defaultProps}
        revenueDelta={{
          today: 40000,
          yesterday: 50000,
          deltaPercent: -20,
          isPositive: false,
        }}
      />
    );

    expect(screen.getByText("↓")).toBeInTheDocument();
    expect(screen.getByText(/20% vs yesterday/i)).toBeInTheDocument();
  });

  it("displays multiple anomalies of same severity", () => {
    const multipleAnomalies: Anomaly[] = [
      {
        type: "revenue",
        severity: "high",
        message: "Revenue down 25% vs yesterday",
        action: "investigate",
      },
      {
        type: "stock",
        severity: "high",
        message: "3 products will stock out in ≤3 days",
        action: "restock",
      },
    ];

    render(
      <MerchantBriefing
        {...defaultProps}
        anomalies={multipleAnomalies}
      />
    );

    expect(
      screen.getByText(/high priority \(2\)/i)
    ).toBeInTheDocument();
  });

  it("hides anomaly sections when no anomalies", () => {
    render(<MerchantBriefing {...defaultProps} anomalies={[]} />);

    expect(screen.queryByText(/high priority/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/medium priority/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/low priority/i)).not.toBeInTheDocument();
  });

  it("renders business health timestamp", () => {
    render(<MerchantBriefing {...defaultProps} />);

    expect(
      screen.getByText(/business health briefing/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/updated just now/i)
    ).toBeInTheDocument();
  });

  it("formats Indian Rupee correctly with locale", () => {
    render(
      <MerchantBriefing
        {...defaultProps}
        revenueDelta={{
          today: 125000,
          yesterday: 100000,
          deltaPercent: 25,
          isPositive: true,
        }}
      />
    );

    expect(screen.getByText("₹1,25,000")).toBeInTheDocument();
  });

  it("shows urgent stock count in low stock metric", () => {
    const urgentStock = [
      {
        productId: "1",
        name: "Critical Stock",
        stock: 2,
        dailyVelocity: 1.5,
        daysUntilStockout: 1,
        isLowStock: true,
        isUrgent: true,
      },
      {
        productId: "2",
        name: "Low Stock",
        stock: 8,
        dailyVelocity: 0.5,
        daysUntilStockout: 16,
        isLowStock: true,
        isUrgent: false,
      },
    ];

    render(
      <MerchantBriefing
        {...defaultProps}
        stockVelocity={urgentStock}
      />
    );

    expect(screen.getByText("2")).toBeInTheDocument(); // total low stock
    expect(screen.getByText("1 urgent")).toBeInTheDocument();
  });
});
