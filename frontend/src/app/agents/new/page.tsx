'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

const MODELS = {
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  openai:    ['gpt-4o', 'gpt-4o-mini'],
  ollama:    ['llama3.2', 'mistral', 'codestral'],
}

const AVATARS = ['🤖', '🧠', '💡', '🔍', '⚙️', '🛠️', '📊', '✍️', '🐍', '🚀']

export default function NewAgentPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name:          '',
    description:   '',
    avatar:        '🤖',
    system_prompt: '',
    llm_provider:  'anthropic' as 'anthropic' | 'openai' | 'ollama',
    llm_model:     'claude-opus-4-6',
    temperature:   70,
  })

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.name || !form.system_prompt) return
    setSaving(true)
    try {
      const agent = await api.agents.create(form)
      router.push(`/chat/${agent.id}`)
    } catch (e) {
      alert('Erro ao criar agente')
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Contratar Agente</h1>
      <p className="text-muted text-sm mb-8">Define a personalidade, modelo e função do novo agente.</p>

      <div className="space-y-6">
        {/* Avatar + Nome */}
        <div className="flex gap-4">
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

        {/* LLM */}
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
            onClick={save}
            disabled={saving || !form.name || !form.system_prompt}
            className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-dim transition-colors text-sm font-medium disabled:opacity-40"
          >
            {saving ? 'A criar…' : 'Contratar Agente'}
          </button>
          <button
            onClick={() => router.back()}
            className="px-5 py-2 rounded-lg border border-border hover:bg-border transition-colors text-sm text-muted"
          >
            Cancelar
          </button>
        </div>
      </div>
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
