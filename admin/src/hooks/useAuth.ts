import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export const useSession = () =>
  useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const res = await api.get('/admin/session')
      return res.data
    },
    retry: false,
  })

export const useLogin = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { username: string; password: string }) => {
      const res = await api.post('/admin/login', payload)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session'] })
    },
  })
}

export const useLogout = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await api.post('/admin/logout')
      return res.data
    },
    onSuccess: () => {
      qc.clear()
    },
  })
}


