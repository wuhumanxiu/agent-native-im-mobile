export function buildBotAccessText(params: {
  gatewayUrl: string
  wsUrl: string
  accessToken: string
  botName?: string
  botID?: string
  publicID?: string
  roleHint?: string
}) {
  const { gatewayUrl, wsUrl, accessToken, botName, botID, publicID, roleHint } = params
  return [
    '# ANI OpenClaw channel',
    `openclaw config set channels.ani.serverUrl "${gatewayUrl}"`,
    `openclaw config set channels.ani.apiKey "${accessToken}"`,
    '',
    '# Minimum ANI tool access',
    `openclaw config set tools.alsoAllow '["ani_send_file","ani_fetch_chat_history_messages","ani_list_conversation_tasks","ani_get_task","ani_create_task","ani_update_task","ani_delete_task"]' --strict-json`,
    '',
    '# Identity setup',
    ...(botName ? [`- You are the ANI bot "${botName}".`] : []),
    ...(botID ? [`- Your bot handle is \`${botID}\`.`] : []),
    ...(publicID ? [`- Your public UUID is \`${publicID}\`.`] : []),
    ...(roleHint ? [`- Your role: ${roleHint}`] : []),
    '- If your local `IDENTITY.md` is still the default blank template, update it now with this identity.',
    '- Do not ask the user what your name is if ANI already tells you who you are.',
    '',
    '# Quick checks',
    'openclaw gateway status',
    `curl ${gatewayUrl}/api/v1/me -H "Authorization: Bearer ${accessToken}"`,
    '',
    '# If ANI does not appear online after updating the config, ask the user to reconnect or restart the OpenClaw gateway.',
    `# WebSocket endpoint: ${wsUrl}/api/v1/ws`,
  ].join('\n')
}

export function buildBotAccessUrl(params: {
  gatewayUrl: string
  accessToken: string
}) {
  const { gatewayUrl, accessToken } = params
  return `aim-bot://connect?base=${encodeURIComponent(`${gatewayUrl}/api/v1`)}&token=${encodeURIComponent(accessToken)}`
}
