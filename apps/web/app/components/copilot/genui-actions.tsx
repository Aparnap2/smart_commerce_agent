// TODO: Phase 9B — CopilotKit removed, will be replaced with ai/rsc tools in actions.tsx
interface GenUIActionsProps {
  onAddToCart?: (productId: string, quantity: number) => void;
  onViewDetails?: (id: string) => void;
  onTrackOrder?: (id: string) => void;
  onCheckout?: () => void;
}

export function CommerceGenUIActions({
  onAddToCart,
  onViewDetails,
  onTrackOrder,
  onCheckout,
}: GenUIActionsProps) {
  return null;
}
