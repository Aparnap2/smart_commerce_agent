/**
 * Search Products Tool Tests
 *
 * Tests for NL filtering with LLM-native extraction.
 * Verifies Zod schema validation and multi-turn context support.
 *
 * @file tests/unit/lib/agent/tools/search-products.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  SearchProductsParams,
  buildSearchParams,
  type SearchContext,
} from "@/lib/agent/tools/search-products";

describe("SearchProductsParams", () => {
  it("should validate minimal params with just query", () => {
    const result = SearchProductsParams.safeParse({ query: "headphones" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe("headphones");
      expect(result.data.inStockOnly).toBe(true); // default
      expect(result.data.limit).toBe(6); // default
    }
  });

  it("should validate all filter params", () => {
    const params = {
      query: "wireless headphones",
      maxPrice: 5000,
      minPrice: 1000,
      brand: "Sony",
      useCase: "gym",
      category: "electronics",
      inStockOnly: true,
      limit: 4,
    };

    const result = SearchProductsParams.safeParse(params);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(params);
    }
  });

  it("should enforce limit max of 6", () => {
    const result = SearchProductsParams.safeParse({
      query: "headphones",
      limit: 10, // Should fail - max is 6
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      // Zod v4 error structure
      expect(result.error.issues.length).toBeGreaterThan(0);
      expect(result.error.issues[0].code).toBe("too_big");
    }
  });

  it("should accept negative prices (validation only, business logic handles this)", () => {
    // Note: Zod schema doesn't enforce non-negative by default
    // Business logic in hybridProductSearch should handle this
    const result = SearchProductsParams.safeParse({
      query: "headphones",
      maxPrice: -100,
    });

    // Schema allows it, but hybrid search should validate
    expect(result.success).toBe(true);
  });

  it("should accept optional similarTo parameter", () => {
    const result = SearchProductsParams.safeParse({
      query: "similar products",
      similarTo: "product-123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.similarTo).toBe("product-123");
    }
  });

  it("should default inStockOnly to true", () => {
    const result = SearchProductsParams.safeParse({
      query: "headphones",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inStockOnly).toBe(true);
    }
  });

  it("should allow explicit inStockOnly false", () => {
    const result = SearchProductsParams.safeParse({
      query: "headphones",
      inStockOnly: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inStockOnly).toBe(false);
    }
  });
});

describe("buildSearchParams", () => {
  const mockLastSearch: SearchContext = {
    query: "headphones",
    filters: {
      query: "headphones",
      maxPrice: 5000,
      minPrice: undefined,
      brand: "Sony",
      inStockOnly: true,
      limit: 6,
    },
    resultsCount: 4,
    timestamp: Date.now(),
  };

  it("should use new params when provided", () => {
    const result = buildSearchParams({
      query: "earbuds",
      maxPrice: 3000,
    });

    expect(result.query).toBe("earbuds");
    expect(result.maxPrice).toBe(3000);
  });

  it("should inherit from lastSearch when new params missing", () => {
    const result = buildSearchParams(
      { maxPrice: 3000 }, // New price constraint
      mockLastSearch
    );

    expect(result.query).toBe("headphones"); // From lastSearch
    expect(result.maxPrice).toBe(3000); // New constraint
    expect(result.brand).toBe("Sony"); // From lastSearch
    expect(result.inStockOnly).toBe(true); // From lastSearch
  });

  it("should handle undefined lastSearch gracefully", () => {
    const result = buildSearchParams({ query: "new search" });

    expect(result.query).toBe("new search");
    expect(result.inStockOnly).toBe(true); // Default
    expect(result.limit).toBe(6); // Default
  });

  it("should allow overriding specific filters while keeping others", () => {
    const result = buildSearchParams(
      {
        maxPrice: 10000, // Override price
        // Keep brand from lastSearch
      },
      mockLastSearch
    );

    expect(result.maxPrice).toBe(10000);
    expect(result.brand).toBe("Sony"); // Inherited
    expect(result.query).toBe("headphones"); // Inherited
  });

  it("should preserve existing values when undefined is passed", () => {
    const result = buildSearchParams(
      {
        brand: undefined, // Undefined doesn't override
      },
      mockLastSearch
    );

    // Undefined doesn't clear the value - it inherits from lastSearch
    expect(result.brand).toBe("Sony");
  });
});

describe("Multi-turn conversation flow", () => {
  it("should support follow-up refinement pattern", () => {
    // Turn 1: Initial search
    const turn1 = buildSearchParams({ query: "headphones" });
    expect(turn1.query).toBe("headphones");
    expect(turn1.maxPrice).toBeUndefined();

    // Simulate storing in AI state
    const lastSearch: SearchContext = {
      query: turn1.query,
      filters: { ...turn1 },
      resultsCount: 10,
      timestamp: Date.now(),
    };

    // Turn 2: Price refinement
    const turn2 = buildSearchParams({ maxPrice: 10000 }, lastSearch);
    expect(turn2.query).toBe("headphones"); // Preserved
    expect(turn2.maxPrice).toBe(10000); // New constraint

    // Turn 3: Brand refinement
    const turn3 = buildSearchParams({ brand: "Bose" }, {
      ...lastSearch,
      filters: turn2,
    });
    expect(turn3.query).toBe("headphones"); // Still preserved
    expect(turn3.maxPrice).toBe(10000); // Still preserved
    expect(turn3.brand).toBe("Bose"); // New constraint
  });
});
