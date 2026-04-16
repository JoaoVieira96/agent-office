'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Plus } from 'lucide-react'
import { api, createChatSocket, type Message, type Agent, type WSMessage } from '@/lib/api'
import clsx from 'clsx'

export default function ChatPage({ params }: { params: { agentId: string } }) {
  const [agent, setAgent]               = useState<Agent | null>(null)
  const [convId, setConvId]             = useState<string | null>(null)
  const [messages, setMessages]         = useState<Message[]>([])
  const [input, setInput]               = useState('')
  const [thinking, setThinking]         = useState(false)
  const [conversations, setConversations] = useState<any[]>([])
  const wsRef     = useRef<WebSocket | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Carregar agente e conversas
  useEffect(() => {
    api.agents.get(params.agentId).then(setAgent)
    api.conversations.list(params.agentId).then(setConversations)
  }, [params.agentId])

  // Scroll automático
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  const openConversation = useCallback(async (id: string) => {
    setConvId(id)
    const msgs = await api.conversations.messages(id)
    setMessages(msgs)

    // Fechar WS anterior
    wsRef.current?.close()

    // Abrir novo WS
    const ws = createChatSocket(id, (msg: WSMessage) => {
      if (msg.type === 'thinking') {
        setThinking(true)
      } else if (msg.type === 'done') {
        setThinking(false)
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: msg.content,
          created_at: new Date().toISOString(),
        }])
      } else if (msg.type === 'error') {
        setThinking(false)
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `⚠️ Erro: ${msg.content}`,
          created_at: new Date().toISOString(),
        }])
      }
    })
    wsRef.current = ws
  }, [])

  const newConversation = async () => {
    const conv = await api.conversations.create(params.agentId)
    setConversations(prev => [conv, ...prev])
    openConversation(conv.id)
  }

  const sendMessage = () => {
    if (!input.trim() || !convId || !wsRef.current || thinking) return

    const text = input.trim()
    setInput('')

    // Adiciona mensagem do user imediatamente
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }])

    wsRef.current.send(JSON.stringify({ message: text }))
  }

  return (
    <div className="flex h-screen">
      {/* Lista de conversas */}
      <div className="w-56 border-r border-border bg-panel flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <button
            onClick={newConversation}
            className="w-full flex items-center gap-2 text-xs text-muted hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-border"
          >
            <Plus size={13} /> Nova conversa
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.map(c => (
            <button
              key={c.id}
              onClick={() => openConversation(c.id)}
              className={clsx(
                'w-full text-left text-xs px-3 py-2 rounded-lg transition-colors truncate',
                convId === c.id
                  ? 'bg-accent/20 text-white'
                  : 'text-muted hover:text-white hover:bg-border'
              )}
            >
              {c.title}
            </button>
          ))}
        </div>
      </div>

      {/* Área de chat */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-12 border-b border-border px-5 flex items-center gap-3 shrink-0">
          {agent && (
            <>
              <span className="text-lg">{agent.avatar}</span>
              <span className="font-medium text-sm">{agent.name}</span>
              <span className="text-xs text-muted">{agent.llm_model}</span>
            </>
          )}
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {!convId && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <span className="text-4xl mb-4">{agent?.avatar ?? '🤖'}</span>
              <p className="text-muted text-sm">
                Inicia uma nova conversa ou selecciona uma existente.
              </p>
            </div>
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              className={clsx('flex fade-up', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={clsx(
                  'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-accent text-white rounded-br-sm'
                    : 'bg-panel border border-border text-white rounded-bl-sm'
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Indicador "a pensar" */}
          {thinking && (
            <div className="flex justify-start fade-up">
              <div className="bg-panel border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-muted thinking-dot" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted thinking-dot" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted thinking-dot" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex items-end gap-2 bg-panel border border-border rounded-xl px-4 py-3 focus-within:border-accent/50 transition-colors">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
              }}
              placeholder={convId ? `Mensagem para ${agent?.name ?? 'agente'}…` : 'Abre uma conversa para começar'}
              disabled={!convId || thinking}
              rows={1}
              className="flex-1 bg-transparent resize-none text-sm outline-none placeholder-muted max-h-36 disabled:opacity-40"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || !convId || thinking}
              className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center hover:bg-accent-dim transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            >
              <Send size={14} />
            </button>
          </div>
          <p className="text-xs text-muted mt-1.5 px-1">Enter para enviar · Shift+Enter para nova linha</p>
        </div>
      </div>
    </div>
  )
}
