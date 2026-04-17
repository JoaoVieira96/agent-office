'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, MessageSquare, Puzzle, Webhook } from 'lucide-react'
import { api, type Agent } from '@/lib/api'

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])

  useEffect(() => {
    api.agents.list().then(setAgents).catch(() => setAgents([]))
  }, [])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agentes</h1>
          <p className="text-muted text-sm mt-1">Gere a tua equipa de agentes de IA</p>
        </div>
        <Link
          href="/agents/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-dim transition-colors text-sm font-medium"
        >
          <Plus size={15} /> Contratar Agente
        </Link>
      </div>

      <div className="space-y-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="bg-panel border border-border rounded-xl p-5 flex items-center gap-5 hover:border-border/80 transition-colors"
          >
            <div className="text-3xl w-12 h-12 flex items-center justify-center bg-surface rounded-xl border border-border shrink-0">
              {agent.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="font-medium text-sm">{agent.name}</h2>
                <span className="text-xs text-muted bg-border px-2 py-0.5 rounded-full">
                  {agent.llm_provider}
                </span>
                <span className="text-xs text-muted">{agent.llm_model}</span>
              </div>
              <p className="text-muted text-xs truncate">{agent.description || 'Sem descrição'}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/chat/${agent.id}`}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-border"
              >
                <MessageSquare size={13} /> Chat
              </Link>
              <Link
                href={`/agents/${agent.id}/skills`}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-border"
              >
                <Puzzle size={13} /> Skills
              </Link>
              <Link
                href={`/agents/${agent.id}/hooks`}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-border"
              >
                <Webhook size={13} /> Hooks
              </Link>
              <Link
                href={`/agents/${agent.id}`}
                className="text-xs text-accent hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-border"
              >
                Editar →
              </Link>
            </div>
          </div>
        ))}

        {agents.length === 0 && (
          <div className="text-center py-20 text-muted text-sm">
            Ainda sem agentes. <Link href="/agents/new" className="text-accent hover:underline">Cria o primeiro.</Link>
          </div>
        )}
      </div>
    </div>
  )
}
