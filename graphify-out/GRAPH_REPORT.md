# Graph Report - .  (2026-05-01)

## Corpus Check
- Large corpus: 505 files · ~374,018 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 1264 nodes · 1584 edges · 55 communities detected
- Extraction: 76% EXTRACTED · 24% INFERRED · 0% AMBIGUOUS · INFERRED: 383 edges (avg confidence: 0.74)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Web App Core & GenUI|Web App Core & GenUI]]
- [[_COMMUNITY_Agent Core Python|Agent Core Python]]
- [[_COMMUNITY_Auth & Guardrails|Auth & Guardrails]]
- [[_COMMUNITY_Agent Evals & DB|Agent Evals & DB]]
- [[_COMMUNITY_Architecture & Design Docs|Architecture & Design Docs]]
- [[_COMMUNITY_LLM Evaluation|LLM Evaluation]]
- [[_COMMUNITY_Intent Classification|Intent Classification]]
- [[_COMMUNITY_Agent Core Services|Agent Core Services]]
- [[_COMMUNITY_API Routes & Auth|API Routes & Auth]]
- [[_COMMUNITY_Stripe & Refunds|Stripe & Refunds]]
- [[_COMMUNITY_Search & Safety|Search & Safety]]
- [[_COMMUNITY_LangGraph Graph|LangGraph Graph]]
- [[_COMMUNITY_Auth UI & B2B Tests|Auth UI & B2B Tests]]
- [[_COMMUNITY_MCP & Context|MCP & Context]]
- [[_COMMUNITY_Schema Validation|Schema Validation]]
- [[_COMMUNITY_Commerce Schemas|Commerce Schemas]]
- [[_COMMUNITY_Tool Testing|Tool Testing]]
- [[_COMMUNITY_LLM Provider|LLM Provider]]
- [[_COMMUNITY_Config & Database|Config & Database]]
- [[_COMMUNITY_Agent E2E Testing|Agent E2E Testing]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 203|Community 203]]
- [[_COMMUNITY_Community 204|Community 204]]
- [[_COMMUNITY_Community 205|Community 205]]
- [[_COMMUNITY_Community 206|Community 206]]
- [[_COMMUNITY_Community 207|Community 207]]
- [[_COMMUNITY_Community 208|Community 208]]
- [[_COMMUNITY_Community 209|Community 209]]
- [[_COMMUNITY_Community 257|Community 257]]
- [[_COMMUNITY_Community 258|Community 258]]

