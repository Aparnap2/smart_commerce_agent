import { Langfuse } from 'langfuse'

if (!process.env.LANGFUSE_PUBLIC_KEY) {
  console.warn(
    '[langfuse] LANGFUSE_PUBLIC_KEY not set — observability disabled'
  )
}

export const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY ?? 'disabled',
  secretKey: process.env.LANGFUSE_SECRET_KEY ?? 'disabled',
  baseUrl: process.env.LANGFUSE_BASE_URL ?? 'http://localhost:3003',
  flushAt: 10,
  flushInterval: 5000,
})

process.on('beforeExit', async () => {
  await langfuse.shutdownAsync()
})

export { Langfuse }
