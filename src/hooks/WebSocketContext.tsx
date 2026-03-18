/**
 * WebSocket context — provides typingMap, sendTyping, and sendCancelStream
 * to all child components via React Context.
 */
import React, { createContext, useContext } from 'react'
import { useWebSocket, type TypingMap } from './useWebSocket'

interface WebSocketContextValue {
  typingMap: TypingMap
  sendTyping: (conversationId: number) => void
  sendCancelStream: (streamId: string, conversationId: number) => void
}

const defaultValue: WebSocketContextValue = {
  typingMap: new Map(),
  sendTyping: () => {},
  sendCancelStream: () => {},
}

const WSContext = createContext<WebSocketContextValue>(defaultValue)

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { typingMap, sendTyping, sendCancelStream } = useWebSocket()

  return (
    <WSContext.Provider value={{ typingMap, sendTyping, sendCancelStream }}>
      {children}
    </WSContext.Provider>
  )
}

export function useWSContext() {
  return useContext(WSContext)
}
