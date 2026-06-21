import { timingSafeEqual } from 'crypto'

export function checkSecret(authHeader: string | undefined): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const provided = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  } catch {
    return false
  }
}
