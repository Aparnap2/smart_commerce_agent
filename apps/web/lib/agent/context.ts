import { prisma } from '@/lib/db/client'
import { getUserContext } from '@/lib/redis/memory'

export async function buildSystemContext(
  userId: string
): Promise<string> {
  const parts: string[] = []

  try {
    const [context, prs, lastPR] = await Promise.allSettled([
      getUserContext(userId),
      prisma.purchaseRequest.findMany({
        where: { requestedBy: userId },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.purchaseRequest.findFirst({
        where: { requestedBy: userId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, total: true },
      }),
    ])

    if (context.status === 'fulfilled' && context.value?.lastSearch) {
      parts.push(`User last searched for: "${context.value.lastSearch}"`)
    }

    if (prs.status === 'fulfilled' && prs.value) {
      const draftCount = prs.value.filter(pr => pr.status === 'DRAFT').length
      const pendingCount = prs.value.filter(pr => pr.status === 'PENDING').length
      if (draftCount > 0 || pendingCount > 0) {
        parts.push(`You have ${draftCount} draft PR(s), ${pendingCount} pending approval`)
      }
    }

    if (lastPR.status === 'fulfilled' && lastPR.value) {
      const pr = lastPR.value
      parts.push(`Last PR #${pr.id} is ${pr.status} (₹${pr.total?.toLocaleString('en-IN')})`)
    }
  } catch {
    return ''
  }

  return parts.join('. ')
}

export function compactToolResult(
  toolName: string,
  result: unknown
): string {
  const MAX = 200

  try {
    if (toolName === 'search_catalog') {
      const items = result as Array<{ name?: string; price?: number }>
      if (!items || items.length === 0) return 'No catalog items found.'
      const top = items[0]
      const summary = `Found ${items.length} item(s). Top: ${top.name} at ₹${top.price?.toLocaleString('en-IN')}.`
      return summary.slice(0, MAX)
    }

    if (toolName === 'manage_purchase_request' || toolName === 'view_pr') {
      const pr = result as { lineItems?: Array<unknown>; total?: number }
      const count = pr?.lineItems?.length ?? 0
      const total = pr?.total ?? 0
      return `PR updated. ${count} item(s). Total: ₹${total.toLocaleString('en-IN')}.`.slice(0, MAX)
    }

    if (toolName === 'get_purchase_requests') {
      const prs = result as Array<{ id?: number; status?: string; total?: number }>
      if (!prs || prs.length === 0) return 'No purchase requests found.'
      const latest = prs[0]
      return `${prs.length} PR(s). Latest: #${latest.id} — ${latest.status} (₹${latest.total?.toLocaleString('en-IN')}).`.slice(0, MAX)
    }

    if (toolName === 'raise_dispute') {
      const dispute = result as { prId?: number }
      return `Dispute raised for PR #${dispute.prId}.`.slice(0, MAX)
    }

    if (toolName === 'get_budget_status') {
      const budget = result as { spent?: number; total?: number }
      const remaining = (budget?.total ?? 0) - (budget?.spent ?? 0)
      return `Budget: ₹${budget?.spent?.toLocaleString('en-IN')} spent of ₹${budget?.total?.toLocaleString('en-IN')} (₹${remaining.toLocaleString('en-IN')} remaining).`.slice(0, MAX)
    }

    const str = JSON.stringify(result)
    return str.slice(0, MAX)
  } catch {
    return 'Tool completed.'
  }
}