'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api, type Skill } from '@/lib/api'
import { Check } from 'lucide-react'

const MODELS = {
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  openai:    ['gpt-4o', 'gpt-4o-mini'],
  ollama:    ['llama3.2', 'mistral', 'codestral'],
}

const AVATARS = ['🤖', '🧠', '💡', '🔍', '⚙️', '🛠️', '📊', '✍️', '🐍', '🚀']

export default function NewAgentPage() {
  const router = useRouter()

  // Step 1 state
  const [step, setStep] = useState<1 | 2>(1)
  const [saving, setSaving] = useState(false)
  const [agentId, setAgentId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name:          '',
    description:   '',
    avatar:        '🤖',
    system_prompt: '',
    llm_provider:  'anthropic' as 'anthropic' | 'openai' | 'ollama',
    llm_model:     'claude-opus-4-6',
    temperature:   70,
  })

  // Step 2 state
  const [skills, setSkills] = useState<Skill[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assigning, setAssigning] = useState(false)

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // Step 1 → create agent, move to step 2
  const createAgent = async () => {
    if (!form.name || !form.system_prompt) return
    setSaving(true)
    try {
      const agent = await api.agents.create(form)
      setAgentId(agent.id)
      const allSkills = await api.skills.list()
      setSkills(allSkills.filter(s => s.is_enabled))
      setStep(2)
    } catch {
      alert('Erro ao criar agente')
    } finally {
      setSaving(false)
    }
  }

  const toggleSkill = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // Step 2 → assign selected skills, go to chat
  const finish = async () => {
    if (!agentId) return
    setAssigning(true)
    try {
      await Promise.all(
        [...selected].map(skillId => api.skills.assign(agentId, skillId))
      )
      router.push(`/chat/${agentId}`)
    } catch {
      alert('Erro ao atribuir skills')
      setAssigning(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header with step indicator */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold tracking-tight">Contratar Agente</h1>
        <div className="flex items-center gap-2 text-xs text-muted">
          <StepDot n={1} active={step === 1} done={step > 1} />
          <span className="w-6 h-px bg-border" />
          <StepDot n={2} active={step === 2} done={false} />
        </div>
      </div>
      <p className="text-muted text-sm mb-8">
        {step === 1 ? 'Define a personalidade, modelo e função do novo agente.' : 'Escolhe as skills que este agente pode usar.'}
      </p>

      {step === 1 && (
        <div className="space-y-6">
          {/* Avatar */}
          <div>
            <label className="text-xs text-muted block mb-2">Avatar</label>
            <div className="flex flex-wrap gap-2">
              {AVATARS.map(e => (
                <button
                  key={e}
                  onClick={() => set('avatar', e)}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition-colors
                    ${form.avatar === e ? 'border-accent bg-accent/20' : 'border-border hover:border-border/80 bg-panel'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <Field label="Nome do agente" required>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="ex: Dev Assistant, Researcher, Code Reviewer..."
              className="input-base w-full"
            />
          </Field>

          <Field label="Descrição">
            <input
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Breve descrição da função deste agente"
              className="input-base w-full"
            />
          </Field>

          <Field label="System Prompt" required hint="Define a personalidade e função do agente">
            <textarea
              value={form.system_prompt}
              onChange={e => set('system_prompt', e.target.value)}
              placeholder="És um assistente especializado em programação Python. Respondes sempre em português, de forma concisa e com exemplos de código quando relevante..."
              rows={6}
              className="input-base w-full resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Modelo base">
              <select
                value={form.llm_provider}
                onChange={e => {
                  const p = e.target.value as any
                  set('llm_provider', p)
                  set('llm_model', MODELS[p as keyof typeof MODELS][0])
                }}
                className="input-base w-full"
              >
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI (GPT)</option>
                <option value="ollama">Ollama (local)</option>
              </select>
            </Field>
            <Field label="Modelo">
              <select
                value={form.llm_model}
                onChange={e => set('llm_model', e.target.value)}
                className="input-base w-full"
              >
                {MODELS[form.llm_provider].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={`Temperatura: ${form.temperature / 100}`} hint="Mais baixo = mais focado · Mais alto = mais criativo">
            <input
              type="range" min={0} max={100} value={form.temperature}
              onChange={e => set('temperature', Number(e.target.value))}
              className="w-full accent-accent"
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <button
              onClick={createAgent}
              disabled={saving || !form.name || !form.system_prompt}
              className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-dim transition-colors text-sm font-medium disabled:opacity-40"
            >
              {saving ? 'A criar…' : 'Continuar →'}
            </button>
            <button
              onClick={() => router.back()}
              className="px-5 py-2 rounded-lg border border-border hover:bg-border transition-colors text-sm text-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {skills.length === 0 ? (
            <p className="text-muted text-sm">Sem skills disponíveis.</p>
          ) : (
            <div className="space-y-2">
              {skills.map(skill => (
                <button
                  key={skill.id}
                  onClick={() => toggleSkill(skill.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-colors
                    ${selected.has(skill.id)
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-panel hover:border-accent/40'}`}
                >
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors
                    ${selected.has(skill.id) ? 'border-accent bg-accent' : 'border-border'}`}>
                    {selected.has(skill.id) && <Check size={12} strokeWidth={3} />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{skill.name}</div>
                    <div className="text-xs text-muted mt-0.5 truncate">{skill.description}</div>
                  </div>
                  <span className="ml-auto text-xs text-muted flex-shrink-0">v{skill.version}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={finish}
              disabled={assigning}
              className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-dim transition-colors text-sm font-medium disabled:opacity-40"
            >
              {assigning ? 'A finalizar…' : 'Concluir e abrir chat →'}
            </button>
            <button
              onClick={finish}
              disabled={assigning}
              className="px-5 py-2 rounded-lg border border-border hover:bg-border transition-colors text-sm text-muted disabled:opacity-40"
            >
              Saltar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors
      ${active ? 'bg-accent text-white' : done ? 'bg-accent/30 text-accent' : 'bg-panel border border-border text-muted'}`}>
      {n}
    </div>
  )
}

function Field({ label, children, required, hint }: any) {
  return (
    <div>
      <label className="text-xs text-muted block mb-1.5">
        {label}{required && <span className="text-accent ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  )
}
