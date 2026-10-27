import dotenv from 'dotenv'

dotenv.config()

// STUN servers (comma-separated; defaults to Google public STUN).
const stunUrls = (
  process.env.STUN_URLS ||
  'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302'
)
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean)

// Build the ICE servers array in the format RTCPeerConnection expects.
// TURN is only included when TURN_URL is set; username/credential keys are
// only added when their values are non-empty, so no empty values leak in.
const iceServers = []

if (stunUrls.length > 0) {
  iceServers.push({ urls: stunUrls })
}

const turnUrls = (process.env.TURN_URLS || process.env.TURN_URL || '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean)

if (turnUrls.length > 0) {
  iceServers.push({
    urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls,
    ...(process.env.TURN_USERNAME && { username: process.env.TURN_USERNAME }),
    ...(process.env.TURN_CREDENTIAL && { credential: process.env.TURN_CREDENTIAL }),
  })
}

export const serverConfig = {
  port: process.env.PORT || 4000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  iceServers,
}
