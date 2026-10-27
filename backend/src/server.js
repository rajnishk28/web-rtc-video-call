import app from './app.js'
import { initializeSocket } from './services/socketService.js'
import { serverConfig } from './config/index.js'

const server = app.listen(serverConfig.port, () => {
  console.log(`API server running on http://localhost:${serverConfig.port}`)
})

// Attach Socket.IO to the same HTTP server for WebRTC signaling
initializeSocket(server, app)

export default server
