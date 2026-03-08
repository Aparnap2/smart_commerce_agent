'use client'

import dynamic from 'next/dynamic'
import type { UIAction } from '@/hooks/useChatStream'

/**
 * GenUI Router - Dynamically loads and renders GenUI components
 * 
 * Maps SSE ui_actions events to the correct component via dynamic imports.
 * Components are lazy-loaded only when the agent sends them.
 */

// Dynamic imports - only loaded when agent sends that component
const ProductGrid = dynamic(
  () => import('./ProductGrid').then((m) => m.ProductGrid),
  { ssr: false }
)

const CartCanvas = dynamic(
  () => import('./CartCanvas').then((m) => m.CartCanvas),
  { ssr: false }
)

const OrderCard = dynamic(
  () => import('./OrderCard').then((m) => m.OrderCard),
  { ssr: false }
)

const ActionConfirm = dynamic(
  () => import('./ActionConfirm').then((m) => m.ActionConfirm),
  { ssr: false }
)

interface Props {
  actions: UIAction[]
}

/**
 * Routes ui_actions to the correct GenUI component
 * 
 * @param actions - Array of UI actions from SSE
 * @returns Rendered GenUI components
 */
export function GenUIRouter({ actions }: Props) {
  return (
    <div className="w-full space-y-3 mt-2">
      {actions.map((action, idx) => {
        switch (action.component) {
          case 'ProductGrid':
            return <ProductGrid key={idx} {...(action.props as Record<string, unknown>)} />
          case 'CartCanvas':
            return <CartCanvas key={idx} {...(action.props as Record<string, unknown>)} />
          case 'OrderCard':
            return <OrderCard key={idx} {...(action.props as Record<string, unknown>)} />
          case 'ActionConfirm':
            return <ActionConfirm key={idx} {...(action.props as Record<string, unknown>)} />
          default:
            console.warn('GenUIRouter: unknown component:', action.component)
            return null
        }
      })}
    </div>
  )
}
