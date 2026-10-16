import dynamic from 'next/dynamic'

// Builds that sync with a server put a sign-in screen in front of the app.
const Entry = dynamic(
  () => (process.env.NEXT_PUBLIC_SERVER_SYNC === '1' ? import('@/components/auth/Root') : import('@/components/App')),
  { ssr: false },
)
export default function Page() { return <Entry /> }
