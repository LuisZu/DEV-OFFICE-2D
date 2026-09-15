import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '../stores/auth.store'

const socketUrl = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000'

let socket: Socket | null = null

// Centralizes the single Socket.IO connection for the whole app (spec section 24) —
// components subscribe/unsubscribe to it, they never call io() themselves.
export function connectOfficeSocket(): Socket {
  if (socket?.connected) {
    return socket
  }

  const { accessToken } = useAuthStore.getState()

  socket = io(`${socketUrl}/office`, {
    auth: { token: accessToken },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  })

  return socket
}

export function disconnectOfficeSocket(): void {
  socket?.disconnect()
  socket = null
}

export function getOfficeSocket(): Socket | null {
  return socket
}
