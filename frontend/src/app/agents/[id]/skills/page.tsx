'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api, type Skill } from '@/lib/api'
import { Plus, X, Puzzle } from 'lucide-react'

export default function AgentSkillsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [allSkills, setAllSkills]       = useState<Skill[]>([])
  const [agentSkills, setAgentSkills]   = useState<any[]>([])
  const [agentName, setAgentName]       = useState('')
  const [busy, setBusy]                 = useState('')

  useEffect(() => {
    api.agents.get(params.id).then(a => setAgentName(a.name))
    api.skills.list().then(setAllSkills)
    api.skills.forAgent(params.id).then(setAgentSkills)
  }, [params.id])

  const assignedIds = new Set(agentSkills.map(s => s.skill_id))

  const assign = async (skillId: string) => {
    setBusy(skillId)
    await api.skills.assign(params.id, skillId)
    const updated = await api.skills.forAgent(params.id)
    setAgentSkills(updated)
    setBusy('')
  }

  const remove = async (skillId: string) => {
    setBusy(skillId)
    await api.skills.remove(params.id, skillId)
    const updated = await api.skills.forAgent(params.id)
    setAgentSkills(updated)
    setBusy('')
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <button onClick={() => router.back()} className="text-xs text-muted hover:text-white mb-6 block">← Voltar</button>

      <h1 className="text-2xl font-semibold tracking-tight mb-1">Skills do agente</h1>
      <p className="text-muted text-sm mb-8">{agentName}</p>

      {/* Skills activas */}
      <div className="mb-8">
        <h2 className="text-xs text-muted uppercase tracking-widest mb-3">Activas</h2>
        {agentSkills.length === 0 ? (
          <p className="text-muted text-sm">Nenhuma skill atribuída ainda.</p>
        ) : (
          <div className="space-y-2">
            {agentSkills.map(as => {
              const skill = allSkills.find(s => s.id === as.skill_id)
              return (
                <div key={as.id}
                  className="flex items-center gap-3 bg-panel border border-border rounded-xl px-4 py-3">
                  <Puzzle size={15} className="text-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{skill?.name ?? as.skill_id}</p>
                    <p className="text-xs text-muted">{skill?.description}</p>
                  </div>
                  <button
                    onClick={() => remove(as.skill_id)}
                    disabled={busy === as.skill_id}
                    className="text-muted hover:text-red-400 transition-colors disabled:opacity-30"
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Skills disponíveis */}
      <div>
        <h2 className="text-xs text-muted uppercase tracking-widest mb-3">Disponíveis</h2>
        <div className="space-y-2">
          {allSkills
            .filter(s => !assignedIds.has(s.id))
            .map(skill => (
              <div key={skill.id}
                className="flex items-center gap-3 bg-panel border border-border rounded-xl px-4 py-3 opacity-60 hover:opacity-100 transition-opacity">
                <Puzzle size={15} className="text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{skill.name}</p>
                  <p className="text-xs text-muted">{skill.description}</p>
                </div>
                <button
                  onClick={() => assign(skill.id)}
                  disabled={busy === skill.id}
                  className="flex items-center gap-1 text-xs text-accent hover:text-white transition-colors disabled:opacity-30 px-2 py-1 rounded-lg hover:bg-accent/20"
                >
                  <Plus size={12} /> Atribuir
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
