import re
import shutil
from pathlib import Path

APPS_DIR = Path("/var/www/turion-apps")
BASE_DOMAIN = "turion.network"


def parse_code_blocks(content: str) -> dict:
    """
    Parse ```lang:filename\\ncontent\\n``` blocks from AI response.
    Returns {filename: content} dict.
    """
    pattern = r"```[\w+\-\.]*:([^\n`]+)\n([\s\S]*?)```"
    files = {}
    for match in re.finditer(pattern, content):
        filename = match.group(1).strip()
        code = match.group(2)
        if filename:
            files[filename] = code
    return files


def slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug[:60].strip("-") or "app"


def write_app_files(slug: str, files: dict) -> None:
    """Write app files to disk under APPS_DIR/slug/."""
    app_dir = APPS_DIR / slug
    app_dir.mkdir(parents=True, exist_ok=True)

    for rel_path, content in files.items():
        # Prevent path traversal
        target = (app_dir / rel_path).resolve()
        if not str(target).startswith(str(app_dir.resolve())):
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")


def delete_app_files(slug: str) -> None:
    """Remove all deployed files for a given slug."""
    app_dir = APPS_DIR / slug
    if app_dir.exists():
        shutil.rmtree(app_dir)


def preview_url(slug: str) -> str:
    return f"https://{slug}.{BASE_DOMAIN}"