## God Nodes (most connected - your core abstractions)
1. `GET()` - 81 edges
2. `POST()` - 33 edges
3. `UCPProtocol` - 24 edges
4. `get_pool()` - 18 edges
5. `make_config()` - 16 edges
6. `SafetyLevel` - 14 edges
7. `IntentType` - 14 edges
8. `ValidatedInput` - 14 edges
9. `GuardrailResult` - 14 edges
10. `LLMJudge` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Approval Workflow` --semantically_similar_to--> `Human-in-the-Loop Refunds`  [INFERRED] [semantically similar]
  PRD.md → docs/adr/adr-001-architecture-decisions.md
- `API Cron Events` --semantically_similar_to--> `Upstash Redis Notification`  [INFERRED] [semantically similar]
  docs/api-reference.md → PRD.md
- `test_health()` --calls--> `GET()`  [INFERRED]
  /home/aparna/Desktop/vercel-ai-sdk/apps/agent-core/test_api.py → /home/aparna/Desktop/vercel-ai-sdk/apps/web/app/api/refunds/webhook/route.ts
- `should_continue()` --calls--> `GET()`  [INFERRED]
  /home/aparna/Desktop/vercel-ai-sdk/apps/agent-core/src/graph.py → /home/aparna/Desktop/vercel-ai-sdk/apps/web/app/api/refunds/webhook/route.ts
- `get_openai_client()` --calls--> `GET()`  [INFERRED]
  /home/aparna/Desktop/vercel-ai-sdk/apps/agent-core/llm/provider.py → /home/aparna/Desktop/vercel-ai-sdk/apps/web/app/api/refunds/webhook/route.ts

## Hyperedges (group relationships)
- **Conversation Flow Pipeline** — intent_classification_router, mcp_tool_pattern, genui_pattern, langfuse_observability [EXTRACTED 0.90]
- **RAG Search Pipeline** — semantic_chunker, cross_encoder_reranker, query_transformation, hybrid_search, semantic_cache [EXTRACTED 0.90]
- **B2B Approval Chain** — purchase_request_workflow, approval_workflow, langgraph_interrupt, rbac_system [EXTRACTED 0.85]

## Communities

### Community 0 - "Web App Core & GenUI"
Cohesion: 0.03
Nodes (57): handleDecide(), getLLMClient(), getLLMConfig(), getLLMInfo(), getLLMModel(), isDevelopment(), validateEnvironment(), generateComprehensiveReport() (+49 more)

### Community 1 - "Agent Core Python"
Cohesion: 0.04
Nodes (36): getUnprocessedEvents(), markEventProcessed(), writeCommerceEvent(), runFinalVerification(), graphql_mutate(), graphql_query(), graphql_handler(), Mock GraphQL Server for E2E Testing Returns sample data for shopping agent queri (+28 more)

### Community 2 - "Auth & Guardrails"
Cohesion: 0.08
Nodes (50): streamAgentResponse(), BaseModel, agent_chat(), ChatRequest, Enum, ErrorCode, TokenPayload, verify_token() (+42 more)

### Community 3 - "Agent Evals & DB"
Cohesion: 0.07
Nodes (30): createLangfuseCallback(), agentNode(), getEvalCasesByTag(), graphInvoke(), addToCartHandler(), buildSystemContext(), getCartHandler(), getOrdersHandler() (+22 more)

### Community 4 - "Architecture & Design Docs"
Cohesion: 0.04
Nodes (52): Agent-First Principle, Agent Tool Checklist, API Agent Proxy, API Cron Events, Approval Workflow, B2B Procurement Pivot, Circuit Breaker Pattern, Cloud-Native Free Tier Architecture (+44 more)

### Community 5 - "LLM Evaluation"
Cohesion: 0.06
Nodes (33): evaluate_with_ragas(), extract_tools_from_response(), LLMJudge, log_scores_to_langfuse(), main(), OllamaEvaluator, Call Ollama API for structured scoring., Use Ollama to evaluate if correct tools were used. (+25 more)

### Community 6 - "Intent Classification"
Cohesion: 0.05
Nodes (26): classify_intent(), keyword_classify(), compile_safety_module(), GroundedResponseSignature, HallucinationCheckSignature, IntentClassificationSignature, IntentModule, DSPy Signatures for Guardrails  DSPy (Declarative Self-improving Language Progra (+18 more)

### Community 7 - "Agent Core Services"
Cohesion: 0.06
Nodes (39): create_agent_notification(), get_pool(), close_pool(), get_pool(), embed_query(), get_embeddings(), ChatMessage, health() (+31 more)

### Community 8 - "API Routes & Auth"
Cohesion: 0.06
Nodes (24): signToken(), call_chat_api(), Call the chat API and return the response., apiRateLimit(), chatRateLimit(), rateLimit(), POST(), generate_token() (+16 more)

### Community 9 - "Stripe & Refunds"
Cohesion: 0.1
Nodes (24): calculateRefundableAmount(), createRefund(), formatAmount(), getPaymentIntent(), getRefund(), getStripeClient(), getStripeConfig(), getWebhookSecret() (+16 more)

### Community 10 - "Search & Safety"
Cohesion: 0.08
Nodes (18): runComprehensiveTests(), arrayToPgVector(), buildProductText(), embedText(), main(), validateEnv(), hybridProductSearch(), checkContentSafety() (+10 more)

### Community 11 - "LangGraph Graph"
Cohesion: 0.1
Nodes (19): AgentState, approval_gate_node(), call_agent(), get_llm(), Pauses the graph after submit_for_approval fires. Resumes when manager calls wit, Route to approval_gate when PR was submitted, else back to agent., route_after_tools(), should_continue() (+11 more)

### Community 12 - "Auth UI & B2B Tests"
Cohesion: 0.1
Nodes (16): createMockResponse(), mockApprovalsResponse(), mockBudgetAlertResponse(), mockBudgetResponse(), mockCatalogResponse(), mockPRDraftResponse(), mockPRSubmittedResponse(), signIn() (+8 more)

### Community 13 - "MCP & Context"
Cohesion: 0.1
Nodes (12): buildSystemContext(), addToCartHandler(), getCartHandler(), initiateReturnHandler(), viewCartHandler(), checkIdempotencyKey(), getProactiveCount(), getUserContext() (+4 more)

### Community 14 - "Schema Validation"
Cohesion: 0.13
Nodes (9): isValidOrder(), isValidProduct(), isValidRefund(), isValidShoppingCart(), isValidSupportTicket(), sanitizeString(), SchemaValidator, toJsonLd() (+1 more)

### Community 15 - "Commerce Schemas"
Cohesion: 0.12
Nodes (16): mapAddressToSchema(), mapAvailability(), mapItemCondition(), mapOrderStatus(), mapOrderToSchema(), mapProductToSchema(), mapRefundMethod(), mapRefundReason() (+8 more)

### Community 16 - "Tool Testing"
Cohesion: 0.13
Nodes (23): make_config(), test_100_percent_used(), test_add_item_blocked_over_budget(), test_category_filter_passed_to_query(), test_create_generates_pr_number(), test_employee_cannot_approve(), test_employee_sees_own_only(), test_invalid_decision() (+15 more)

### Community 17 - "LLM Provider"
Cohesion: 0.13
Nodes (11): BaseChatModel, MockChatModel, Mock LLM Provider for E2E Testing Returns canned responses for testing the UI fl, Mock LLM that returns predefined responses for testing, Generate a mock response based on the input, Async version of _generate, Stream mock response word by word for testing, Return canned response based on input keywords (+3 more)

### Community 18 - "Config & Database"
Cohesion: 0.18
Nodes (12): checkTableExists(), queryDatabase(), cleanupOldPreferences(), consolidateUserPreferences(), generateQueryEmbedding(), getEmbeddingConfig(), getPreferenceStats(), getSimilarPreferences() (+4 more)

### Community 19 - "Agent E2E Testing"
Cohesion: 0.22
Nodes (3): assert_test(), ContextualPrecisionMetric, ToolCorrectnessMetric

### Community 20 - "Community 20"
Cohesion: 0.22
Nodes (5): CircuitBreakerManager, createCircuitBreaker(), createDBCircuitBreaker(), createLLMCircuitBreaker(), wrapWithCircuitBreaker()

### Community 21 - "Community 21"
Cohesion: 0.24
Nodes (11): stream_chat(), _default_serializer(), graph_to_sse(), Converts LangGraph astream() chunks → SSE events.     Emits: messages/partial, c, _serialize_message(), mock_stream_with_ui(), test_emits_custom_ui_event(), test_emits_end_event() (+3 more)

### Community 22 - "Community 22"
Cohesion: 0.2
Nodes (4): mutationResolvers(), queryResolvers(), createMCPRegistry(), createGraphQLSchema()

### Community 23 - "Community 23"
Cohesion: 0.2
Nodes (5): ThemedText(), ThemedView(), useColorScheme(), useTheme(), WebBadge()

### Community 24 - "Community 24"
Cohesion: 0.36
Nodes (8): mockCartStream(), mockErrorStream(), mockMultiTurnStream(), mockOrdersStream(), mockProductSearchStream(), mockReturnStream(), mockThinkingThenEmpty(), sseChunk()

### Community 25 - "Community 25"
Cohesion: 0.38
Nodes (9): generateToolSummary(), summarizeAddToCart(), summarizeConfirmOrder(), summarizeGenericTool(), summarizeGetOrders(), summarizeInitiateReturn(), summarizeMerchantBriefing(), summarizeProcessRefund() (+1 more)

### Community 26 - "Community 26"
Cohesion: 0.25
Nodes (2): NotificationsProvider(), usePRNotifications()

### Community 28 - "Community 28"
Cohesion: 0.48
Nodes (5): formatExecutionTime(), getStatusColor(), getStatusIcon(), getToolDisplayName(), ToolCallEventItem()

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (1): MainActivity

### Community 30 - "Community 30"
Cohesion: 0.6
Nodes (5): calculateAverageScore(), generateLLMResponse(), generateTestPrompt(), runBatchEvaluation(), runEvaluation()

### Community 31 - "Community 31"
Cohesion: 0.33
Nodes (1): AuthError

### Community 32 - "Community 32"
Cohesion: 0.4
Nodes (2): sanitizeHtml(), sanitizeInput()

### Community 33 - "Community 33"
Cohesion: 0.47
Nodes (3): createAssistantMessage(), createUserMessage(), generateMessageId()

### Community 34 - "Community 34"
Cohesion: 0.8
Nodes (4): ollamaRequest(), runTests(), testEmbeddingModel(), testModel()

### Community 35 - "Community 35"
Cohesion: 0.5
Nodes (1): MainApplication

### Community 36 - "Community 36"
Cohesion: 0.67
Nodes (2): handleSend(), queryLLM()

### Community 38 - "Community 38"
Cohesion: 0.5
Nodes (2): OrdersScreen(), useAgentStream()

### Community 39 - "Community 39"
Cohesion: 0.5
Nodes (2): Message(), cn()

### Community 43 - "Community 43"
Cohesion: 0.67
Nodes (1): CommerceError

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (2): handleSend(), if()

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (2): handleKeyDown(), handleSend()

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (2): log(), runTests()

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (2): clearAuthStorage(), getStorage()

### Community 55 - "Community 55"
Cohesion: 0.67
Nodes (1): ToolError

### Community 58 - "Community 58"
Cohesion: 0.67
Nodes (3): Azure AI Foundry Client, Ollama Local LLM (Deprecated), Provider-Agnostic LLM

### Community 59 - "Community 59"
Cohesion: 0.67
Nodes (3): Docker Infrastructure, Monorepo Structure, Prisma ORM

### Community 203 - "Community 203"
Cohesion: 1.0
Nodes (1): Reject high toxicity queries

### Community 204 - "Community 204"
Cohesion: 1.0
Nodes (1): Check query for jailbreak attempts

### Community 205 - "Community 205"
Cohesion: 1.0
Nodes (1): Check if input should be processed

### Community 206 - "Community 206"
Cohesion: 1.0
Nodes (1): Check response for harmful content

### Community 207 - "Community 207"
Cohesion: 1.0
Nodes (1): Ensure low confidence responses are marked as ungrounded

### Community 208 - "Community 208"
Cohesion: 1.0
Nodes (1): Ensure idempotency key is present

### Community 209 - "Community 209"
Cohesion: 1.0
Nodes (1): Check if state is safe to proceed

### Community 257 - "Community 257"
Cohesion: 1.0
Nodes (1): Request Lifecycle

### Community 258 - "Community 258"
Cohesion: 1.0
Nodes (1): API Health Endpoint

## Knowledge Gaps
- **121 isolated node(s):** `Call the chat API and return the response.`, `Call the chat API with streaming and accumulate response.`, `Extract mentioned tools from the AI response.`, `LLM-based evaluator using Ollama models via REST API.`, `Call Ollama API for structured scoring.` (+116 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 26`** (8 nodes): `auth-provider.tsx`, `usePRNotifications.ts`, `AuthProvider()`, `NotificationsProvider()`, `useAuth()`, `useNotifications()`, `useUser()`, `usePRNotifications()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (6 nodes): `MainActivity`, `.createReactActivityDelegate()`, `.getMainComponentName()`, `.invokeDefaultOnBackPressed()`, `.onCreate()`, `MainActivity.kt`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (6 nodes): `rbac.ts`, `AuthError`, `.constructor()`, `hasAnyRole()`, `meetsRoleLevel()`, `requireRole()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (6 nodes): `sanitize.ts`, `sanitizeEmail()`, `sanitizeHtml()`, `sanitizeInput()`, `sanitizeUrl()`, `stripHtml()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (4 nodes): `MainApplication`, `.onConfigurationChanged()`, `.onCreate()`, `MainApplication.kt`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (4 nodes): `handleSend()`, `OrderStatus()`, `queryLLM()`, `llm-genui-demo.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (4 nodes): `orders.tsx`, `useAgentStream.ts`, `OrdersScreen()`, `useAgentStream()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (4 nodes): `Message.tsx`, `utils.ts`, `Message()`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (3 nodes): `CommerceError`, `.constructor()`, `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (3 nodes): `page.tsx`, `handleSend()`, `if()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (3 nodes): `InputBar.tsx`, `handleKeyDown()`, `handleSend()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (3 nodes): `security-check.js`, `log()`, `runTests()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (3 nodes): `store.ts`, `clearAuthStorage()`, `getStorage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (3 nodes): `types.ts`, `ToolError`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 203`** (1 nodes): `Reject high toxicity queries`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 204`** (1 nodes): `Check query for jailbreak attempts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 205`** (1 nodes): `Check if input should be processed`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 206`** (1 nodes): `Check response for harmful content`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 207`** (1 nodes): `Ensure low confidence responses are marked as ungrounded`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 208`** (1 nodes): `Ensure idempotency key is present`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 209`** (1 nodes): `Check if state is safe to proceed`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 257`** (1 nodes): `Request Lifecycle`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 258`** (1 nodes): `API Health Endpoint`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GET()` connect `Agent Core Python` to `Web App Core & GenUI`, `Auth & Guardrails`, `LLM Evaluation`, `Intent Classification`, `Agent Core Services`, `API Routes & Auth`, `LangGraph Graph`, `Auth UI & B2B Tests`, `MCP & Context`, `LLM Provider`, `Community 20`, `Community 21`, `Community 22`?**
  _High betweenness centrality (0.221) - this node is a cross-community bridge._
- **Why does `POST()` connect `API Routes & Auth` to `Web App Core & GenUI`, `Agent Core Python`, `LLM Evaluation`, `Stripe & Refunds`, `Community 22`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **Why does `runFinalVerification()` connect `Agent Core Python` to `Web App Core & GenUI`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Are the 71 inferred relationships involving `GET()` (e.g. with `runFinalVerification()` and `stream_chat_api()`) actually correct?**
  _`GET()` has 71 INFERRED edges - model-reasoned connections that need verification._
- **Are the 18 inferred relationships involving `POST()` (e.g. with `call_chat_api()` and `.call_ollama()`) actually correct?**
  _`POST()` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Are the 17 inferred relationships involving `get_pool()` (e.g. with `test_create_notification_writes_to_db()` and `test_asyncpg_pool_creation()`) actually correct?**
  _`get_pool()` has 17 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Call the chat API and return the response.`, `Call the chat API with streaming and accumulate response.`, `Extract mentioned tools from the AI response.` to the rest of the system?**
  _121 weakly-connected nodes found - possible documentation gaps or missing edges._