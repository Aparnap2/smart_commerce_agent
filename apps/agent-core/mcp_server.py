"""
MCP Server - exposes LangGraph tools via Model Context Protocol
"""
import os
import json
from fastapi import FastAPI
from pydantic import AnyUrl
from contextlib import asynccontextmanager
import asyncio
from typing import Any

# MCP imports
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

try:
    from mcp.server.lifecycle import LifespanManager
except ImportError:
    # Newer mcp versions use different lifecycle
    LifespanManager = None

# Import our tools
from src.db import get_pool, close_pool
from src.tools import search_catalog, get_budget_status, get_purchase_requests, submit_for_approval, process_approval
from langchain_core.runnables import RunnableConfig


app = FastAPI(title="ProcureAI MCP Server")


def create_tools():
    """Define MCP tools matching our LangGraph tools"""
    return [
        Tool(
            name="search_catalog",
            description="Search the approved vendor catalog by natural language. Returns catalog items with vendor, pricing, lead time. Category options: HARDWARE, SOFTWARE, SERVICES, OFFICE_SUPPLIES, INFRASTRUCTURE, OTHER",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "category": {"type": "string", "description": "Filter by category (optional)"},
                    "max_unit_price": {"type": "integer", "description": "Maximum price in rupees (optional)"},
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="get_budget_status",
            description="Get the employee's department budget status: monthly limit, spent so far, and remaining balance.",
            inputSchema={
                "type": "object",
                "properties": {
                    "department_id": {"type": "string", "description": "Department ID (required)"},
                },
                "required": ["department_id"],
            },
        ),
        Tool(
            name="get_purchase_requests",
            description="Get purchase requests with optional status filter. Returns list of PRs for the user or department.",
            inputSchema={
                "type": "object",
                "properties": {
                    "status_filter": {"type": "string", "description": "Filter by status: DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, PURCHASED"},
                    "user_id": {"type": "string", "description": "Filter by user email"},
                },
            },
        ),
        Tool(
            name="submit_for_approval",
            description="Submit a purchase request for manager approval.",
            inputSchema={
                "type": "object",
                "properties": {
                    "pr_id": {"type": "string", "description": "Purchase Request ID to submit"},
                },
                "required": ["pr_id"],
            },
        ),
        Tool(
            name="process_approval",
            description="Process (approve/reject) a purchase request. Use for manager approval workflow.",
            inputSchema={
                "type": "object",
                "properties": {
                    "pr_id": {"type": "string", "description": "Purchase Request ID"},
                    "decision": {"type": "string", "description": "APPROVED or REJECTED"},
                    "comments": {"type": "string", "description": "Optional comments"},
                },
                "required": ["pr_id", "decision"],
            },
        ),
    ]


async def handle_tool_call(tool_name: str, arguments: dict, config: dict) -> str:
    """Execute tool and return JSON result"""
    runnable_config = RunnableConfig(configurable=config) if config else None

    if tool_name == "search_catalog":
        return await search_catalog.ainvoke({
            "query": arguments.get("query"),
            "category": arguments.get("category"),
            "max_unit_price": arguments.get("max_unit_price"),
        }, config=runnable_config)

    elif tool_name == "get_budget_status":
        return await get_budget_status.ainvoke({}, config=runnable_config)

    elif tool_name == "get_purchase_requests":
        return await get_purchase_requests.ainvoke({
            "status_filter": arguments.get("status_filter"),
            "user_id": arguments.get("user_id"),
        }, config=runnable_config)

    elif tool_name == "submit_for_approval":
        return await submit_for_approval.ainvoke({
            "pr_id": arguments.get("pr_id"),
        }, config=runnable_config)

    elif tool_name == "process_approval":
        return await process_approval.ainvoke({
            "pr_id": arguments.get("pr_id"),
            "decision": arguments.get("decision"),
            "comments": arguments.get("comments"),
        }, config=runnable_config)

    return json.dumps({"error": f"Unknown tool: {tool_name}"})


# MCP Server setup
server = Server("procureai-mcp")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return create_tools()


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    result = await handle_tool_call(name, arguments, {})
    return [TextContent(type="text", text=result)]


async def run_mcp_server():
    """Run MCP server with stdio transport"""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


@app.get("/health")
async def health():
    return {"status": "ok", "service": "procureai-mcp"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)