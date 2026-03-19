import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from '../hooks/useAuth'

export const Protected = ({ children }: PropsWithChildren) => {
  const { data, isLoading } = useSession()
  const location = useLocation()

  if (isLoading) return null
  if (!data?.authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <>{children}</>
}


