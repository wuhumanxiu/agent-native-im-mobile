import { getApiBaseUrl, getDefaultGatewayUrl, getGatewayUrl, getWsBaseUrl } from './gateway'

export const API_BASE_URL = getApiBaseUrl()
export const WS_BASE_URL = getWsBaseUrl()

export {
  getApiBaseUrl,
  getDefaultGatewayUrl,
  getGatewayUrl,
  getWsBaseUrl,
}
