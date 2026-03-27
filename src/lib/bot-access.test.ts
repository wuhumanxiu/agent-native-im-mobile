import { describe, expect, it } from 'vitest'
import { buildBotAccessText, buildBotAccessUrl } from './bot-access'

describe('mobile bot access helpers', () => {
  it('includes reconnect guidance in the access text', () => {
    const text = buildBotAccessText({
      gatewayUrl: 'https://agent-native.im',
      wsUrl: 'wss://agent-native.im',
      accessToken: 'aim_test_token',
    })

    expect(text).toContain('AGENT_IM_TOKEN=aim_test_token')
    expect(text).toContain('Replace channels.ani.apiKey with the latest token')
    expect(text).toContain('AGENT_IM_WS=wss://agent-native.im/api/v1/ws')
  })

  it('builds the access URL for OpenClaw handoff', () => {
    const url = buildBotAccessUrl({
      gatewayUrl: 'https://agent-native.im',
      accessToken: 'aim_test_token',
      entityId: 5,
    })

    expect(url).toContain('aim-bot://connect?base=')
    expect(url).toContain('token=aim_test_token')
    expect(url).toContain('entity_id=5')
  })
})
