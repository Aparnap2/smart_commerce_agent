# Smart Commerce Agent - Final Implementation Plan

## Architecture Philosophy

**Vendor-Agnostic, Open-Source First**
- No locked-in cloud services (Azure/AWS/GCP specific)
- Use LangChain + LangGraph + DSPy + Pydantic for guardrails
- Works with any LLM provider (Ollama, OpenAI, Azure, Anthropic)
- Portable deployment (Docker → Any cloud)

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Orchestration** | LangGraph | Agent workflows, state management |
| **Guardrails** | LangChain + Pydantic | Input/output validation, structured output |
| **Optimization** | DSPy | Prompt optimization, LLM programming |
| **Validation** | Pydantic | Type-safe data schemas |
| **LLM** | Azure AI Foundry (configurable) | Primary LLM provider |
| **Database** | PostgreSQL + pgvector | Vector search + relational data |
| **Cache** | Redis | Session cache + RAG cache |
| **Observability** | Langfuse | Tracing, evaluation |

---

## Complete Task List

### ✅ Phase 1: Infrastructure (COMPLETE)

- [x] Docker Compose (PostgreSQL + Redis + Langfuse)
- [x] LLM Provider (Azure AI Foundry + fallback)
- [x] Makefile commands
- [x] Environment configuration

---

### ✅ Phase 2: RAG Core (COMPLETE)

- [x] Semantic chunking (`lib/rag/semantic-chunker.ts`)
- [x] Cross-encoder reranker (`lib/rag/reranker.ts`)
- [x] Query transformation (`lib/rag/query-transform.ts`)
- [x] Semantic cache (`lib/rag/semantic-cache.ts`)
- [x] 61 unit tests passing

---

### 🔲 Phase 3: Guardrails with LangChain + Pydantic (NEW - Week 2)

**Goal**: Vendor-agnostic guardrails using open-source libraries

#### 3.1 Pydantic Structured Output
```python
# lib/guardrails/schemas.py
from pydantic import BaseModel, Field, validator

class SafeQuery(BaseModel):
    """Validated user query with safety checks"""
    text: str
    is_safe: bool
    toxicity_score: float
    pii_detected: bool
    intent: str
    
    @validator('toxicity_score')
    def check_toxicity(cls, v):
        if v > 0.7:
            raise ValueError("High toxicity detected")
        return v

class StructuredResponse(BaseModel):
    """Validated AI response"""
    content: str
    sources: list[str]
    confidence: float
    grounded: bool
```

**Files**:
- `lib/guardrails/schemas.py` - Pydantic schemas
- `lib/guardrails/validators.py` - Custom validators
- `tests/unit/guardrails-pydantic.test.ts` - Tests

#### 3.2 LangChain Guardrails
```python
# lib/guardrails/langchain-guards.py
from langchain.output_parsers import PydanticOutputParser
from langchain.prompts import ChatPromptTemplate

def create_guardrail_chain(llm, schema: BaseModel):
    parser = PydanticOutputParser(pydantic_object=schema)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful assistant. {format_instructions}"),
        ("user", "{input}")
    ])
    
    chain = prompt | llm | parser
    return chain
```

**Files**:
- `lib/guardrails/langchain-guards.py` - LangChain integration
- `lib/guardrails/input-guard.py` - Input validation chain
- `lib/guardrails/output-guard.py` - Output validation chain

#### 3.3 DSPy Signature for Safety
```python
# lib/guardrails/dspy-signatures.py
import dspy

class SafeQuerySignature(dspy.Signature):
    """Analyze query for safety and intent"""
    query: str = dspy.InputField(desc="User query to analyze")
    is_safe: bool = dspy.OutputField(desc="Whether query is safe")
    intent: str = dspy.OutputField(desc="Detected user intent")
    requires_guardrails: bool = dspy.OutputField()

class SafeResponseSignature(dspy.Signature):
    """Generate safe, grounded response"""
    context: str = dspy.InputField()
    query: str = dspy.InputField()
    response: str = dspy.OutputField(desc="Safe, grounded response")
    citations: list[str] = dspy.OutputField(desc="Source citations")
    confidence: float = dspy.OutputField(desc="Confidence score 0-1")
```

**Files**:
- `lib/guardrails/dspy-signatures.py` - DSPy safety signatures
- `lib/guardrails/dspy-modules.py` - DSPy modules for guardrails

#### 3.4 LangGraph Guard Nodes
```python
# lib/agents/guard-nodes.py
from langgraph.graph import StateGraph, END

def create_guardrail_graph():
    graph = StateGraph(AgentState)
    
    # Add guard nodes
    graph.add_node("validate_input", validate_input_node)
    graph.add_node("check_safety", check_safety_node)
    graph.add_node("generate_response", generate_response_node)
    graph.add_node("validate_output", validate_output_node)
    
    # Define flow with guards
    graph.set_entry_point("validate_input")
    graph.add_edge("validate_input", "check_safety")
    graph.add_conditional_edges(
        "check_safety",
        should_proceed,
        {True: "generate_response", False: "block_request"}
    )
    graph.add_edge("generate_response", "validate_output")
    graph.add_edge("validate_output", END)
    
    return graph.compile()
```

**Files**:
- `lib/agents/guard-nodes.py` - LangGraph guard nodes
- `lib/agents/safe-agent.py` - Safe agent with guards

---

### 🔲 Phase 4: MCP Tools Completion (Week 3)

