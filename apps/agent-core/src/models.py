"""
Pydantic models for agent tools and requests
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal


class SearchCatalogInput(BaseModel):
    query: str = Field(..., description="Search query for catalog")
    category: Optional[str] = Field(None, description="Filter by category: HARDWARE, SOFTWARE, etc.")
    max_unit_price: Optional[int] = Field(None, description="Maximum price in paise")


class BudgetStatusInput(BaseModel):
    department_id: str = Field(..., description="Department ID to check budget for")


class GetPurchaseRequestsInput(BaseModel):
    status_filter: Optional[Literal["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "PURCHASED"]] = Field(None, description="Filter by PR status")
    user_id: Optional[str] = Field(None, description="Filter by user email")


class SubmitApprovalInput(BaseModel):
    pr_id: str = Field(..., description="Purchase Request ID to submit")


class ProcessApprovalInput(BaseModel):
    pr_id: str = Field(..., description="Purchase Request ID")
    decision: Literal["APPROVED", "REJECTED"] = Field(..., description="Approval decision")
    comments: Optional[str] = Field(None, description="Optional comments")


class CatalogItem(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    sku: str
    unitPrice: int
    category: str
    vendor: str
    vendorCode: str
    leadDays: int
    inStock: bool
    minOrderQty: int


class BudgetStatus(BaseModel):
    department: str
    monthlyBudget: int
    spentThisMonth: int
    remaining: int
    percentUsed: float


class ToolResult(BaseModel):
    """Standard tool result format"""
    success: bool
    data: dict = Field(default_factory=dict)
    error: Optional[str] = None