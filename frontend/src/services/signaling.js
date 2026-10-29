import { io } from 'socket.io-client'

export const connectSignaling = () =>
  io(import.meta.env.DEV ? undefined : import.meta.env.VITE_API_URL || undefined, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
  })
