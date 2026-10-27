import { Router } from 'express'
import { getIceServers } from '../controllers/iceServersController.js'

const router = Router()

router.get('/', getIceServers)

export default router
