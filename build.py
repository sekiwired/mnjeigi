"""Build the English pages at the root and the French pages under fr/, from templates/ and content/.

Run from the repo root:  uv run --with jinja2 --with pyyaml python build.py

Mission texts are read from the validated documents in MISSIONS_DIR; nothing in
this repo holds a copy of them. The build stops if a quote cannot be found.
"""
import re
import sys
from pathlib import Path

import yaml
from jinja2 import Environment, FileSystemLoader, StrictUndefined
from markupsafe import Markup, escape

ROOT = Path(__file__).parent
CONTENT = ROOT / "content"
MISSIONS_DIR = Path.home() / "Documents/Money26/Freelance/Resources"
MISSIONS_FILE = {"en": "Detailed_Missions_EN.md", "fr": "Detailed_Missions_FR.md"}
SITE_URL = "https://juliengrimal.com/"
LANGS = ("en", "fr")
LEGAL_PAGES = ("privacy", "terms")


def load(path):
    return yaml.safe_load((CONTENT / path).read_text(encoding="utf-8"))


def parse_missions(lang):
    """Return {heading: {role, period, context, challenges, results, stack}} from the missions document."""
    text = (MISSIONS_DIR / MISSIONS_FILE[lang]).read_text(encoding="utf-8")
    missions = {}
    for chunk in re.split(r"^## ", text, flags=re.M)[1:]:
        lines = chunk.strip().splitlines()
        key = lines[0].strip()
        header = next(l for l in lines[1:] if l.startswith("**") and "|" in l)
        role, period = (part.strip() for part in header.strip("* ").rsplit("|", 1))
        sections, stack = [], []
        for line in lines[1:]:
            line = line.strip()
            if line.startswith("### "):
                sections.append({"paragraphs": [], "bullets": []})
            elif line.startswith("**Stack:**"):
                stack = [s.strip() for s in line.removeprefix("**Stack:**").split(",")]
            elif line.startswith("- ") and sections:
                sections[-1]["bullets"].append(line[2:].strip())
            elif line and line != "---" and not line.startswith("**") and sections:
                sections[-1]["paragraphs"].append(line)
        if len(sections) != 3:
            sys.exit(f"{MISSIONS_FILE[lang]}: '{key}' has {len(sections)} sections, expected context/challenges/results")
        missions[key] = {
            "role": role, "period": period, "stack": stack,
            "context": sections[0], "challenges": sections[1], "results": sections[2],
        }
    return missions


def years(mission):
    """(last year, first year) of a mission period such as '2013 – 2016', to order the career record by time."""
    found = [int(y) for y in re.findall(r"\d{4}", mission["period"])]
    return (max(found), min(found))


def quote(missions, lang, mission, has, mark=None):
    """Return the one result line of `mission` containing `has`, with `mark` emphasised."""
    if mission not in missions:
        sys.exit(f"[{lang}] quote: no mission '{mission}'")
    hits = [b for b in missions[mission]["results"]["bullets"] if has in b]
    if len(hits) != 1:
        sys.exit(f"[{lang}] quote: '{has}' matches {len(hits)} result lines of '{mission}', expected 1")
    line = hits[0]
    if not mark:
        return escape(line)
    if mark not in line:
        sys.exit(f"[{lang}] quote: mark '{mark}' not in '{line}'")
    before, after = line.split(mark, 1)
    return Markup(f"{escape(before)}<mark>{escape(mark)}</mark>{escape(after)}")


def french_spacing(html):
    """Bind French high punctuation to the preceding word with a non-breaking space, outside scripts."""
    def fix(segment):
        segment = re.sub(r"(?<=[^\s>]) ([?!;:»])", " \\1", segment)
        return segment.replace("« ", "« ")
    parts = re.split(r"(<script.*?</script>)", html, flags=re.S)
    return "".join(p if p.startswith("<script") else fix(p) for p in parts)


def curly_apostrophes(html):
    """Replace straight apostrophes with typographic ones in visible text (not in tags, scripts or styles)."""
    parts = re.split(r"(<script.*?</script>|<style.*?</style>|<[^>]+>)", html, flags=re.S)
    return "".join(p if p.startswith("<") else p.replace("'", "’").replace("&#39;", "’") for p in parts)


def build(lang, env, logos, mission_list):
    copy = load(f"{lang}/copy.yaml")
    missions = parse_missions(lang)
    logo_by_id = {l["id"]: l for l in logos}

    unknown = [m["key"] for m in mission_list if m["key"] not in missions]
    missing = [k for k in missions if k not in {m["key"] for m in mission_list}]
    if unknown or missing:
        sys.exit(f"[{lang}] missions.yaml out of step with {MISSIONS_FILE[lang]}: unknown={unknown} missing={missing}")

    record = [{**m, **missions[m["key"]], "logos": [logo_by_id[i] for i in m["logos"]]} for m in mission_list]
    record.sort(key=years, reverse=True)
    by_key = {m["key"]: m for m in record}

    shared = dict(
        c=copy,
        root="../" if copy["path"] else "",
        site_url=SITE_URL,
        langs=[load(f"{l}/copy.yaml") for l in LANGS],
    )
    html = env.get_template("index.html.j2").render(
        **shared,
        page_file="", home="", robots="index, follow",
        page_title=copy["meta"]["title"], page_description=copy["meta"]["description"],
        logos=logos,
        record=record,
        by_key=by_key,
        catalogue=load(f"{lang}/catalogue.yaml"),
        inventory=load(f"{lang}/inventory.yaml"),
        quote=lambda mission, has, mark=None: quote(missions, lang, mission, has, mark),
    )
    write(lang, copy, "index.html", html)
    print(f"built {copy['path']}index.html  ({len(record)} missions, {len(logos)} logos)")

    for page in LEGAL_PAGES:
        body = (CONTENT / lang / f"{page}.html").read_text(encoding="utf-8")
        title = re.search(r"<h1>(.*?)</h1>", body).group(1)
        html = env.get_template("legal.html.j2").render(
            **shared,
            page_file=f"{page}.html", home="./", robots="noindex, follow",
            page_title=f"{title} — Julien Grimal", page_description=title, body=body,
        )
        write(lang, copy, f"{page}.html", html)
        print(f"built {copy['path']}{page}.html")


def write(lang, copy, name, html):
    html = curly_apostrophes(html)
    if lang == "fr":
        html = french_spacing(html)
    out = ROOT / copy["path"] / name
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")


def main():
    env = Environment(
        loader=FileSystemLoader(ROOT / "templates"),
        autoescape=True, undefined=StrictUndefined, trim_blocks=True, lstrip_blocks=True,
    )
    logos, mission_list = load("logos.yaml"), load("missions.yaml")
    for lang in LANGS:
        build(lang, env, logos, mission_list)


if __name__ == "__main__":
    main()
