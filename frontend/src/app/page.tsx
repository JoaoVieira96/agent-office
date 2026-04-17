'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BotMessageSquare, Plus, Pencil, Wrench, Webhook } from 'lucide-react'
import { api, type Agent } from '@/lib/api'

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([])

  useEffect(() => {
    api.agents.list().then(setAgents).catch(() => setAgents([]))
  }, [])

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">O teu Escritório</h1>
          <p className="text-muted text-sm mt-1">
            {agents.length === 0 ? 'Ainda sem agentes. Começa por contratar um.' : `${agents.length} agente${agents.length !== 1 ? 's' : ''} disponível${agents.length !== 1 ? 'is' : ''}`}
          </p>
        </div>
        <Link
          href="/agents/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-dim transition-colors text-sm font-medium"
        >
          <Plus size={15} />
          Novo Agente
        </Link>
      </div>

      {agents.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  )
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div className="bg-panel border border-border rounded-xl p-5 hover:border-accent/40 transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <div className="text-2xl">{agent.avatar}</div>
        <span className="text-xs text-muted bg-border px-2 py-0.5 rounded-full">
          {agent.llm_model}
        </span>
      </div>
      <h2 className="font-medium text-sm mb-1">{agent.name}</h2>
      <p className="text-muted text-xs line-clamp-2 mb-4">{agent.description || 'Sem descrição'}</p>
      <div className="flex items-center gap-3">
        <Link href={`/chat/${agent.id}`} className="text-xs text-accent hover:text-white transition-colors">
          Abrir chat →
        </Link>
        <span className="text-border">|</span>
        <Link href={`/agents/${agent.id}`} className="text-muted hover:text-white transition-colors" title="Editar">
          <Pencil size={13} />
        </Link>
        <Link href={`/agents/${agent.id}/skills`} className="text-muted hover:text-white transition-colors" title="Skills">
          <Wrench size={13} />
        </Link>
        <Link href={`/agents/${agent.id}/hooks`} className="text-muted hover:text-white transition-colors" title="Hooks">
          <Webhook size={13} />
        </Link>
      </div>
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
        <Plus size={15} />
        Contratar Agente
      </Link>
    </div>
  )
}
