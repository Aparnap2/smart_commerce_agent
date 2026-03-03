/**
 * Logout Button Component
 *
 * A button that signs out the user and redirects to login page.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/create-client';
import { LogOut, Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface LogoutButtonProps {
  /** Show icon next to button text */
  showIcon?: boolean;
  /** Button text */
  children?: ReactNode;
  /** Callback after successful logout */
  onLogoutSuccess?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

export function LogoutButton({
  showIcon = true,
  children = 'Sign Out',
  onLogoutSuccess,
  className = '',
  disabled,
  ...props
}: LogoutButtonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (loading) return;

    setLoading(true);

    try {
      const { error } = await createClient().auth.signOut();

      if (error) {
        console.error('Logout error:', error.message);
        // Still redirect to login even if there's an error
      }

      // Call success callback if provided
      onLogoutSuccess?.();

      // Redirect to login page
      router.push('/auth/login');
      router.refresh();
    } catch (err) {
      console.error('Unexpected logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading || disabled}
      className={`
        flex items-center gap-2 px-3 py-2
        text-gray-600 dark:text-gray-400
        hover:bg-gray-100 dark:hover:bg-gray-700
        hover:text-gray-900 dark:hover:text-white
        rounded-lg transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        showIcon && <LogOut className="w-5 h-5" />
      )}
      {children}
    </button>
  );
}

/**
 * Compact logout icon button - for use in headers, dropdowns, etc.
 */
export function LogoutIconButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (loading) return;

    setLoading(true);

    try {
      await createClient().auth.signOut();
      router.push('/auth/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={`
        p-2 rounded-lg
        text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
        hover:bg-gray-100 dark:hover:bg-gray-700
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      title="Sign out"
      {...props}
    >
      {loading ? (
        <LogOut className="w-5 h-5 animate-spin" />
      ) : (
        <LogOut className="w-5 h-5" />
      )}
    </button>
  );
}
