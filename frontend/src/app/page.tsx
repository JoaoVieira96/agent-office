'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BotMessageSquare, Plus, MessageSquare, Pencil, Puzzle, Webhook } from 'lucide-react'
import { api, type Agent } from '@/lib/api'

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([])

  useEffect(() => {
    api.agents.list().then(setAgents).catch(() => setAgents([]))
  }, [])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">O teu Escritório</h1>
          <p className="text-muted text-sm mt-1">
            {agents.length === 0
              ? 'Ainda sem agentes. Começa por contratar um.'
              : `${agents.length} agente${agents.length !== 1 ? 's' : ''} disponível${agents.length !== 1 ? 'is' : ''}`}
          </p>
        </div>
        <Link
          href="/agents/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-dim transition-colors text-sm font-medium"
        >
          <Plus size={15} /> Contratar Agente
        </Link>
      </div>

      {agents.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {agents.map(agent => (
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
                    {agent.llm_model}
                  </span>
                </div>
                <p className="text-muted text-xs truncate">{agent.description || 'Sem descrição'}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Link href={`/chat/${agent.id}`}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-border"
                  title="Chat">
                  <MessageSquare size={13} /> Chat
                </Link>
                <Link href={`/agents/${agent.id}/skills`}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-border"
                  title="Skills">
                  <Puzzle size={13} /> Skills
                </Link>
                <Link href={`/agents/${agent.id}/hooks`}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-border"
                  title="Hooks">
                  <Webhook size={13} /> Hooks
                </Link>
                <Link href={`/agents/${agent.id}`}
                  className="flex items-center gap-1.5 text-xs text-accent hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-border"
                  title="Editar">
                  <Pencil size={13} /> Editar
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-panel border border-border flex items-center justify-center mb-4">
        <BotMessageSquare size={24} className="text-muted" />
      </div>
      <h2 className="font-medium mb-2">Escritório vazio</h2>
      <p className="text-muted text-sm mb-6 max-w-xs">
        Contrata o teu primeiro agente e define a sua função, personalidade e skills.
      </p>
      <Link
        href="/agents/new"
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-dim transition-colors text-sm font-medium"
      >
        <Plus size={15} /> Contratar Agente
      </Link>
    </div>
  )
}
