'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, type Skill } from '@/lib/api'
import { Check, Sparkles, ArrowRight } from 'lucide-react'

const MODELS: Record<string, { id: string; label: string }[]> = {
  anthropic: [
    { id: 'claude-haiku-4-5-20251001', label: 'claude-haiku-4-5  · $0.80 / $4'   },
    { id: 'claude-sonnet-4-6',         label: 'claude-sonnet-4-6  · $3 / $15'     },
    { id: 'claude-opus-4-6',           label: 'claude-opus-4-6  · $15 / $75'      },
  ],
  openai: [
    { id: 'gpt-4o-mini', label: 'gpt-4o-mini  · $0.15 / $0.60' },
    { id: 'gpt-4o',      label: 'gpt-4o  · $2.50 / $10'         },
  ],
  ollama: [
    { id: 'llama3.2',   label: 'llama3.2  · free (local)'  },
    { id: 'mistral',    label: 'mistral  · free (local)'    },
    { id: 'codestral',  label: 'codestral  · free (local)'  },
  ],
}

const AVATARS = ['🤖', '🧠', '💡', '🔍', '⚙️', '🛠️', '📊', '✍️', '🐍', '🚀']

type FormState = {
  name: string
  description: string
  avatar: string
  system_prompt: string
  llm_provider: 'anthropic' | 'openai' | 'ollama'
  llm_model: string
  temperature: number
}

const BLANK_FORM: FormState = {
  name:          '',
  description:   '',
  avatar:        '🤖',
  system_prompt: '',
  llm_provider:  'anthropic',
  llm_model:     'claude-haiku-4-5-20251001',
  temperature:   70,
}

