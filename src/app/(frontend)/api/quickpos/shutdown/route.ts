import { timingSafeEqual } from 'node:crypto'

export const dynamic = 'force-dynamic'

function tokensMatch(actual: string | null, expected: string): boolean {
  if (!actual) return false

  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)

  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  )
}

export async function POST(request: Request) {
  const expectedToken = process.env.QUICKPOS_SHUTDOWN_TOKEN

  if (process.env.QUICKPOS_DESKTOP !== '1' || !expectedToken) {
    return new Response(null, { status: 404 })
  }

  if (!tokensMatch(request.headers.get('x-quickpos-shutdown-token'), expectedToken)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const shutdownTimer = setTimeout(() => process.kill(process.pid, 'SIGTERM'), 250)
  shutdownTimer.unref()

  return Response.json({ app: 'QuickPOS', status: 'stopping' })
}
