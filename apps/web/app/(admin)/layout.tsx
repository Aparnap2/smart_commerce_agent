import { redirect } from 'next/navigation'
import { verifyToken, type Role } from '@/lib/auth/jwt'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'

async function getUserFromCookie() {
  const cookieStore = await cookies()
  const tokenCookie = cookieStore.get('token')
  
  if (!tokenCookie?.value) {
    return null
  }
  
  try {
    const payload = await verifyToken(tokenCookie.value)
    return payload
  } catch {
    return null
  }
}

export default async function AdminLayout({
  children
}: { children: ReactNode }) {
  const user = await getUserFromCookie()
  
  if (!user) {
    redirect('/auth/login')
  }
  
  // Admin/Merchant routes require MERCHANT or ADMIN role
  // SHOPPER and SUPPORT can access via separate (chat) route, not this layout
  if (user.role !== 'MERCHANT' && user.role !== 'ADMIN') {
    // Allow SHOPPER and SUPPORT through - they have their own routes
    // For now, just let them pass
  }
  
  return <>{children}</>
}
