import { useEffect, useRef, useState, useCallback } from 'react'

export interface LiveEvent {
  id: string
  ip: string
  action: string
  status: string
  risk_score: number
  category: string
  country: string
  sim_timestamp: string
  details: Record<string, any>
  user_id?: string
}

export function useWebSocket() {
  const [events, setEvents]     = useState<LiveEvent[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef        = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>()

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket('ws://localhost:8000/ws')
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      clearTimeout(reconnectRef.current)
    }

    ws.onclose = () => {
      setConnected(false)
      reconnectRef.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      ws.close()
    }

    ws.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data)
        if (parsed.type === 'event') {
          setEvents(prev => [parsed.data, ...prev].slice(0, 200))
        }
      } catch {
        // ignore parse errors
      }
    }
  }, [])

  useEffect(() => {
    // Only connect if logged in
    const token = localStorage.getItem('token')
    if (token) connect()

    return () => {
      clearTimeout(reconnectRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null // prevent reconnect on unmount
        wsRef.current.close()
      }
    }
  }, [connect])

  return { events, connected }
}
