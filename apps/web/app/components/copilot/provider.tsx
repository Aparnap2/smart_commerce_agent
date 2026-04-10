// TODO: Phase 9B — CopilotKit removed, will be replaced with ai/rsc <AI> provider
import { ReactNode } from 'react';

interface CopilotProviderProps {
  children: ReactNode;
}

export function CopilotProvider({ children }: CopilotProviderProps) {
  return <>{children}</>;
}
