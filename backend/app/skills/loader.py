"""
Skills Loader — carrega skills da pasta /skills em disco.
Cada skill tem um manifest.json e um skill.py.
"""

import json
import importlib.util
from pathlib import Path
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import SessionLocal
from app.db.models import Skill


async def load_skills_from_disk():
    """
    Varre a pasta SKILLS_DIR e regista cada skill na base de dados.
    Chamado no startup da aplicação.
    """
    skills_path = Path(settings.SKILLS_DIR)
    if not skills_path.exists():
        print(f"[skills] Pasta {skills_path} não encontrada, a saltar.")
        return

    db: Session = SessionLocal()
    try:
        for folder in skills_path.iterdir():
            if not folder.is_dir() or folder.name.startswith("_"):
                continue

            manifest_file = folder / "manifest.json"
            if not manifest_file.exists():
                continue

            manifest = json.loads(manifest_file.read_text())
            slug = manifest.get("slug", folder.name)

            existing = db.query(Skill).filter(Skill.slug == slug).first()
            if existing:
                # Actualiza versão/descrição se mudou
                existing.name          = manifest.get("name", slug)
                existing.description   = manifest.get("description", "")
                existing.version       = manifest.get("version", "1.0.0")
                existing.config_schema = manifest.get("config_schema", {})
            else:
                skill = Skill(
                    slug          = slug,
                    name          = manifest.get("name", slug),
                    description   = manifest.get("description", ""),
                    version       = manifest.get("version", "1.0.0"),
                    config_schema = manifest.get("config_schema", {}),
                )
                db.add(skill)
                print(f"[skills] Registada skill: {slug}")

        db.commit()
    finally:
        db.close()
