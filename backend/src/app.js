import express from 'express'
import cors from 'cors'
import { serverConfig } from './config/index.js'
import healthRouter from './routes/healthRoutes.js'
import iceServersRouter from './routes/iceServersRoutes.js'
import { notFoundHandler, errorHandler } from './middleware/errorMiddleware.js'

const app = express()

app.use(
  cors({
    origin: serverConfig.clientOrigin,
  })
)
app.use(express.json())

// Routes
app.use('/api/health', healthRouter)
app.use('/api/ice-servers', iceServersRouter)

// Error handling (must be registered last)
app.use(notFoundHandler)
app.use(errorHandler)

export default app