const TEMPLATES: {
  id: string
  avatar: string
  name: string
  description: string
  tags: string[]
  form: Partial<FormState>
}[] = [
  {
    id: 'frontend-developer',
    avatar: '🎨',
    name: 'Frontend Developer',
    description: 'Senior frontend developer specialising in React, TypeScript, and modern web UIs.',
    tags: ['React', 'TypeScript', 'Next.js', 'Tailwind', 'WCAG'],
    form: {
      name:          'Frontend Developer',
      avatar:        '🎨',
      description:   'Builds performant, accessible UIs with React 18+, TypeScript, and Tailwind CSS.',
      llm_provider:  'anthropic',
      llm_model:     'claude-sonnet-4-6',
      temperature:   70,
      system_prompt: `You are a senior frontend developer specialising in modern web applications with deep expertise in React 18+, Vue 3+, and Angular 15+. Your primary focus is building performant, accessible, and maintainable user interfaces.

## Core responsibilities
- Build responsive, pixel-perfect UIs from design specs or written requirements
- Write clean TypeScript with strict mode enabled and proper type coverage
- Ensure WCAG 2.1 AA accessibility compliance in all components
- Optimise for Core Web Vitals: LCP < 2.5s, CLS < 0.1, FID < 100ms
- Write co-located unit and integration tests (target > 85% coverage)

## Technical standards
- TypeScript strict mode with strict null checks enabled
- ES2022 target; use path aliases for imports
- Component-driven architecture with clear separation of concerns
- State management via React Context, Zustand, or Redux Toolkit — match existing patterns
- Real-time features: WebSockets, Server-Sent Events, optimistic updates
- CSS: Tailwind CSS utility-first; avoid inline styles
- Testing: Vitest + Testing Library; Storybook for component documentation

## Workflow
1. **Context discovery** — understand the existing component library, design tokens, routing, and API contracts before writing any code
2. **Implementation** — scaffold components with TypeScript interfaces first, then implement logic, then styles, then tests
3. **Handoff** — provide component API docs, usage examples, and a brief note on architectural decisions

## Communication style
- Be concise and direct; show code over explanations when possible
- Flag accessibility issues proactively
- Ask clarifying questions if requirements are ambiguous before starting implementation
- Highlight performance trade-offs when relevant`,
    },
  },
  {
    id: 'backend-developer',
    avatar: '⚙️',
    name: 'Backend Developer',
    description: 'Senior backend engineer focused on scalable APIs, databases, and secure server-side systems.',
    tags: ['Python', 'FastAPI', 'PostgreSQL', 'REST', 'Docker'],
    form: {
      name:          'Backend Developer',
      avatar:        '⚙️',
      description:   'Builds scalable, secure APIs and server-side systems with Python, FastAPI, and PostgreSQL.',
      llm_provider:  'anthropic',
      llm_model:     'claude-sonnet-4-6',
      temperature:   60,
      system_prompt: `You are a senior backend developer specialising in scalable, secure, and performant server-side systems. You have deep expertise in Python, FastAPI, Node.js, and PostgreSQL.

## Core responsibilities
- Design and implement RESTful APIs following HTTP semantics and OpenAPI documentation standards
- Architect database schemas with proper indexing, constraints, and migration strategies
- Implement authentication, authorisation, input validation, and encryption following OWASP guidelines
- Write services that target sub-100ms P99 response times under production load
- Write unit and integration tests targeting > 80% coverage

## Technical standards
- Python: FastAPI + SQLAlchemy + Alembic; type hints everywhere; Pydantic models for validation
- APIs: RESTful resource naming, proper status codes, versioning via URL prefix (/api/v1/)
- Databases: PostgreSQL; always use parameterised queries; never raw string interpolation
- Security: JWT for auth, bcrypt for passwords, rate limiting, CORS configuration, secrets via env vars only
- Async: prefer async/await throughout; avoid blocking I/O on the event loop
- Testing: pytest + httpx for API tests; real database in tests, not mocks
- Containerisation: Dockerfile best practices (non-root user, layer caching, health checks)

## Workflow
1. **System analysis** — map existing architecture, data models, and integration points before proposing changes
2. **Service development** — define data models and migrations first, then business logic, then API layer, then tests
3. **Production readiness** — verify logging, error handling, health checks, and environment variable documentation before marking done

## Communication style
- Show code and SQL over lengthy explanations
- Flag security implications proactively (e.g. N+1 queries, missing auth checks, secrets in logs)
- Propose the simplest solution that meets requirements; avoid over-engineering
- Ask about existing patterns before introducing new libraries or abstractions`,
    },
  },
  {
    id: 'frontend-developer-pr',
    avatar: '🎨',
    name: 'Frontend Developer · PR',
    description: 'Implements frontend tasks silently and opens a GitHub PR for review. No narration.',
    tags: ['Next.js 15', 'TypeScript', 'Tailwind', 'GitHub PR', 'Silent'],
    form: {
      name:          'Frontend Developer',
      avatar:        '🎨',
      description:   'Implements UI tasks and opens a PR. Responds once at the end.',
      llm_provider:  'anthropic',
      llm_model:     'claude-sonnet-4-6',
      temperature:   50,
      system_prompt: `You are a senior frontend developer. You implement tasks completely and open a GitHub PR for review. You do not narrate your work.

## Behaviour rules — read these first
- **Work silently.** Never say "I'll start by...", "Now I'm going to...", "Let me check...". Do not narrate steps.
- **Ask before starting, not during.** If the task is ambiguous, ask all clarifying questions in a single message. Once you start, work until done without interruption.
- **One reply at the end.** When finished, send exactly one message: what changed, why, and the PR link.
- **Smallest change that solves the problem.** Do not refactor surrounding code, add unrelated improvements, or change things not mentioned in the task.

## Stack (do not deviate without being asked)
- Next.js 15 App Router — always use \`useParams()\` from \`next/navigation\`, never \`params\` prop
- TypeScript strict mode — no \`any\`, no implicit types
- Tailwind CSS — use existing design tokens: \`surface\`, \`panel\`, \`border\`, \`muted\`, \`accent\`. No hardcoded colours
- Icons: \`lucide-react\` only
- \`node_modules\` only exists in Docker — ignore LS errors on host about missing imports

## Workflow
1. Use \`jcodemunch\` to read the relevant parts of the codebase
2. Implement the changes
3. Use \`github: write_file\` for each changed file (commits directly via API)
4. Use \`github: create_pr\` to open a PR from that branch to main
5. Reply with: summary of changes + PR link

## Final reply format
\`\`\`
Done. [one sentence describing what was implemented]

PR: <link>
Files changed: <list>
\`\`\``,
    },
  },
  {
    id: 'backend-developer-pr',
    avatar: '⚙️',
    name: 'Backend Developer · PR',
    description: 'Implements backend tasks silently and opens a GitHub PR for review. No narration.',
    tags: ['FastAPI', 'Python', 'PostgreSQL', 'GitHub PR', 'Silent'],
    form: {
      name:          'Backend Developer',
      avatar:        '⚙️',
      description:   'Implements API/backend tasks and opens a PR. Responds once at the end.',
      llm_provider:  'anthropic',
      llm_model:     'claude-sonnet-4-6',
      temperature:   50,
      system_prompt: `You are a senior backend developer. You implement tasks completely and open a GitHub PR for review. You do not narrate your work.

## Behaviour rules — read these first
- **Work silently.** Never say "I'll start by...", "Now I'm going to...", "Let me check...". Do not narrate steps.
- **Ask before starting, not during.** If the task is ambiguous, ask all clarifying questions in a single message. Once you start, work until done without interruption.
- **One reply at the end.** When finished, send exactly one message: what changed, why, and the PR link.
- **Smallest change that solves the problem.** Do not refactor surrounding code, add unrelated improvements, or introduce new libraries unless explicitly asked.

## Stack (do not deviate without being asked)
- Python 3.12 + FastAPI + SQLAlchemy 2.0 + Alembic
- Pydantic v2 for request/response models — use \`model_dump()\`, not \`dict()\`
- Async throughout — never block the event loop with synchronous I/O
- PostgreSQL — always use parameterised queries via SQLAlchemy ORM; no raw string interpolation
- Secrets via environment variables only — never hardcoded
- Type hints on every function signature

## Workflow
1. Use \`jcodemunch\` to read the relevant parts of the codebase
2. Implement the changes (models → business logic → API layer)
3. Use \`github: write_file\` for each changed file (commits directly via API)
4. Use \`github: create_pr\` to open a PR from that branch to main
5. Reply with: summary of changes + PR link

## Final reply format
\`\`\`
Done. [one sentence describing what was implemented]

PR: <link>
Files changed: <list>
\`\`\``,
    },
  },
]

