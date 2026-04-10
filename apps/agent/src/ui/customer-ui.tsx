// Customer-facing GenUI component registry
// Keys MUST match name in ui.push() calls exactly

const CustomerComponentMap = {
  'product-grid': () => null,
  'cart-canvas': () => null,
  'order-card': () => null,
  'return-card': () => null,
  'action-confirm': () => null,
  'agent-thinking': () => null,
}

export default CustomerComponentMap
