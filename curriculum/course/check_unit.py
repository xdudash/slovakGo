"""Check a single unit source file (or several) in isolation, without writing lessons/.

usage: python3 curriculum/course/check_unit.py path/to/unit.txt [...]
Prints builder warnings/errors for the given unit(s) and vocabulary collisions with
words already owned by the committed sources in curriculum/course/src.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build  # noqa: E402


def main() -> int:
    paths = [Path(p).resolve() for p in sys.argv[1:]]
    try:
        units = [build.parse_file(p) for p in paths]
        lessons = build.finalize(build.assemble(units))
    except build.SourceError as e:
        print(f"SOURCE ERROR\n{e}")
        return 2
    warns = build.cross_checks(lessons)
    # ownership against the committed sources
    owned = {}
    for p in sorted(build.SRC.rglob("*.txt")):
        if p.resolve() in paths:
            continue
        for line in p.read_text(encoding="utf-8").splitlines():
            if line.startswith("W: "):
                w = line[3:].split(" | ")[0].strip().lower()
                owned.setdefault(w, p.stem)
    for l in lessons:
        for w in l.get("words", []):
            k = w["sk"].strip().lower()
            if k in owned:
                warns.append(f"WARN {l['id']}: word '{w['sk']}' already owned by {owned[k]}")
    for w in warns:
        print(w)
    print(f"checked {len(lessons)} lessons; exercises={sum(len(l['exercises']) for l in lessons)}")
    return 1 if any(w.startswith("ERROR") for w in warns) else 0


if __name__ == "__main__":
    sys.exit(main())
