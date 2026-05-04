"""
Mock LLM Provider for E2E Testing
Returns canned responses for testing the UI flow
"""

from typing import Any, Optional, AsyncIterator, Sequence
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, AIMessageChunk
from langchain_core.outputs import ChatGeneration, ChatResult, ChatGenerationChunk
from langchain_core.tools import BaseTool


class MockChatModel(BaseChatModel):
    """Mock LLM that returns predefined responses for testing"""

    model_name: str = "mock-model"
    temperature: float = 0.1

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> ChatResult:
        """Generate a mock response based on the input"""
        last_message = messages[-1].content if messages else ""
        content = self._get_response(str(last_message))

        generation = ChatGeneration(
            message=AIMessage(content=content),
        )
        return ChatResult(generations=[generation])

    async def _agenerate(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> ChatResult:
        """Async version of _generate"""
        return self._generate(messages, stop, run_manager, **kwargs)

    async def _astream(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> AsyncIterator[ChatGenerationChunk]:
        """Stream mock response word by word for testing"""
        last_message = messages[-1].content if messages else ""
        content = self._get_response(str(last_message))
        
        # Stream word by word to simulate real streaming
        words = content.split()
        for i, word in enumerate(words):
            chunk_text = word + (" " if i < len(words) - 1 else "")
            yield ChatGenerationChunk(
                message=AIMessageChunk(content=chunk_text),
            )
    
    def _generate_with_tools(self, messages: list[BaseMessage]) -> ChatResult:
        """Generate a response that includes tool calls for testing"""
        last_message = messages[-1].content if messages else ""
        user_input_lower = last_message.lower()
        
        # If user asks for laptop, trigger search_products tool
        if "laptop" in user_input_lower or "new hire" in user_input_lower:
            from langchain_core.messages import AIMessage
            ai_msg = AIMessage(
                content="",
                tool_calls=[{
                    "name": "search_products",
                    "args": {"query": "laptop", "category": None, "brand": None, "min_price": None, "max_price": None, "in_stock_only": True},
                    "id": "mock-call-1"
                }]
            )
            return ChatResult(generations=[ChatGeneration(message=ai_msg)])
        
        # Default response
        return self._generate(messages)

    def _get_response(self, user_input: str) -> str:
        """Return canned response based on input keywords"""
        user_input_lower = user_input.lower()

        # Handle planner prompts (looking for JSON array with graphql queries)
        if "create a concise multi-step action plan" in user_input_lower or "graphql.query" in user_input_lower:
            if "headphone" in user_input_lower or "wireless" in user_input_lower:
                return '''[{"step":"Search for wireless headphones","tool":"graphql.query","type":"AUTO","args":{"query":"{ products(limit: 5) { items { id name price description stock } } }","variables":{}}}]'''
            return '''[{"step":"Search for products","tool":"graphql.query","type":"AUTO","args":{"query":"{ products(limit: 5) { items { id name price } } }","variables":{}}}]'''

        # Handle classify prompts (looking for JSON with intent)
        if "classify the intent" in user_input_lower or "valid intents:" in user_input_lower:
            if "headphone" in user_input_lower or "wireless" in user_input_lower:
                return '{"intent":"product_search","entities":{"products":["wireless headphones"],"maxPrice":null,"minPrice":null,"quantity":null,"orderId":null},"sentiment":"neutral","confidence":0.9}'
            return '{"intent":"general","entities":{},"sentiment":"neutral","confidence":0.5}'

        # Handle general chat responses
        if "headphone" in user_input_lower or "earbud" in user_input_lower or "wireless" in user_input_lower:
            return '''I found some great wireless headphones for your gym workouts under ₹8000:

1. **Sony WF-1000XM5** - ₹7,999 - Premium wireless earbuds with excellent noise cancellation
2. **JBL Tune 230NC** - ₹6,999 - Noise cancelling earbuds with great bass
3. **Realme Buds Air 3** - ₹4,999 - ANC earbuds with good battery life
4. **OnePlus Buds Z2** - ₹4,999 - Premium bass earbuds

All of these are perfect for gym use with sweat resistance and secure fit. Would you like me to add any of these to your cart?'''

        elif "add" in user_input_lower and "cart" in user_input_lower:
            return '''I've added the Sony WF-1000XM5 to your cart. Your cart now contains:
- Sony WF-1000XM5 (1 item) - ₹7,999

Would you like to proceed to checkout or continue shopping?'''

        elif "2" in user_input_lower or "two" in user_input_lower or "quantity" in user_input_lower:
            return '''I've updated the quantity to 2. Your cart now contains:
- Sony WF-1000XM5 (2 items) - ₹15,998

Ready to checkout?'''

        elif "checkout" in user_input_lower:
            return '''Ready to checkout! Here's your order summary:

**Cart Total:** ₹15,998
**Items:** 2x Sony WF-1000XM5

Please confirm your shipping address and payment method to proceed.'''

        elif "confirm" in user_input_lower:
            return '''✅ Order Confirmed!

**Order ID:** order-1
**Status:** PENDING
**Total:** ₹15,998
**Items:** 2x Sony WF-1000XM5

Your order will be shipped within 2-3 business days.'''

        elif "cancel" in user_input_lower:
            return '''I can help you cancel your order.

**Order ID:** order-1
**Status:** PENDING
**Total:** ₹15,998

Are you sure you want to cancel this order? This action cannot be undone.'''

        else:
            return '''I'm your shopping assistant. I can help you:
- Search for products
- Add items to cart
- Update quantities
- Checkout
- Track or cancel orders

What would you like to do today?'''
    
    @property
    def _llm_type(self) -> str:
        return "mock-chat"
    
    @property
    def _identifying_params(self) -> dict[str, Any]:
        return {"model_name": self.model_name}

    def bind_tools(self, tools: Sequence[BaseTool], **kwargs: Any) -> "MockChatModel":
        """Bind tools to the model - returns self for mock purposes"""
        # Return a copy with tools bound (mock just returns self since we don't actually call tools)
        return self


def get_llm(temperature: float = 0.1) -> MockChatModel:
    """Get mock LLM instance"""
    return MockChatModel(temperature=temperature)
