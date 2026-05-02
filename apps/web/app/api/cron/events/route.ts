import { NextResponse } from 'next/server'
import { checkCartAbandonment, checkLowStock } from '@/lib/events/triggers'
import { getUnprocessedEvents, markEventProcessed } from '@/lib/events/commerce'

export async function GET(request: Request) {
  const secret = request.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    await Promise.all([
      checkCartAbandonment(),
      checkLowStock(),
    ])

    const events = await getUnprocessedEvents()
    let processed = 0

    for (const event of events) {
      try {
        await markEventProcessed(event.id)
        processed++
      } catch (err) {
        console.error(`[cron] failed to process event ${event.id}:`, err)
      }
    }

    return NextResponse.json({ ok: true, processed })
  } catch (err) {
    console.error('[cron] error:', err)
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    )
  }
}
