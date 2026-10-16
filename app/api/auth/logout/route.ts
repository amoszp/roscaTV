import { NextResponse } from 'next/server'
import { AccountsUnavailable, clearSessionCookie, forgetToken, logout, readToken } from '@/lib/server/accounts'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const token = readToken(req)
  if (token) {
    forgetToken(token)
    try {
      await logout(token)
    } catch (err) {
      if (!(err instanceof AccountsUnavailable)) throw err
    }
  }
  const res = new NextResponse(null, { status: 204 })
  clearSessionCookie(res)
  return res
}