#### 4.1 Cart Tools
```typescript
// lib/mcp/tools.ts - Extend existing
tools.set('cart.update_quantity', createTool('cart.update_quantity', {
  title: 'Update Cart Item Quantity',
  parameters: z.object({
    cartId: z.string(),
    productId: z.number(),
    quantity: z.number().int().positive(),
  }),
  execute: async ({ cartId, productId, quantity }, userId) => {
    // Implementation
  }
}));

tools.set('cart.remove_item', createTool('cart.remove_item', {...}));
tools.set('cart.clear', createTool('cart.clear', {...}));
tools.set('cart.apply_coupon', createTool('cart.apply_coupon', {...}));
```

#### 4.2 Checkout Tool
```typescript
tools.set('checkout.create', createTool('checkout.create', {
  title: 'Create Checkout Session',
  parameters: z.object({
    cartId: z.string(),
    customerId: z.string(),
    paymentMethodId: z.string(),
  }),
  execute: async ({ cartId, customerId, paymentMethodId }) => {
    // Stripe integration
  }
}));
```

#### 4.3 Order Tools
```typescript
tools.set('orders.create_from_cart', createTool('orders.create_from_cart', {...}));
tools.set('orders.cancel', createTool('orders.cancel', {...}));
```

---

### 🔲 Phase 5: GenUI Components (Week 4)

#### 5.1 shadcn/ui Setup
```bash
# Install shadcn/ui
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add card button drawer dialog form
```

#### 5.2 GenUI Components
```typescript
// lib/genui/product-grid.tsx
export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {products.map(p => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

// lib/genui/cart-drawer.tsx
export function CartDrawer({ cart, onUpdate }: CartDrawerProps) {
  // shadcn Drawer with cart items
}

// lib/genui/checkout-wizard.tsx
export function CheckoutWizard({ checkout }: CheckoutWizardProps) {
  // Multi-step checkout wizard
}
```

#### 5.3 CopilotAction Integration
```typescript
// app/api/chat/route.ts
import { CopilotRuntime } from '@copilotkit/runtime';

const runtime = new CopilotRuntime({
  actions: [
    {
      name: 'addToCart',
      description: 'Add product to cart',
      parameters: z.object({ productId: z.number(), quantity: z.number() }),
      handler: async ({ productId, quantity }) => {
        // Add to cart logic
      }
    }
  ]
});
```

---

### 🔲 Phase 6: Observability & Evaluation (Week 5)

#### 6.1 Langfuse Tracing
```typescript
// lib/observability/rag-trace.ts (already created)
export async function traceRAGPipeline(query: string, fn: Function) {
  const trace = langfuse.trace({ name: 'rag_pipeline' });
  
  const spans = {
    queryTransform: trace.span({ name: 'query_transform' }),
    retrieval: trace.span({ name: 'retrieval' }),
    rerank: trace.span({ name: 'rerank' }),
    generation: trace.span({ name: 'generation' }),
  };
  
  // Execute and trace
  const result = await fn();
  
  // End spans
  Object.values(spans).forEach(span => span.end());
  
  return result;
}
```

#### 6.2 LLM-as-Judge
```python
# lib/observability/llm-judge.py (already created)
from langchain.evaluation import load_evaluator

def evaluate_faithfulness(query, context, response):
    evaluator = load_evaluator("labeled_score_string", criteria="faithfulness")
    result = evaluator.evaluate_strings(
        prediction=response,
        reference=context,
        input=query,
    )
    return result.score
```

#### 6.3 RAGAS Integration
```python
# scripts/llm_eval.py (already created)
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy

def evaluate_rag_pipeline(dataset):
    return evaluate(dataset, metrics=[faithfulness, answer_relevancy])
```

---

### 🔲 Phase 7: Deployment (Week 6)

#### 7.1 Azure Container Apps
```bash
# Deploy using docker-compose
az containerapp compose create \
  --compose-file-path docker-compose.yml \
  --resource-group smart-commerce \
  --environment smart-commerce-env
```

#### 7.2 Documentation
- Update `README.md` with new architecture
- Create `DEPLOYMENT.md` guide
- Create `GUARDRAILS.md` documentation

---

## Updated Task List

| Phase | Tasks | Status | ETA |
|-------|-------|--------|-----|
| **Phase 1** | Infrastructure | ✅ Complete | Done |
| **Phase 2** | RAG Core | ✅ Complete | Done |
| **Phase 3** | Guardrails (LangChain/Pydantic/DSPy) | 🔲 Pending | 3-4 days |
| **Phase 4** | MCP Tools | 🔲 Pending | 3-4 days |
| **Phase 5** | GenUI Components | 🔲 Pending | 5-6 days |
| **Phase 6** | Observability | 🔲 Pending | 3-4 days |
| **Phase 7** | Deployment | 🔲 Pending | 2 days |

**Total Remaining**: ~20-24 days of work

---

## Immediate Next Steps

1. **Phase 3: Guardrails** (Start Today)
   - Create Pydantic schemas
   - Implement LangChain guard chains
   - Add DSPy signatures
   - Integrate with LangGraph nodes
   - Write tests

2. **Phase 4: MCP Tools** (After Guardrails)
   - Complete cart tools
   - Add checkout tool
   - Add order tools

3. **Phase 5: GenUI** (After MCP Tools)
   - Install shadcn/ui
   - Build components
   - Wire CopilotAction

---

**Ready to proceed with Phase 3: Guardrails using LangChain + Pydantic + DSPy?**
