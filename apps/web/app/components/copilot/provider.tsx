/**
 * CopilotKit Provider Wrapper
 *
 * Wraps the application with CopilotKit provider and registers GenUI actions.
 *
 * @file components/copilot/provider.tsx
 */

'use client';

import { CopilotKit } from '@copilotkit/react-core';
import { ReactNode } from 'react';
import { CommerceGenUIActions } from './genui-actions';

interface CopilotProviderProps {
  children: ReactNode;
}

export function CopilotProvider({ children }: CopilotProviderProps) {
  return (
    <CopilotKit
      publicApiKey={process.env.NEXT_PUBLIC_COPILOT_PUBLIC_API_KEY}
      agent="commerce-assistant"
    >
      <CommerceGenUIActions />
      {children}
    </CopilotKit>
  );
}
