import { serverConfig } from '../config/index.js'

export const getIceServers = (req, res) => {
  res.status(200).json({ iceServers: serverConfig.iceServers })
}
