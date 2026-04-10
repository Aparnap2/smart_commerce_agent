import os
from typing import Annotated, TypedDict
from langchain_core.messages import BaseMessage, SystemMessage
from langchain_openai import AzureChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from .tools import ALL_TOOLS


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    user_id: str
    step_count: int


def get_llm():
    return AzureChatOpenAI(
        azure_deployment=os.environ["AZURE_OPENAI_DEPLOYMENT_NAME"],
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_version=os.environ["AZURE_OPENAI_API_VERSION"],
        temperature=0,
        streaming=True,
    ).bind_tools(ALL_TOOLS)


SYSTEM_PROMPT = """You are TechTrend's AI shopping assistant.
TechTrend is an electronics store based in India.

CAPABILITIES:
- Search products (headphones, earbuds, speakers, cables)
- View and manage shopping cart
- Track orders and show order history
- Initiate product returns (7-day policy)

RULES:
- Prices are always in ₹ INR — format as ₹X,XXX
- ALWAYS call a tool to get product/order data
- NEVER quote prices or specs from memory
- Be concise and helpful — users are on mobile
- After tool results, give a 1-2 sentence summary
- Maximum 5 tool calls per conversation turn
"""

llm = None


async def call_agent(state: AgentState):
    global llm
    if llm is None:
        llm = get_llm()

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        *state["messages"],
    ]
    response = await llm.ainvoke(messages)

    return {
        "messages": [response],
        "step_count": state.get("step_count", 0) + 1,
    }


def should_continue(state: AgentState) -> str:
    last = state["messages"][-1]
    if (
        not getattr(last, "tool_calls", None)
        or state.get("step_count", 0) >= 5
    ):
        return END
    return "tools"


def build_graph():
    tool_node = ToolNode(ALL_TOOLS)

    builder = StateGraph(AgentState)
    builder.add_node("agent", call_agent)
    builder.add_node("tools", tool_node)
    builder.set_entry_point("agent")
    builder.add_conditional_edges("agent", should_continue)
    builder.add_edge("tools", "agent")

    return builder.compile()


graph = build_graph()
