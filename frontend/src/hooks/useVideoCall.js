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
  const [localScreenStream, setLocalScreenStream] = useState(null)
  const [remoteScreenStream, setRemoteScreenStream] = useState(null)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [remoteMuted, setRemoteMuted] = useState(false)
  const [remoteCameraOff, setRemoteCameraOff] = useState(false)
  const [cameraFacing, setCameraFacing] = useState('user')
  const [switchingCamera, setSwitchingCamera] = useState(false)
  const [cameraSwitchError, setCameraSwitchError] = useState(null)
  const [screenSharing, setScreenSharing] = useState(false)
  const [screenShareError, setScreenShareError] = useState(null)
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false)

  const socketRef = useRef(null)
  const pcRef = useRef(null)
  const remotePeerIdRef = useRef(null)
  const pendingOutgoingIceRef = useRef([])
  const pendingIncomingIceRef = useRef([])
  const localStreamRef = useRef(null)
  const screenStreamRef = useRef(null)
  const screenSenderRef = useRef(null)
  const screenTransportStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const remoteStreamsRef = useRef(new Map())
  const remoteScreenStreamIdRef = useRef(null)
  const cameraFacingRef = useRef('user')
  const mutedRef = useRef(false)
  const cameraOffRef = useRef(false)
  const screenSharingRef = useRef(false)
  const screenStreamIdRef = useRef(null)
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

  const emitPeerState = useCallback((overrides = {}) => {
    const socket = socketRef.current
    const peerId = remotePeerIdRef.current
    if (!socket || !peerId) return
    socket.emit('peer-state', {
      to: peerId,
      muted: mutedRef.current,
      cameraOff: cameraOffRef.current,
      screenSharing: screenSharingRef.current,
      screenStreamId: screenStreamIdRef.current,
      ...overrides,
    })
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

    stopStream(screenStreamRef.current)
    screenStreamRef.current = null
    screenSenderRef.current = null
    screenTransportStreamRef.current = null
    stopStream(localStreamRef.current)
    localStreamRef.current = null
    setLocalStream(null)
    setRemoteStream(null)
    setLocalScreenStream(null)
    setRemoteScreenStream(null)
    remoteStreamRef.current = null
    remoteStreamsRef.current.clear()
    remoteScreenStreamIdRef.current = null
    setRemoteMuted(false)
    setRemoteCameraOff(false)
    setCameraFacing('user')
    cameraFacingRef.current = 'user'
    setSwitchingCamera(false)
    setCameraSwitchError(null)
    setScreenSharing(false)
    screenSharingRef.current = false
    screenStreamIdRef.current = null
    setScreenShareError(null)
    setRemoteScreenSharing(false)

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
        const activeFacing = stream.getVideoTracks()[0]?.getSettings().facingMode
        if (activeFacing === 'user' || activeFacing === 'environment') {
          cameraFacingRef.current = activeFacing
          setCameraFacing(activeFacing)
        }

        const socket = connectSignaling()
        socketRef.current = socket

        const bindPeerConnection = () => {
          screenSenderRef.current = null
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
              remoteStreamsRef.current.set(remote.id, remote)
              if (remote.id === remoteScreenStreamIdRef.current) {
                setRemoteScreenStream(remote)
              } else if (!remoteStreamRef.current) {
                remoteStreamRef.current = remote
                setRemoteStream(remote)
              }
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
          const activeScreenTrack = screenStreamRef.current?.getVideoTracks()[0]
          if (activeScreenTrack && screenTransportStreamRef.current) {
            screenSenderRef.current = nextPc.addTrack(activeScreenTrack, screenTransportStreamRef.current)
          }
          pcRef.current = nextPc
          return nextPc
        }

        bindPeerConnection()

        const rememberPeer = (peerId) => {
          remotePeerIdRef.current = peerId
          flushOutgoingIce(peerId, socket)
        }

        const sendPeerState = () => emitPeerState()

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

        socket.on('peer-state', ({ muted: peerMuted, cameraOff: peerCameraOff, screenSharing: peerScreenSharing, screenStreamId }) => {
          if (typeof peerMuted === 'boolean') setRemoteMuted(peerMuted)
          if (typeof peerCameraOff === 'boolean') setRemoteCameraOff(peerCameraOff)
          if (typeof peerScreenSharing === 'boolean') {
            setRemoteScreenSharing(peerScreenSharing)
            remoteScreenStreamIdRef.current = peerScreenSharing && typeof screenStreamId === 'string' ? screenStreamId : null
            setRemoteScreenStream(remoteScreenStreamIdRef.current ? remoteStreamsRef.current.get(remoteScreenStreamIdRef.current) ?? null : null)
          }
        })

        socket.on('room-full', () => {
          setError('That room already has two people.')
          setStatus('error')
          teardown()
        })

        socket.on('peer-left', () => {
          setRemoteStream(null)
          remoteStreamRef.current = null
          remoteStreamsRef.current.clear()
          remoteScreenStreamIdRef.current = null
          setRemoteScreenStream(null)
          setRemoteMuted(false)
          setRemoteCameraOff(false)
          setRemoteScreenSharing(false)
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
    [emitPeerState, flushIncomingIce, flushOutgoingIce, teardown]
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
      emitPeerState({ muted: next })
      return next
    })
  }, [emitPeerState])

  const toggleCamera = useCallback(() => {
    setCameraOff((current) => {
      const next = !current
      setTrackEnabled(localStreamRef.current, 'video', !next)
      cameraOffRef.current = next
      emitPeerState({ cameraOff: next })
      return next
    })
  }, [emitPeerState])

  const switchCamera = useCallback(async () => {
    const currentStream = localStreamRef.current
    const currentTrack = currentStream?.getVideoTracks()[0]
    if (!currentStream || !currentTrack || switchingCamera || screenStreamRef.current) return

    const nextFacing = cameraFacingRef.current === 'user' ? 'environment' : 'user'
    let candidateStream
    setSwitchingCamera(true)
    setCameraSwitchError(null)

    try {
      candidateStream = await getLocalStream({
        audio: false,
        video: { facingMode: { exact: nextFacing } },
      })

      if (localStreamRef.current !== currentStream) {
        stopStream(candidateStream)
        return
      }

      const nextTrack = candidateStream.getVideoTracks()[0]
      if (!nextTrack) throw new Error('No video track was provided by the camera.')

      const actualFacing = nextTrack.getSettings().facingMode
      if (actualFacing && actualFacing !== nextFacing) {
        throw new Error(`The ${nextFacing === 'environment' ? 'back' : 'front'} camera is unavailable.`)
      }

      nextTrack.enabled = !cameraOffRef.current
      const nextStream = new MediaStream([...currentStream.getAudioTracks(), nextTrack])
      const sender = pcRef.current?.getSenders().find((item) => item.track?.kind === 'video')

      if (sender) {
        await sender.replaceTrack(nextTrack)
      } else if (pcRef.current) {
        pcRef.current.addTrack(nextTrack, nextStream)
      }

      localStreamRef.current = nextStream
      setLocalStream(nextStream)
      currentTrack.stop()
      cameraFacingRef.current = nextFacing
      setCameraFacing(nextFacing)
    } catch (err) {
      if (candidateStream) stopStream(candidateStream)
      const target = nextFacing === 'environment' ? 'back' : 'front'
      const unavailable = err instanceof DOMException && ['NotFoundError', 'OverconstrainedError'].includes(err.name)
      setCameraSwitchError(unavailable ? `This device does not have an available ${target} camera.` : `Could not switch to the ${target} camera. Check camera permissions and try again.`)
    } finally {
      setSwitchingCamera(false)
    }
  }, [switchingCamera])

  const stopScreenShare = useCallback(async () => {
    const screenStream = screenStreamRef.current
    if (!screenStream) return

    screenStreamRef.current = null
    const screenTrack = screenStream.getVideoTracks()[0]
    try {
      if (screenSenderRef.current) await screenSenderRef.current.replaceTrack(null)
    } catch {
      setScreenShareError('Could not stop screen sharing cleanly. Please leave and rejoin the call.')
    }
    stopStream(screenStream)
    if (screenTrack) screenTrack.onended = null
    setLocalScreenStream(null)
    setScreenSharing(false)
    screenSharingRef.current = false
    screenStreamIdRef.current = null
    emitPeerState()
  }, [emitPeerState])

  const toggleScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      await stopScreenShare()
      return
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setScreenShareError('Screen sharing is not supported by this browser.')
      return
    }

    setScreenShareError(null)
    let candidateStream
    try {
      candidateStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const screenTrack = candidateStream.getVideoTracks()[0]
      const pc = pcRef.current
      const peerId = remotePeerIdRef.current
      if (!screenTrack || !pc || !peerId) {
        stopStream(candidateStream)
        setScreenShareError('Screen sharing is not available for this call.')
        return
      }
      let sender = screenSenderRef.current
      if (sender) {
        await sender.replaceTrack(screenTrack)
      } else {
        screenTransportStreamRef.current = new MediaStream()
        sender = pc.addTrack(screenTrack, screenTransportStreamRef.current)
        screenSenderRef.current = sender
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socketRef.current?.emit('offer', {
          to: peerId,
          description: pc.localDescription,
        })
      }
      screenStreamRef.current = candidateStream
      setLocalScreenStream(candidateStream)
      setScreenSharing(true)
      screenSharingRef.current = true
      screenStreamIdRef.current = screenTransportStreamRef.current.id
      emitPeerState()
      screenTrack.onended = () => { void stopScreenShare() }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') return
      if (!screenStreamRef.current && candidateStream) stopStream(candidateStream)
      setScreenShareError(err instanceof Error ? err.message : 'Could not start screen sharing.')
    }
  }, [emitPeerState, stopScreenShare])

  return {
    status,
    error,
    roomId,
    localStream,
    remoteStream,
    localScreenStream,
    remoteScreenStream,
    muted,
    cameraOff,
    cameraFacing,
    switchingCamera,
    cameraSwitchError,
    screenSharing,
    screenShareError,
    remoteScreenSharing,
    remoteMuted,
    remoteCameraOff,
    joinRoom,
    leaveRoom,
    toggleMute,
    toggleCamera,
    switchCamera,
    toggleScreenShare,
  }
}
