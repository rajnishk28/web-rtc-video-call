import { useCallback, useRef, useState } from 'react'
import { api, ApiError } from '../services/api'
import { connectSignaling } from '../services/signaling'
import {
  addLocalTracks,
  createPeerConnection,
  getLocalStream,
  setTrackEnabled,
  stopStream,
} from '../services/webrtc'

export const useVideoCall = () => {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [roomId, setRoomId] = useState('')
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [remoteMuted, setRemoteMuted] = useState(false)
  const [remoteCameraOff, setRemoteCameraOff] = useState(false)

  const socketRef = useRef(null)
  const pcRef = useRef(null)
  const remotePeerIdRef = useRef(null)
  const pendingOutgoingIceRef = useRef([])
  const pendingIncomingIceRef = useRef([])
  const localStreamRef = useRef(null)
  const mutedRef = useRef(false)
  const cameraOffRef = useRef(false)
  const roomIdRef = useRef('')
  const iceServersRef = useRef([])

  const flushOutgoingIce = useCallback((peerId, socket) => {
    for (const candidate of pendingOutgoingIceRef.current) {
      socket.emit('ice-candidate', { to: peerId, candidate })
    }
    pendingOutgoingIceRef.current = []
  }, [])

  const flushIncomingIce = useCallback(async (pc) => {
    for (const candidate of pendingIncomingIceRef.current) {
      try {
        await pc.addIceCandidate(candidate)
      } catch {
        // Candidate may be invalid after a renegotiation; skip it.
      }
    }
    pendingIncomingIceRef.current = []
  }, [])

  const teardown = useCallback(() => {
    const socket = socketRef.current
    if (socket) {
      if (roomIdRef.current) socket.emit('leave-room', roomIdRef.current)
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }

    pcRef.current?.close()
    pcRef.current = null

    stopStream(localStreamRef.current)
    localStreamRef.current = null
    setLocalStream(null)
    setRemoteStream(null)
    setRemoteMuted(false)
    setRemoteCameraOff(false)

    remotePeerIdRef.current = null
    pendingOutgoingIceRef.current = []
    pendingIncomingIceRef.current = []
    iceServersRef.current = []
    roomIdRef.current = ''
    setMuted(false)
    setCameraOff(false)
    mutedRef.current = false
    cameraOffRef.current = false
  }, [])

  const joinRoom = useCallback(
    async (rawRoomId) => {
      const nextRoomId = rawRoomId.trim()
      if (!nextRoomId) {
        setError('Enter a room name to start a call.')
        setStatus('error')
        return
      }

      teardown()
      setError(null)
      setStatus('connecting')
      roomIdRef.current = nextRoomId
      setRoomId(nextRoomId)

      try {
        const [iceServers, stream] = await Promise.all([
          api.iceServers.get(),
          getLocalStream(),
        ])

        iceServersRef.current = iceServers
        localStreamRef.current = stream
        setLocalStream(stream)

        const socket = connectSignaling()
        socketRef.current = socket

        const bindPeerConnection = () => {
          const nextPc = createPeerConnection(iceServersRef.current, {
            onIceCandidate: (candidate) => {
              const peerId = remotePeerIdRef.current
              if (!peerId) {
                pendingOutgoingIceRef.current.push(candidate.toJSON())
                return
              }
              socket.emit('ice-candidate', {
                to: peerId,
                candidate: candidate.toJSON(),
              })
            },
            onRemoteTrack: (remote) => {
              setRemoteStream(remote)
              setStatus('connected')
            },
            onConnectionState: (state) => {
              if (state === 'failed') {
                setError('The peer connection failed. Try joining again.')
                setStatus('error')
              }
            },
          })
          if (localStreamRef.current) {
            addLocalTracks(nextPc, localStreamRef.current)
          }
          pcRef.current = nextPc
          return nextPc
        }

        bindPeerConnection()

        const rememberPeer = (peerId) => {
          remotePeerIdRef.current = peerId
          flushOutgoingIce(peerId, socket)
        }

        const sendPeerState = () => {
          const peerId = remotePeerIdRef.current
          if (!peerId) return
          socket.emit('peer-state', {
            to: peerId,
            muted: mutedRef.current,
            cameraOff: cameraOffRef.current,
          })
        }

        socket.on('created', () => {
          setStatus('waiting')
        })

        socket.on('joined', () => {
          setStatus('waiting')
        })

        socket.on('ready', (payload) => {
          const peerId = payload.peers.find((id) => id !== socket.id)
          if (peerId) {
            rememberPeer(peerId)
            sendPeerState()
          }
        })

        socket.on('peer-joined', async ({ peerId }) => {
          rememberPeer(peerId)
          sendPeerState()
          const currentPc =
            pcRef.current && pcRef.current.signalingState !== 'closed'
              ? pcRef.current
              : bindPeerConnection()
          const offer = await currentPc.createOffer()
          await currentPc.setLocalDescription(offer)
          socket.emit('offer', {
            to: peerId,
            description: currentPc.localDescription,
          })
        })

        socket.on('offer', async ({ from, description }) => {
          rememberPeer(from)
          const currentPc = pcRef.current ?? bindPeerConnection()
          await currentPc.setRemoteDescription(description)
          await flushIncomingIce(currentPc)
          const answer = await currentPc.createAnswer()
          await currentPc.setLocalDescription(answer)
          socket.emit('answer', {
            to: from,
            description: currentPc.localDescription,
          })
        })

        socket.on('answer', async ({ description }) => {
          const currentPc = pcRef.current
          if (!currentPc) return
          await currentPc.setRemoteDescription(description)
          await flushIncomingIce(currentPc)
        })

        socket.on(
          'ice-candidate',
          async ({ candidate }) => {
            const currentPc = pcRef.current
            if (!currentPc || !currentPc.remoteDescription) {
              pendingIncomingIceRef.current.push(candidate)
              return
            }
            await currentPc.addIceCandidate(candidate)
          }
        )

        socket.on('peer-state', ({ muted: peerMuted, cameraOff: peerCameraOff }) => {
          if (typeof peerMuted === 'boolean') setRemoteMuted(peerMuted)
          if (typeof peerCameraOff === 'boolean') setRemoteCameraOff(peerCameraOff)
        })

        socket.on('room-full', () => {
          setError('That room already has two people.')
          setStatus('error')
          teardown()
        })

        socket.on('peer-left', () => {
          setRemoteStream(null)
          setRemoteMuted(false)
          setRemoteCameraOff(false)
          setStatus('waiting')
          remotePeerIdRef.current = null
          pendingOutgoingIceRef.current = []
          pendingIncomingIceRef.current = []
          pcRef.current?.close()
          bindPeerConnection()
        })

        socket.on('connect_error', () => {
          setError('Could not reach the signaling server.')
          setStatus('error')
          teardown()
        })

        socket.emit('create-or-join', nextRoomId)
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Could not start the call.'
        const denied =
          err instanceof DOMException &&
          (err.name === 'NotAllowedError' || err.name === 'NotFoundError')
        setError(
          denied
            ? 'Camera and microphone permission is required for the call.'
            : message
        )
        setStatus('error')
        teardown()
      }
    },
    [flushIncomingIce, flushOutgoingIce, teardown]
  )

  const leaveRoom = useCallback(() => {
    teardown()
    setStatus('idle')
    setError(null)
    setRoomId('')
  }, [teardown])

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current
      setTrackEnabled(localStreamRef.current, 'audio', !next)
      mutedRef.current = next
      const socket = socketRef.current
      const peerId = remotePeerIdRef.current
      if (socket && peerId) {
        socket.emit('peer-state', { to: peerId, muted: next, cameraOff: cameraOffRef.current })
      }
      return next
    })
  }, [])

  const toggleCamera = useCallback(() => {
    setCameraOff((current) => {
      const next = !current
      setTrackEnabled(localStreamRef.current, 'video', !next)
      cameraOffRef.current = next
      const socket = socketRef.current
      const peerId = remotePeerIdRef.current
      if (socket && peerId) {
        socket.emit('peer-state', { to: peerId, muted: mutedRef.current, cameraOff: next })
      }
      return next
    })
  }, [])

  return {
    status,
    error,
    roomId,
    localStream,
    remoteStream,
    muted,
    cameraOff,
    remoteMuted,
    remoteCameraOff,
    joinRoom,
    leaveRoom,
    toggleMute,
    toggleCamera,
  }
}
