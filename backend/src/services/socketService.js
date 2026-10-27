import { Server } from 'socket.io'
import { serverConfig } from '../config/index.js'
import logger from '../utils/logger.js'

let io

// In-memory room state: roomId -> Set<socketId>
const rooms = new Map()
// Reverse index for O(1) cleanup on disconnect: socketId -> roomId
const socketRoom = new Map()

const MAX_PARTICIPANTS = 2

const normalizeRoomId = (roomId) => {
  if (typeof roomId !== 'string') return null
  const id = roomId.trim()
  return id.length > 0 ? id : null
}

const areRoommates = (fromId, toId) => {
  const roomId = socketRoom.get(fromId)
  if (!roomId || typeof toId !== 'string') return false
  const participants = rooms.get(roomId)
  return Boolean(participants && participants.has(toId))
}

/**
 * Remove a socket from the given room, notify any remaining peer(s) that the
 * socket left, and delete the room once it becomes empty.
 * @param {import('socket.io').Socket} socket
 * @param {string} roomId
 */
const removeSocketFromRoom = (socket, roomId) => {
  const participants = rooms.get(roomId)
  if (!participants || !participants.has(socket.id)) return

  participants.delete(socket.id)
  socketRoom.delete(socket.id)

  if (participants.size > 0) {
    for (const peerId of participants) {
      io.to(peerId).emit('peer-left', { peerId: socket.id })
    }
  } else {
    rooms.delete(roomId)
  }
}

const relaySignaling = (event, socket, payload, payloadKey) => {
  if (!payload || typeof payload !== 'object') return

  const { to } = payload
  const value = payload[payloadKey]
  if (typeof to !== 'string' || !to || value === undefined || value === null) {
    return
  }
  if (!areRoommates(socket.id, to)) return

  io.to(to).emit(event, { from: socket.id, [payloadKey]: value })
}

/**
 * Initialize Socket.IO on the existing HTTP server for WebRTC signaling.
 * @param {import('http').Server} httpServer
 * @param {import('express').Express} app - used to expose io via app locals
 */
export const initializeSocket = (httpServer, app) => {
  io = new Server(httpServer, {
    cors: {
      origin: serverConfig.clientOrigin,
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`)

    // --- 1:1 call signaling ------------------------------------------------

    // Create a new room or join an existing one (max 2 participants).
    socket.on('create-or-join', (roomId) => {
      const id = normalizeRoomId(roomId)
      if (!id) return

      const currentRoom = socketRoom.get(socket.id)
      if (currentRoom === id) {
        // Re-entrant join of the same room must not look like a second peer.
        return
      }
      if (currentRoom) {
        removeSocketFromRoom(socket, currentRoom)
        logger.info(`${socket.id} left room ${currentRoom} to join ${id}`)
      }

      let participants = rooms.get(id)

      if (!participants || participants.size === 0) {
        participants = new Set([socket.id])
        rooms.set(id, participants)
        socketRoom.set(socket.id, id)
        socket.emit('created', id)
        logger.info(`Room ${id} created by ${socket.id}`)
        return
      }

      if (participants.size >= MAX_PARTICIPANTS) {
        socket.emit('room-full', id)
        logger.warn(`Room ${id} is full; ${socket.id} rejected`)
        return
      }

      const [existingPeer] = participants
      participants.add(socket.id)
      socketRoom.set(socket.id, id)
      socket.emit('joined', id)
      io.to(existingPeer).emit('peer-joined', { peerId: socket.id })
      socket.emit('ready', { peers: Array.from(participants) })
      logger.info(`${socket.id} joined room ${id}`)
    })

    // Relay an SDP offer to the target peer.
    socket.on('offer', (payload) => {
      relaySignaling('offer', socket, payload, 'description')
    })

    // Relay an SDP answer to the target peer.
    socket.on('answer', (payload) => {
      relaySignaling('answer', socket, payload, 'description')
    })

    // Relay an ICE candidate to the target peer.
    socket.on('ice-candidate', (payload) => {
      relaySignaling('ice-candidate', socket, payload, 'candidate')
    })

    // Share microphone and camera state with the other participant.
    socket.on('peer-state', (payload) => {
      if (!payload || typeof payload !== 'object') return
      const { to, muted, cameraOff } = payload
      if (typeof to !== 'string' || !areRoommates(socket.id, to)) return
      if (typeof muted !== 'boolean' || typeof cameraOff !== 'boolean') return
      io.to(to).emit('peer-state', { from: socket.id, muted, cameraOff })
    })

    // Voluntarily leave a room.
    socket.on('leave-room', (roomId) => {
      const id = normalizeRoomId(roomId) || socketRoom.get(socket.id)
      if (!id) return
      removeSocketFromRoom(socket, id)
      logger.info(`${socket.id} left room ${id}`)
    })

    // Abrupt disconnect: clean up any room the socket was in.
    socket.on('disconnect', () => {
      const currentRoom = socketRoom.get(socket.id)
      if (currentRoom) {
        removeSocketFromRoom(socket, currentRoom)
      }
      logger.info(`Client disconnected: ${socket.id}`)
    })
  })

  // Expose io for use elsewhere in the app
  app.locals.io = io

  return io
}

export const getIo = () => io
