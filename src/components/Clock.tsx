import { useEffect, useState } from 'react'
import type { UserPreferences } from '../lib/types'

function greeting(hour: number) {
  if (hour < 5) return 'Good evening'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function Clock({ preferences }: { preferences: UserPreferences }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    // Update at the next minute boundary and stop the timer while hidden.
    let timer: ReturnType<typeof setTimeout> | undefined
    const update = () => {
      if (timer) clearTimeout(timer)
      if (document.hidden) return
      const date = new Date()
      setNow(date)
      const period = preferences.showSeconds ? 1000 : 60_000
      timer = setTimeout(update, period - (date.getTime() % period) + 20)
    }
    document.addEventListener('visibilitychange', update)
    update()
    return () => { if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', update) }
  }, [preferences.showSeconds])
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', ...(preferences.showSeconds ? { second: '2-digit' as const } : {}), hour12: preferences.clockFormat === '12h' }).format(now)
  const date = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(now)
  return <section className="clock" aria-label="Local time and date">
    <div className="date-line"><span className="date-dot" />{date}</div>
    <div className="clock-time">{time}</div>
    {preferences.greetingEnabled && <h1>{greeting(now.getHours())}{preferences.displayName.trim() ? `, ${preferences.displayName.trim()}` : ''}<span className="greeting-period">.</span></h1>}
    <p className="clock-subtitle">Make space for what matters.</p>
  </section>
}
