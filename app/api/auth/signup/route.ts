import { NextResponse } from 'next/server'
import { AccountsUnavailable, clientInfo, json, readJson, setSessionCookie, signup } from '@/lib/server/accounts'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { username, password, displayName } = (await readJson(req)) ?? {}
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password)
    return json({ error: 'username and password are required' }, 400)
  if (username.length > 64 || password.length > 256 || (typeof displayName === 'string' && displayName.length > 80))
    return json({ error: 'too long' }, 400)
  try {
    const { status, data } = await signup(username, password, typeof displayName === 'string' ? displayName : '', clientInfo(req))
    if (status === 201) {
      // New accounts work at once: sign the user straight in.
      const res = NextResponse.json({ user: data.user }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
      setSessionCookie(res, data.token)
      return res
    }
    const code = status === 429 ? 429 : status === 409 ? 409 : 400
    return json({ error: code === 429 ? 'too many sign-ups' : code === 409 ? 'username taken' : data?.message ?? 'invalid' }, code)
  } catch (err) {
    if (err instanceof AccountsUnavailable) return json({ error: 'accounts service unavailable' }, 503)
    throw err
  }
}
