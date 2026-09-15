import { useEffect, useState } from 'react'

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => value.toString().padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

// Ticks locally off `startedAt` instead of polling the backend every second
// (spec section 27) — the server remains the source of truth for when the
// activity actually started, this just renders the difference against "now".
export function useElapsedTime(startedAt: string): string {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  return formatElapsed(now - new Date(startedAt).getTime())
}
