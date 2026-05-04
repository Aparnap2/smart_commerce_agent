'use client';

import React from 'react';
import { MessageSquare, Plus, ShoppingCart, Package, Settings, ChevronLeft } from 'lucide-react';
import { useSession } from 'next-auth/react';

/**
 * Rail Component - Sidebar navigation panel
 *
 * Provides persistent navigation and context:
 * - Desktop (≥1280px): Full 260px width with labels
 * - Tablet (768px-1279px): Collapsed 64px width, icons only
 * - Mobile (≤767px): Hidden via CSS media query
 *
 * @example
 * ```tsx
 * <Shell rail={<Rail />}>
 *   {/* main content *}/}
 * </Shell>
 * ```
 */
export const Rail: React.FC = () => {
    const { data: session } = useSession();

    return (
        <div className="rail flex flex-col h-full w-[260px] lg:w-[260px] md:w-[64px]">
            {/* Brand / Toggle */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
                <h2 className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2 overflow-hidden whitespace-nowrap">
                    <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center shrink-0">
                        <span className="text-white text-xs">PA</span>
                    </div>
                    <span className="text-lg hidden md:block lg:block">ProcureAI</span>
                </h2>
                <button className="hidden md:block lg:block p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md text-gray-400 shrink-0">
                    <ChevronLeft size={18} />
                </button>
            </div>

            {/* New Chat Button */}
            <div className="p-4 shrink-0">
                <button className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm shrink-0">
                    <Plus size={18} className="shrink-0" />
                    <span className="hidden md:block lg:block whitespace-nowrap">New thread</span>
                </button>
            </div>

            {/* Thread History */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thin-dark px-2 space-y-1 py-2 min-h-0">
                <div className="px-3 mb-2 hidden md:block lg:block shrink-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Recent Threads</p>
                </div>
                <button className="w-full flex items-center gap-3 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-medium transition-colors">
                    <MessageSquare size={18} className="shrink-0" />
                    <span className="truncate hidden md:block lg:block">Headphones under ₹15k</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg text-sm font-medium transition-colors">
                    <MessageSquare size={18} className="shrink-0" />
                    <span className="truncate hidden md:block lg:block">Order tracking ORD-992</span>
                </button>
            </div>

            {/* Context Panel */}
            <div className="mt-auto p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 hidden md:block lg:block">Live Context</p>
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <ShoppingCart size={14} className="shrink-0" />
                            <span className="hidden md:block lg:block whitespace-nowrap">Cart Total</span>
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white hidden md:block lg:block">₹44,890</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <Package size={14} className="shrink-0" />
                            <span className="hidden md:block lg:block whitespace-nowrap">Last Order</span>
                        </div>
                        <span className="text-green-600 dark:text-green-400 font-medium hidden md:block lg:block">Shipped</span>
                    </div>
                </div>
            </div>

            {/* User / Settings */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0">
                        <span className="text-indigo-700 dark:text-indigo-400 text-xs font-bold">
                            {session?.user?.name?.[0] || 'U'}
                        </span>
                    </div>
                    <div className="hidden md:flex lg:flex flex-col min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {session?.user?.name || 'Aparna'}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">{session?.user?.role || 'Employee'}</p>
                    </div>
                    <button className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 hidden md:block lg:block shrink-0">
                        <Settings size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};
