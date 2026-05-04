// Expo Push notification service

export interface PushPayload {
  token: string
  title: string
  body: string
  data?: Record<string, unknown>
}

export async function sendExpoPush({ token, title, body, data = {} }: PushPayload) {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: token,
      title,
      body,
      data,
      sound: 'default',
      priority: 'high',
    }),
  })
  
  const json = await res.json()
  if (json.data?.status === 'error') {
    console.error('[expo-push] error:', json.data.message)
  }
  return json
}