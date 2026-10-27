import { api } from './client'
export const iceServersApi = {
  get: async () => {
    const { data } = await api.get('/api/ice-servers')
    return data.iceServers
  },
}
