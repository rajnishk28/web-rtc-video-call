import { healthApi } from './health'
import { iceServersApi } from './iceServers'

export { ApiError, api as apiClient } from './client'
/** Central HTTP service. All REST calls go through this object. */
export const api = {
  health: healthApi,
  iceServers: iceServersApi,
}
