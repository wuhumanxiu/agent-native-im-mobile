import { describe, expect, it } from 'vitest'
import { buildBotAccessText, buildBotAccessUrl } from './bot-access'

describe('mobile bot access helpers', () => {
  it('includes OpenClaw channel configuration in the access text', () => {
    const text = buildBotAccessText({
      gatewayUrl: 'https://agent-native.im',
      wsUrl: 'wss://agent-native.im',
      accessToken: 'aim_test_token',
      botName: '刘布斯',
      botID: 'bot_liubusi',
      publicID: '419407cb-97a4-4d0f-a233-91ffc681d001',
      roleHint: '全栈开发工程师，尤其擅长APP开发',
    })

    expect(text).toContain('npx -y openclaw-ani-installer install')
    expect(text).toContain('openclaw config set channels.ani.serverUrl "https://agent-native.im"')
    expect(text).toContain('openclaw config set channels.ani.apiKey "aim_test_token"')
    expect(text).toContain('You are the ANI bot "刘布斯".')
    expect(text).toContain('IDENTITY.md')
    expect(text).toContain('openclaw gateway status')
    expect(text).not.toContain('AGENT_IM_ENTITY_ID')
  })

  it('builds the access URL for OpenClaw handoff', () => {
    const url = buildBotAccessUrl({
      gatewayUrl: 'https://agent-native.im',
      accessToken: 'aim_test_token',
    })

    expect(url).toContain('aim-bot://connect?base=')
    expect(url).toContain('token=aim_test_token')
    expect(url).not.toContain('entity_id=')
  })
})
