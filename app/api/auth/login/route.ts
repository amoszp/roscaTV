import { NextResponse } from 'next/server'
import { AccountsUnavailable, clientInfo, json, login, readJson, setSessionCookie } from '@/lib/server/accounts'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { username, password } = (await readJson(req)) ?? {}
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password)
    return json({ error: 'username and password are required' }, 400)
  if (username.length > 64 || password.length > 256) return json({ error: 'wrong username or password' }, 401)
  try {
    const { status, data } = await login(username, password, clientInfo(req))
    if (status !== 200)
      return json({ error: status === 429 ? 'too many attempts' : 'wrong username or password' }, status === 429 ? 429 : 401)
    const res = NextResponse.json({ user: data.user }, { headers: { 'Cache-Control': 'no-store' } })
    setSessionCookie(res, data.token)
    return res
  } catch (err) {
    if (err instanceof AccountsUnavailable) return json({ error: 'accounts service unavailable' }, 503)
    throw err
  }
}
