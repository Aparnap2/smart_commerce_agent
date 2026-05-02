import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth-options'
import type { ReactNode } from 'react'

export default async function AdminLayout({
  children
}: { children: ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  if (session.user.role !== 'MERCHANT') {
    redirect('/chat-dashboard')
  }
  return <>{children}</>
}
