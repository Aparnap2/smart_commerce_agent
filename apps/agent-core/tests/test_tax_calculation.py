"""
Tests for Tax/GST calculation in PRLineItem.

TDD Process:
1. Write failing test FIRST
2. Run test → RED (should fail)
3. Implement code to pass test → GREEN
4. Refactor if needed

Feature Spec:
- taxRate: Int (default 18 for GST)
- taxAmount: Int (calculated = line_total * taxRate / 100)
- totalWithTax: Int (calculated = line_total + taxAmount)
"""
import pytest
import json
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestTaxCalculation:
    """Test tax/GST calculation in PRLineItem."""

    @pytest.mark.asyncio
    async def test_default_tax_rate_is_18_percent(self):
        """
        GIVEN no taxRate specified
        WHEN adding item to PR
        THEN default taxRate should be 18 (GST)
        """
        from src.tools import get_default_tax_rate
        
        # No taxRate provided, should default to 18
        tax_rate = get_default_tax_rate()
        
        assert tax_rate == 18, f"Expected default taxRate of 18%, got {tax_rate}"

    @pytest.mark.asyncio
    async def test_tax_amount_calculation(self):
        """
        GIVEN lineTotal of ₹10,000 (1,000,000 paise) and 18% taxRate
        WHEN calculating taxAmount
        THEN taxAmount = 1,000,000 * 18 / 100 = ₹1,800 (180,000 paise)
        """
        from src.tools import calculate_tax_amount
        
        line_total = 1000000  # ₹10,000 in paise
        tax_rate = 18
        
        tax_amount = calculate_tax_amount(line_total, tax_rate)
        
        expected = 180000  # ₹1,800 in paise
        assert tax_amount == expected, f"Expected {expected}, got {tax_amount}"

    @pytest.mark.asyncio
    async def test_total_with_tax_calculation(self):
        """
        GIVEN lineTotal of ₹10,000 and taxAmount of ₹1,800
        WHEN calculating totalWithTax
        THEN totalWithTax = 10,000 + 1,800 = ₹11,800
        """
        from src.tools import calculate_total_with_tax
        
        line_total = 1000000  # ₹10,000 in paise
        tax_amount = 180000   # ₹1,800 in paise
        
        total_with_tax = calculate_total_with_tax(line_total, tax_amount)
        
        expected = 1180000  # ₹11,800 in paise
        assert total_with_tax == expected, f"Expected {expected}, got {total_with_tax}"

    @pytest.mark.asyncio
    async def test_tax_calculation_with_different_rates(self):
        """
        Test tax calculation with various tax rates.
        """
        from src.tools import calculate_tax_amount
        
        line_total = 1000000  # ₹10,000
        
        # Test 5% (reduced GST)
        assert calculate_tax_amount(line_total, 5) == 50000
        
        # Test 12%
        assert calculate_tax_amount(line_total, 12) == 120000
        
        # Test 28% (highest GST slab)
        assert calculate_tax_amount(line_total, 28) == 280000

    @pytest.mark.asyncio
    async def test_tax_calculation_zero_amount(self):
        """
        Test tax calculation when lineTotal is 0.
        """
        from src.tools import calculate_tax_amount
        
        line_total = 0
        tax_rate = 18
        
        tax_amount = calculate_tax_amount(line_total, tax_rate)
        
        assert tax_amount == 0

    @pytest.mark.asyncio
    async def test_tax_amount_rounds_to_integer(self):
        """
        Test that taxAmount is always an integer (paise).
        """
        from src.tools import calculate_tax_amount
        
        # ��99.99 with 18% = ₹17.9982, should round to ₹18 (1800 paise)
        line_total = 9999  # ₹99.99
        tax_rate = 18
        
        tax_amount = calculate_tax_amount(line_total, tax_rate)
        
        # Should be integer (no decimals in paise)
        assert tax_amount == int(tax_amount)
        assert tax_amount == 1800  # rounded from 1799.82