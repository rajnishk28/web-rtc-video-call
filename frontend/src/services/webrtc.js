export const getLocalStream = (constraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: { facingMode: 'user' },
}) => navigator.mediaDevices.getUserMedia(constraints)

export const createPeerConnection = (iceServers, handlers) => {
  const pc = new RTCPeerConnection({ iceServers })

  pc.onicecandidate = (event) => {
    if (event.candidate) handlers.onIceCandidate(event.candidate)
  }

  pc.ontrack = (event) => {
    const [stream] = event.streams
    if (stream) handlers.onRemoteTrack(stream, event.track)
  }

  pc.onconnectionstatechange = () => {
    handlers.onConnectionState?.(pc.connectionState)
  }

  return pc
}

export const addLocalTracks = (pc, stream) => {
  for (const track of stream.getTracks()) {
    pc.addTrack(track, stream)
  }
}

export const setTrackEnabled = (stream, kind, enabled) => {
  stream?.getTracks().forEach((track) => {
    if (track.kind === kind) track.enabled = enabled
  })
}

export const stopStream = (stream) => {
  stream?.getTracks().forEach((track) => track.stop())
}
