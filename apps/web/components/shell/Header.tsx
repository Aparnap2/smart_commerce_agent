'use client';

import React from 'react';
import { Share2, MoreHorizontal, Search } from 'lucide-react';

interface HeaderProps {
    title?: string;
}

/**
 * Header Component - Sticky top navigation bar
 * 
 * Fixed height (56px) header that sticks to the top of the viewport.
 * Contains page title and action buttons.
 * 
 * Features:
 * - Sticky positioning at top: 0
 * - Fixed height of 56px (h-14)
 * - Backdrop blur for content scrolling underneath
 * - z-index: 10 to stay above content
 * 
 * @param title - Page title displayed in header
 * 
 * @example
 * ```tsx
 * <Header title="New Conversation" />
 * ```
 */
export const Header: React.FC<HeaderProps> = ({ title = "New Conversation" }) => {
    return (
        <header className="header header-dark h-14 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-4">
                <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[200px] md:max-w-md">
                    {title}
                </h1>
            </div>

            <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-1.5 mr-2">
                    <Search size={14} className="text-gray-400 mr-2 shrink-0" />
                    <input
                        type="text"
                        placeholder="Search in thread..."
                        className="bg-transparent text-xs outline-none w-32 text-gray-700 dark:text-gray-300 placeholder-gray-400"
                    />
                </div>
                <button className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors shrink-0" aria-label="Share">
                    <Share2 size={18} />
                </button>
                <button className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors shrink-0" aria-label="More options">
                    <MoreHorizontal size={18} />
                </button>
            </div>
        </header>
    );
};
