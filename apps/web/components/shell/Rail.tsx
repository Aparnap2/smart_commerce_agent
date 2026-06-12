'use client'

import React, { useEffect, useState } from 'react'
import { MessageSquare, Plus, Settings, ChevronLeft } from 'lucide-react'

function getTokenPayload() {
  try {
    const token = document.cookie.split('token=')[1]?.split(';')[0]
    if (!token) return null
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

/**
 * Rail Component - Sidebar navigation panel
 */
export const Rail: React.FC = () => {
    const [session, setSession] = useState<any>(null)
    
    useEffect(() => {
      const payload = getTokenPayload()
      setSession(payload ? { user: payload } : null)
    }, [])
    
    return (
        <div data-testid="shell-rail" className="rail flex flex-col h-full w-[260px] lg:w-[260px] md:w-[64px]">
            {/* Brand / Toggle */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
                <h2 className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 overflow-hidden whitespace-nowrap">
                    <div className="w-8 h-8 rounded bg-emerald-600 flex items-center justify-center shrink-0">
                        <span className="text-white text-xs">SP</span>
                    </div>
                    <span className="text-lg hidden md:block lg:block">SupportPilot</span>
                </h2>
                <button className="hidden md:block lg:block p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md text-gray-400 shrink-0">
                    <ChevronLeft size={18} />
                </button>
            </div>

            {/* New Chat Button */}
            <div className="p-4 shrink-0">
                <button className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm shrink-0">
                    <Plus size={18} className="shrink-0" />
                    <span className="hidden md:block lg:block whitespace-nowrap">New thread</span>
                </button>
            </div>

            {/* Thread History */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thin-dark px-2 space-y-1 py-2 min-h-0">
                <div className="px-3 mb-2 hidden md:block lg:block shrink-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Recent Threads</p>
                </div>
                <button className="w-full flex items-center gap-3 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm font-medium transition-colors">
                    <MessageSquare size={18} className="shrink-0" />
                    <span className="truncate hidden md:block lg:block">Support case inquiries</span>
                </button>
            </div>

            {/* Context Panel */}
            <div className="mt-auto p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 hidden md:block lg:block">Workspace</p>
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400 hidden md:block lg:block whitespace-nowrap">Support Workspace</span>
                    </div>
                </div>
            </div>

            {/* User / Settings */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
                        <span className="text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                            {session?.user?.name?.[0] || 'U'}
                        </span>
                    </div>
                    <div className="hidden md:flex lg:flex flex-col min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {session?.user?.name || 'Support Agent'}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">{session?.user?.role || 'SUPPORT_AGENT'}</p>
                    </div>
                    <button className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 hidden md:block lg:block shrink-0">
                        <Settings size={18} />
                    </button>
                </div>
            </div>
        </div>
    )
}
