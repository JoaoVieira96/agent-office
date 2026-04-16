async function getSkills() {
  try {
    const res = await fetch('http://backend:8000/api/skills/', { cache: 'no-store' })
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

export default async function SkillsPage() {
  const skills = await getSkills()

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Skills</h1>
      <p className="text-muted text-sm mb-8">
        Ferramentas disponíveis para atribuir aos teus agentes. Novas skills são adicionadas colocando uma pasta em <code className="bg-panel border border-border px-1.5 py-0.5 rounded text-xs">skills/</code> e reiniciando o backend.
      </p>

      <div className="grid gap-3">
        {skills.map((skill: any) => (
          <div key={skill.id} className="bg-panel border border-border rounded-xl p-5">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h2 className="font-medium text-sm">{skill.name}</h2>
                <p className="text-xs text-muted font-mono">{skill.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted bg-border px-2 py-0.5 rounded-full">v{skill.version}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  skill.is_enabled
                    ? 'bg-green-900/30 text-green-400'
                    : 'bg-zinc-800 text-muted'
                }`}>
                  {skill.is_enabled ? 'activa' : 'inactiva'}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted">{skill.description}</p>
          </div>
        ))}

        {skills.length === 0 && (
          <div className="text-center py-16 text-muted text-sm">
            Nenhuma skill encontrada. Verifica se a pasta <code className="bg-panel border border-border px-1 rounded text-xs">skills/</code> tem subpastas com <code className="bg-panel border border-border px-1 rounded text-xs">manifest.json</code>.
          </div>
        )}
      </div>

      {/* Instruções para criar skill */}
      <div className="mt-10 bg-panel border border-border rounded-xl p-5">
        <h2 className="text-sm font-medium mb-3">Como criar uma nova skill</h2>
        <pre className="text-xs text-muted leading-relaxed overflow-x-auto">{`# 1. Copia o template
cp -r skills/_template skills/minha_skill

# 2. Edita o manifest.json com o nome, descrição e tool_schema

# 3. Implementa a função run() em skill.py
#    async def run(params: dict, config: dict) -> str: ...

# 4. Reinicia o backend
docker compose restart backend`}</pre>
      </div>
    </div>
  )
}
