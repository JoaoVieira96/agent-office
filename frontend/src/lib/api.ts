/**
 * Cliente HTTP para a Agent Office API.
 * Todos os componentes importam daqui — um único lugar para mudar o base URL.
 */

import { getToken, clearToken } from './auth'

const SERVER_BASE = 'http://backend:8000/api'

const BASE = typeof window === 'undefined' ? SERVER_BASE : '/api'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    ...init,
  })

  if (res.status === 401) {
    clearToken()
    if (typeof window !== 'undefined') window.location.href = '/login'
    throw new Error('Sessão expirada')
  }

  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  return res.json()
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LLMProvider = 'anthropic' | 'openai' | 'ollama'

export interface Agent {
  id: string
  name: string
  description: string
  avatar: string
  system_prompt: string
  llm_provider: LLMProvider
  llm_model: string
  temperature: number
  is_active: boolean
  created_at: string
}

export interface Conversation {
  id: string
  agent_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export interface SkillConfigSchema {
  type: string
  properties?: Record<string, { type: string; default?: any; description?: string }>
}

export interface Skill {
  id: string
  slug: string
  name: string
  description: string
  version: string
  is_enabled: boolean
  config_schema: SkillConfigSchema
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export const api = {
  agents: {
    list:   ()                   => req<Agent[]>('/agents/'),
    get:    (id: string)         => req<Agent>(`/agents/${id}`),
    create: (body: Partial<Agent>) => req<Agent>('/agents/', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Agent>) =>
      req<Agent>(`/agents/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => req<void>(`/agents/${id}`, { method: 'DELETE' }),
  },

  conversations: {
    list:    (agentId: string)  => req<Conversation[]>(`/conversations/agent/${agentId}`),
    create:  (agentId: string)  => req<Conversation>(`/conversations/agent/${agentId}`, { method: 'POST', body: '{}' }),
    messages:(convId: string)   => req<Message[]>(`/conversations/${convId}/messages`),
  },

  skills: {
    list:       ()                               => req<Skill[]>('/skills/'),
    forAgent:   (agentId: string)                => req<any[]>(`/skills/agent/${agentId}`),
    assign:     (agentId: string, skillId: string, config?: object) =>
      req(`/skills/agent/${agentId}`, { method: 'POST', body: JSON.stringify({ skill_id: skillId, config: config ?? {} }) }),
    remove:     (agentId: string, skillId: string) =>
      req(`/skills/agent/${agentId}/${skillId}`, { method: 'DELETE' }),
  },
}

// ---------------------------------------------------------------------------
// WebSocket helper
// ---------------------------------------------------------------------------

export type WSMessage =
  | { type: 'thinking' }
  | { type: 'chunk'; content: string }
  | { type: 'done';  content: string }
  | { type: 'error'; content: string }

export function createChatSocket(
  conversationId: string,
  onMessage: (msg: WSMessage) => void,
): WebSocket {
  const wsBase = typeof window !== 'undefined'
    ? window.location.origin.replace(/^http/, 'ws')
    : 'ws://localhost'

  const token = getToken()
  const url = `${wsBase}/ws/${conversationId}${token ? `?token=${token}` : ''}`

  const ws = new WebSocket(url)
  ws.onmessage = (e) => onMessage(JSON.parse(e.data))
  return ws
}