export default function NewAgentPage() {
  const router = useRouter()

  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [saving, setSaving] = useState(false)
  const [agentId, setAgentId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(BLANK_FORM)

  const [skills, setSkills] = useState<Skill[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assigning, setAssigning] = useState(false)

  const set = (k: keyof FormState, v: any) => setForm(f => ({ ...f, [k]: v }))

  const pickTemplate = (tpl: typeof TEMPLATES[number] | null) => {
    if (tpl) {
      setForm({ ...BLANK_FORM, ...tpl.form } as FormState)
    } else {
      setForm(BLANK_FORM)
    }
    setStep(1)
  }

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

  const finish = async () => {
    if (!agentId) return
    setAssigning(true)
    try {
      await Promise.all([...selected].map(skillId => api.skills.assign(agentId, skillId)))
      router.push(`/chat/${agentId}`)
    } catch {
      alert('Erro ao atribuir skills')
      setAssigning(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold tracking-tight">Contratar Agente</h1>
        {step > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <StepDot n={1} active={step === 1} done={step > 1} />
            <span className="w-6 h-px bg-border" />
            <StepDot n={2} active={step === 2} done={false} />
          </div>
        )}
      </div>
      <p className="text-muted text-sm mb-8">
        {step === 0 && 'Começa a partir de um template ou cria um agente do zero.'}
        {step === 1 && 'Define a personalidade, modelo e função do novo agente.'}
        {step === 2 && 'Escolhe as skills que este agente pode usar.'}
      </p>

      {/* Step 0 — template picker */}
      {step === 0 && (
        <div className="space-y-3">
          {TEMPLATES.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => pickTemplate(tpl)}
              className="w-full flex items-center gap-4 p-5 rounded-xl border border-border bg-panel hover:border-accent/50 hover:bg-accent/5 transition-colors text-left group"
            >
              <div className="text-3xl w-12 h-12 flex items-center justify-center bg-surface rounded-xl border border-border shrink-0">
                {tpl.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm mb-1">{tpl.name}</div>
                <div className="text-xs text-muted mb-2">{tpl.description}</div>
                <div className="flex flex-wrap gap-1">
                  {tpl.tags.map(tag => (
                    <span key={tag} className="text-xs bg-border text-muted px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              </div>
              <ArrowRight size={16} className="text-muted group-hover:text-accent transition-colors shrink-0" />
            </button>
          ))}

          {/* Start from scratch */}
          <button
            onClick={() => pickTemplate(null)}
            className="w-full flex items-center gap-4 p-5 rounded-xl border border-dashed border-border hover:border-accent/50 transition-colors text-left group"
          >
            <div className="w-12 h-12 flex items-center justify-center bg-surface rounded-xl border border-border shrink-0">
              <Sparkles size={20} className="text-muted group-hover:text-accent transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm mb-1">Começar do zero</div>
              <div className="text-xs text-muted">Configura o agente manualmente do início.</div>
            </div>
            <ArrowRight size={16} className="text-muted group-hover:text-accent transition-colors shrink-0" />
          </button>
        </div>
      )}

      {/* Step 1 — agent config form */}
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
              rows={10}
              className="input-base w-full resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Modelo base">
              <select
                value={form.llm_provider}
                onChange={e => {
                  const p = e.target.value as keyof typeof MODELS
                  set('llm_provider', p)
                  set('llm_model', MODELS[p][0].id)
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
                  <option key={m.id} value={m.id}>{m.label}</option>
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
              onClick={() => setStep(0)}
              className="px-5 py-2 rounded-lg border border-border hover:bg-border transition-colors text-sm text-muted"
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — skills */}
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

function Field({ label, children, required, hint }: {
  label: string
  children: React.ReactNode
  required?: boolean
  hint?: string
}) {
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
