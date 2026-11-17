import { useEffect, useState } from 'react'

const query = () => window.matchMedia('(prefers-color-scheme: dark)')

export const useDarkMode = (fusionTheme: 'light' | 'dark' | null): boolean => {
  const [systemDark, setSystemDark] = useState(() => query().matches)

  useEffect(() => {
    const media = query()
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])

  const dark = fusionTheme ? fusionTheme === 'dark' : systemDark

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return dark
}
