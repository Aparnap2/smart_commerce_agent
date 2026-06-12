/**
 * Auth Module Exports
 */

export { useAuthStore } from './store.js';
export type { User } from './store.js';

// RBAC — procurement + support roles
export { checkRouteAccess, checkSupportRouteAccess, requireRole, hasAnyRole } from './rbac';
export type { SupportRole } from './rbac';

// JWT types
export type { Role, B2BRole, AppRole, TokenPayload } from './jwt';
