'use client';

import React from 'react';

interface ShellProps {
    children: React.ReactNode;
    rail: React.ReactNode;
}

/**
 * Shell Component - Main application layout container
 * 
 * Provides the primary grid layout for the application:
 * - Desktop: 260px rail + 1fr content
 * - Tablet (≤1279px): 64px rail + 1fr content
 * - Mobile (≤767px): Full width content, rail hidden
 * 
 * Uses 100dvh for proper mobile viewport height handling
 * with 100vh as fallback.
 * 
 * @example
 * ```tsx
 * <Shell rail={<Rail />}>
 *   <Header />
 *   <ChatCanvas />
 *   <InputBar />
 * </Shell>
 * ```
 */
export const Shell: React.FC<ShellProps> = ({ children, rail }) => {
    return (
        <div className="shell min-h-screen bg-gray-50 dark:bg-gray-950">
            <aside className="rail rail-dark flex flex-col overflow-hidden">
                {rail}
            </aside>
            <main className="flex flex-col overflow-hidden relative">
                {children}
            </main>
        </div>
    );
};
