import type { ReactNode } from 'react'

export const ErrorText = ({ children }: { children: ReactNode }) => (
  <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-xs leading-relaxed text-danger">
    {children}
  </p>
)
