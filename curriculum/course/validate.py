#!/usr/bin/env python3
"""Full validation pipeline for the generated course.

1. JSON Schema (curriculum/lesson.schema.json, Draft 2020-12).
   NOTE: the runtime (src/types UserLevel, lessonService.levels) has an A0 level
   that the schema enum lacks. A0 lessons are validated against the schema with
   only the `level` enum widened to include "A0"; every other rule is unchanged.
2. Semantic QA: node scripts/qa-lessons.ts lessons
3. Runtime compatibility: node curriculum/course/runtime-check.ts lessons
"""
import copy
import json
import subprocess
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2]
schema = json.loads((ROOT / "curriculum/lesson.schema.json").read_text())
strict = Draft202012Validator(schema)
a0_schema = copy.deepcopy(schema)
a0_schema["$defs"]["lesson"]["properties"]["level"]["enum"].append("A0")
a0 = Draft202012Validator(a0_schema)

targets = sys.argv[1:] or ["lessons"]
files = sorted({p for t in targets for p in ([Path(t)] if Path(t).is_file() else Path(t).rglob("*.json"))})
bad = 0
a0_count = 0
for f in files:
    data = json.loads(f.read_text())
    is_a0 = any(l.get("level") == "A0" for l in data["lessons"])
    a0_count += is_a0
    v = a0 if is_a0 else strict
    errs = list(v.iter_errors(data))
    for e in errs[:5]:
        print(f"SCHEMA {f}: {'/'.join(map(str, e.path))}: {e.message[:200]}")
    bad += bool(errs)
print(f"schema: {len(files) - bad}/{len(files)} files valid ({a0_count} A0 files validated with level enum + A0)")
rc = 1 if bad else 0
for cmd in (["node", "scripts/qa-lessons.ts", *targets], ["node", "curriculum/course/runtime-check.ts", *targets]):
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    out = (r.stdout + r.stderr).strip().splitlines()
    print("\n".join(out[:60]))
    rc = rc or r.returncode
sys.exit(rc)
