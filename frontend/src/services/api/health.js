import { api } from './client'
export const healthApi = {
  get: async () => {
    const { data } = await api.get('/api/health')
    return data
  },
}
