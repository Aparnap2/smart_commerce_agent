// apps/agent/src/tools/handlers-bridge.ts
// Bridge: imports handlers from web app into agent process

export {
  searchProductsHandler,
  addToCartHandler,
  viewCartHandler,
  getOrdersHandler,
  initiateReturnHandler,
  trackOrderHandler,
} from '../../../web/lib/mcp/handlers.js'
