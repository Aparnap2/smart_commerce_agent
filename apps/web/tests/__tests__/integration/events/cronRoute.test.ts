import { describe, it, expect } from 'vitest'

describe('GET /api/cron/events', () => {
  it('returns 401 when CRON_SECRET header is missing', async () => {
    const { GET } = await import('@/app/api/cron/events/route')
    const request = new Request(
      'http://localhost:3000/api/cron/events',
      { method: 'GET' }
    )
    const response = await GET(request)
    expect(response.status).toBe(401)
  })

  it('returns 401 when CRON_SECRET header is wrong', async () => {
    process.env.CRON_SECRET = 'correct-secret'
    const { GET } = await import('@/app/api/cron/events/route')
    const request = new Request(
      'http://localhost:3000/api/cron/events',
      {
        method: 'GET',
        headers: { 'x-cron-secret': 'wrong-secret' }
      }
    )
    const response = await GET(request)
    expect(response.status).toBe(401)
  })

  it('returns 200 with processed count when secret is correct', async () => {
    process.env.CRON_SECRET = 'correct-secret'
    const { GET } = await import('@/app/api/cron/events/route')
    const request = new Request(
      'http://localhost:3000/api/cron/events',
      {
        method: 'GET',
        headers: { 'x-cron-secret': 'correct-secret' }
      }
    )
    const response = await GET(request)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toHaveProperty('processed')
    expect(typeof body.processed).toBe('number')
    expect(body).toHaveProperty('ok', true)
  })
})
