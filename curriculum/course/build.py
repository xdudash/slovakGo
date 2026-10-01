#!/usr/bin/env python3
"""SlovakGO course builder.

Compiles the compact authoring sources in `curriculum/course/src/**.txt`
into canonical lesson JSON files under `lessons/<LEVEL>/<unit>/<lesson>.json`.

The sources hold only the pedagogical content (theory, words, exercises,
final situation). Everything mechanical — ids, orders, lessonId, option ids,
deterministic shuffling of tokens/lines/options, wordIds, skills, start/words/
result screens, next-lesson links, XP and time estimates — is generated here so
that it is always consistent with the runtime contract.

Usage:  python3 curriculum/course/build.py [--check]
Source syntax: see curriculum/course/AUTHORING.md
"""
from __future__ import annotations

import hashlib
import json
import random
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "curriculum" / "course" / "src"
OUT = ROOT / "lessons"
BLANK = "______"

LEVEL_ORDER = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"]
# The app track has no C2: placementTestService.toCourseLevel maps C2 -> C1,
# so C2 lessons are published on the C1 track after the C1 lessons.
RUNTIME_LEVEL = {"A0": "A0", "A1": "A1", "A2": "A2", "B1": "B1", "B2": "B2", "C1": "C1", "C2": "C1"}
XP = {"A0": 15, "A1": 25, "A2": 30, "B1": 40, "B2": 50, "C1": 60, "C2": 70}

SKILLS = {
    "sc": ["vocabulary", "grammar"], "ms": ["vocabulary"], "tf": ["reading"], "tfl": ["reading"],
    "fb": ["grammar", "writing"], "dd": ["grammar"], "cz": ["grammar", "reading"],
    "wb": ["vocabulary", "grammar"], "dtb": ["grammar"], "cat": ["vocabulary"], "mt": ["vocabulary"],
    "col": ["vocabulary", "natural_language"], "sb": ["grammar", "writing"], "so": ["grammar"],
    "do": ["dialogue"], "dr": ["dialogue"], "bd": ["dialogue", "real_life"], "fe": ["grammar"],
    "ce": ["grammar", "writing"], "tr": ["grammar", "writing"], "rc": ["reading"],
    "mic": ["vocabulary", "nuance"], "np": ["natural_language", "pragmatics"], "tone": ["nuance", "pragmatics"],
    "reg": ["register"], "hm": ["nuance", "pragmatics"], "doc": ["reading", "real_life"],
    "msg": ["reading", "real_life"], "menu": ["reading", "real_life", "numbers"], "sch": ["reading", "real_life", "time"],
}
TYPE = {
    "sc": "single_choice", "ms": "multiple_select", "tf": "true_false", "tfl": "true_false_list",
    "fb": "fill_blank", "dd": "dropdown_blank", "cz": "cloze_text", "wb": "word_bank",
    "dtb": "drag_to_blank", "cat": "drag_to_category", "mt": "matching", "col": "collocation",
    "sb": "sentence_builder", "so": "sentence_order", "do": "dialogue_order", "dr": "dialogue_choose_reply",
    "bd": "branching_dialogue", "fe": "find_error", "ce": "correct_error", "tr": "transformation",
    "rc": "reading_comprehension", "mic": "meaning_in_context", "np": "natural_phrase", "tone": "tone",
    "reg": "register", "hm": "hidden_meaning", "doc": "real_document", "msg": "real_message",
    "menu": "real_menu", "sch": "real_schedule",
}
DEFAULT_INSTR = {
    "sc": "Обери правильну відповідь.", "ms": "Обери всі правильні варіанти.",
    "tf": "Прочитай і виріши: правда чи неправда.", "tfl": "Прочитай текст і оціни кожне твердження.",
    "fb": "Впиши пропущене слово.", "dd": "Обери правильні форми в пропусках.",
    "cz": "Заповни пропуски в тексті.", "wb": "Встав слова з банку в речення.",
    "dtb": "Обери правильну форму для пропуску.", "cat": "Розклади слова за категоріями.",
    "mt": "З’єднай пари.", "col": "З’єднай слова в природні словосполучення.",
    "sb": "Склади речення зі слів.", "so": "Розстав слова в правильному порядку.",
    "do": "Віднови порядок реплік у діалозі.", "dr": "Обери природну відповідь.",
    "bd": "Пройди діалог: обирай доречні відповіді.", "fe": "Знайди слово з помилкою.",
    "ce": "Виправ речення повністю.", "tr": "Перетвори речення за завданням.",
    "rc": "Прочитай текст і дай відповіді.", "mic": "Що означає виділена фраза саме в цьому контексті?",
    "np": "Яка фраза звучить найприродніше в цій ситуації?", "tone": "Визнач тон мовця.",
    "reg": "Визнач стиль (регістр) фрази.", "hm": "Що людина насправді має на увазі?",
    "doc": "Прочитай документ і знайди відповідь.", "msg": "Прочитай повідомлення й обери правильний висновок.",
    "menu": "Подивись на меню й дай відповіді.", "sch": "Подивись на розклад і обери відповідь.",
}
REGISTER_OPTS = [("formal", "Формальний"), ("neutral", "Нейтральний"), ("informal", "Неформальний"), ("slang", "Сленг / фамільярний")]
# option lists whose default language is Ukrainian (meaning/interpretation answers)
UK_OPTS_DEFAULT = {"mic", "tone", "hm", "msg"}


class SourceError(Exception):
    pass


def rng_for(key: str) -> random.Random:
    return random.Random(int(hashlib.sha256(key.encode()).hexdigest()[:12], 16))


def shuffled(items: list, key: str, avoid_identity: bool = True) -> list:
    items = list(items)
    if len(items) < 2:
        return items
    r = rng_for(key)
    for _ in range(50):
        out = items[:]
        r.shuffle(out)
        if not avoid_identity or out != items:
            return out
    return items[1:] + items[:1]


def split_list(s: str) -> list[str]:
    return [p.strip() for p in s.split(";;") if p.strip()]


def fields(s: str, sep: str = "|") -> list[str]:
    parts = re.split(r"\s+" + re.escape(sep) + r"(?:\s+|$)", s.strip())
    while len(parts) > 1 and parts[-1] == "":
        parts.pop()
    return [p.strip() for p in parts]


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:40]


def fold(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


PUNCT = re.compile(r"^[,.!?;:]+$")


def join_tokens(tokens: list[str]) -> str:
    out = ""
    for t in tokens:
        out = out + t if (PUNCT.match(t) or out == "") else out + " " + t
    return out


def tokenize(sentence: str) -> list[str]:
    toks = re.findall(r"[^\s,.!?;:]+|[,.!?;:]+", sentence)
    if join_tokens(toks) != sentence:
        raise SourceError(f"sentence cannot be tokenized losslessly: {sentence!r}")
    return toks


def norm(v: str) -> str:
    return re.sub(r"[.!?]", "", v.strip().lower())


# ---------------------------------------------------------------- parsing

def parse_options(raw: str, uk: bool, key: str, shuffle: bool = True) -> list[dict]:
    items = split_list(raw)
    if not items:
        raise SourceError("empty option list")
    opts = []
    for it in items:
        correct = it.startswith("*")
        label = it[1:].strip() if correct else it
        opts.append((label, correct))
    labels = [l for l, _ in opts]
    if len(set(labels)) != len(labels):
        raise SourceError(f"duplicate option labels: {labels}")
    if shuffle:
        opts = shuffled(opts, key, avoid_identity=False)
    out = []
    for i, (label, correct) in enumerate(opts):
        o = {"id": "abcdefghij"[i]}
        if uk:
            o["text"] = label
        else:
            o["sk"] = label
        o["correct"] = correct
        out.append(o)
    return out


def build_exercise(kind: str, body: str, extra: list[str], ex_id: str, lesson_id: str) -> dict:
    uk_flag = kind.endswith("~")
    kind = kind.rstrip("~")
    sk_flag = kind.endswith("^")  # force Slovak options for default-uk types
    kind = kind.rstrip("^")
    if kind not in TYPE:
        raise SourceError(f"unknown exercise kind {kind!r}")
    f = fields(body)
    arity = {"np": 3, "hm": 3, "tone": 3, "mic": 4, "reg": 3, "dr": 3, "msg": 5, "doc": 5, "sch": 5, "ce": 3, "tr": 3, "tf": 4, "sc": 3, "ms": 3}
    if kind.rstrip("~^") in arity and len(f) == arity[kind.rstrip("~^")] - 1:
        f = ["-"] + f
    instr = f[0] if f and f[0] != "-" else DEFAULT_INSTR[kind]
    ex: dict = {"id": ex_id, "lessonId": lesson_id, "type": TYPE[kind], "skill": list(SKILLS[kind]), "instruction": instr}
    uk_opts = (kind in UK_OPTS_DEFAULT and not sk_flag) or uk_flag
    key = ex_id

    def need(n):
        if len(f) < n:
            raise SourceError(f"{kind}: expected {n} fields, got {len(f)}: {body[:80]}")

    if kind in ("sc", "ms"):
        need(3)
        if f[1] != "-":
            ex["prompt"] = f[1]
        ex["options"] = parse_options(f[2], uk_opts, key)
        n = sum(o["correct"] for o in ex["options"])
        if kind == "sc" and n != 1:
            raise SourceError(f"single_choice needs exactly 1 correct: {body[:80]}")
        if kind == "ms" and n < 2:
            raise SourceError(f"multiple_select needs >=2 correct: {body[:80]}")
    elif kind == "tf":
        need(4)
        if f[1] != "-":
            ex["text"] = f[1]
        ex["statement"] = f[2]
        if f[3] not in ("T", "F"):
            raise SourceError("tf answer must be T or F")
        ex["correctAnswer"] = f[3] == "T"
    elif kind == "tfl":
        need(3)
        ex["text"] = f[1]
        sts = []
        for it in split_list(f[2]):
            c = it.startswith("*")
            sts.append({"sk": it[1:].strip() if c else it, "correct": c})
        if len(sts) < 3 or all(s["correct"] for s in sts) or not any(s["correct"] for s in sts):
            raise SourceError("tfl needs >=3 statements with both true and false")
        ex["statements"] = sts
    elif kind == "fb":
        need(3)
        if "___" not in f[1]:
            raise SourceError("fill_blank sentence needs ___")
        ex["sentence"] = re.sub(r"_{3,}", BLANK, f[1])
        ex["acceptedAnswers"] = split_list(f[2])
        if len(f) > 3 and f[3] != "-":
            ex["hint"] = f[3]
    elif kind == "dd":
        need(2)
        parts, pos, bi = [], 0, 0
        for m in re.finditer(r"\[([^\]]+)\]", f[1]):
            if m.start() > pos:
                parts.append({"text": f[1][pos:m.start()]})
            bi += 1
            raw = [o.strip() for o in m.group(1).split("/")]
            correct = [o[1:] for o in raw if o.startswith("*")]
            if len(correct) != 1:
                raise SourceError(f"dropdown blank needs one *correct: {m.group(0)}")
            opts = [o.lstrip("*") for o in raw]
            if len(set(opts)) != len(opts):
                raise SourceError(f"dropdown duplicate options {opts}")
            parts.append({"blankId": f"b{bi}", "options": shuffled(opts, f"{key}-b{bi}", False), "correct": correct[0]})
            pos = m.end()
        if pos < len(f[1]):
            parts.append({"text": f[1][pos:]})
        if bi == 0:
            raise SourceError("dropdown needs a [..] blank")
        ex["sentenceParts"] = parts
    elif kind == "cz":
        need(2)
        parts, pos, bi = [], 0, 0
        for m in re.finditer(r"\{([^}]+)\}", f[1]):
            if m.start() > pos:
                parts.append({"text": f[1][pos:m.start()]})
            bi += 1
            parts.append({"blankId": f"b{bi}", "acceptedAnswers": [o.strip() for o in m.group(1).split("/")]})
            pos = m.end()
        if pos < len(f[1]):
            parts.append({"text": f[1][pos:]})
        if bi == 0:
            raise SourceError("cloze needs {..} blanks")
        ex["textParts"] = parts
        if len(f) > 2 and f[2] != "-":
            ex["hint"] = f[2]
    elif kind == "wb":
        need(2)
        items, answers = [], []
        for s in split_list(f[1]):
            m = re.search(r"\[([^\]]+)\]", s)
            if not m:
                raise SourceError(f"word_bank item needs [answer]: {s}")
            items.append({"sentence": s[:m.start()] + BLANK + s[m.end():], "correct": m.group(1)})
            answers.append(m.group(1))
        extras = split_list(f[2]) if len(f) > 2 and f[2] != "-" else []
        uniq = list(dict.fromkeys(answers))
        ex["wordBank"] = shuffled(uniq, key + "-bank", False)
        ex["items"] = items
        if extras:
            if set(extras) & set(uniq):
                raise SourceError("word_bank extra duplicates an answer")
            ex["extraWords"] = extras
    elif kind == "dtb":
        need(2)
        m = re.search(r"\[([^\]]+)\]", f[1])
        if not m:
            raise SourceError("drag_to_blank needs [*c/o/o]")
        raw = [o.strip() for o in m.group(1).split("/")]
        correct = [o[1:] for o in raw if o.startswith("*")]
        if len(correct) != 1:
            raise SourceError("drag_to_blank needs exactly one *correct")
        ex["sentence"] = f[1][:m.start()] + BLANK + f[1][m.end():]
        ex["draggable"] = shuffled([o.lstrip("*") for o in raw], key, False)
        ex["correct"] = correct[0]
    elif kind == "cat":
        need(2)
        cats, items = [], []
        for i, grp in enumerate(split_list(f[1])):
            title, _, rest = grp.partition(":")
            cid = f"c{i + 1}"
            cats.append({"id": cid, "title": title.strip()})
            for it in rest.split(","):
                if it.strip():
                    items.append({"sk": it.strip(), "category": cid})
        if len(cats) < 2 or len(items) < 4:
            raise SourceError("category sort needs >=2 categories and >=4 items")
        ex["categories"] = cats
        ex["items"] = shuffled(items, key)
    elif kind in ("mt", "col"):
        need(2)
        pairs = []
        for p in split_list(f[1]):
            if " = " not in p:
                raise SourceError(f"pair needs ' = ': {p}")
            l, r = p.split(" = ", 1)
            pairs.append({"left": l.strip(), "right": r.strip()})
        if len(pairs) < 3:
            raise SourceError("matching needs >=3 pairs")
        if len({p['right'] for p in pairs}) != len(pairs) or len({p['left'] for p in pairs}) != len(pairs):
            raise SourceError("matching sides must be unique")
        ex["pairs"] = pairs
    elif kind in ("sb", "so"):
        need(3)
        if f[1] != "-":
            ex["context"] = f[1]
        sent = f[2]
        toks = tokenize(sent)
        if len(toks) < 3:
            raise SourceError("sentence too short for builder")
        ex["tokens"] = shuffled(toks, key)
        if kind == "sb":
            ex["correctSentence"] = sent
        else:
            ex["correctOrder"] = toks
    elif kind == "do":
        need(2)
        lines = [{"id": f"l{i + 1}", "sk": s} for i, s in enumerate(split_list(f[1]))]
        if len(lines) < 3:
            raise SourceError("dialogue_order needs >=3 lines")
        ex["lines"] = shuffled(lines, key)
        ex["correctOrder"] = [l["id"] for l in lines]
    elif kind == "dr":
        need(3)
        dlg = []
        for s in split_list(f[1]):
            spk, sep, txt = s.partition(": ")
            dlg.append({"speaker": spk.strip(), "sk": txt.strip()} if sep else {"sk": s})
        ex["dialogue"] = dlg
        ex["options"] = parse_options(f[2], uk_opts, key)
        if sum(o["correct"] for o in ex["options"]) != 1:
            raise SourceError("dialogue_choose_reply needs exactly 1 correct")
    elif kind == "bd":
        ex["successMessage"] = f[1] if len(f) > 1 and f[1] != "-" else "Чудово! Діалог пройдено."
        nodes_src = [e[1:].strip() for e in extra if e.startswith(">")]
        if len(nodes_src) < 2:
            raise SourceError("branching dialogue needs >=2 '>' nodes")
        nodes = {}
        for i, ns in enumerate(nodes_src):
            nf = fields(ns)
            spk, sep, txt = nf[0].partition(": ")
            nid, nxt = f"n{i + 1}", (f"n{i + 2}" if i + 1 < len(nodes_src) else "success")
            choices = []
            raw = split_list(nf[1])
            if sum(c.startswith("*") for c in raw) != 1:
                raise SourceError("each branching node needs exactly one *best")
            for j, c in enumerate(raw):
                best = c.startswith("*")
                choices.append({"id": f"{nid}c{j + 1}", "sk": c.lstrip("*").strip(), "next": nxt if best else "fail", "quality": "best" if best else "wrong"})
            node = {"sk": txt.strip() if sep else nf[0]}
            if sep:
                node = {"speaker": spk.strip(), "sk": txt.strip()}
            node["choices"] = shuffled(choices, f"{key}-{nid}", False)
            nodes[nid] = node
        ex["startNode"] = "n1"
        ex["nodes"] = nodes
    elif kind == "fe":
        need(2)
        m = re.search(r"\[([^\]>]+)>([^\]]+)\]", f[1])
        if not m:
            raise SourceError("find_error needs [wrong>right]")
        wrong, right = m.group(1).strip(), m.group(2).strip()
        after = f[1][m.end():m.end() + 1]
        if after and after not in " .!?":
            raise SourceError(f"find_error token must not be glued to punctuation {after!r}")
        sentence = f[1][:m.start()] + wrong + f[1][m.end():]
        if sum(1 for w in sentence.split() if norm(w) == norm(wrong)) != 1:
            raise SourceError(f"find_error token {wrong!r} must occur exactly once")
        ex["sentence"] = sentence
        ex["errorToken"] = wrong
        ex["correctToken"] = right
    elif kind in ("ce", "tr"):
        need(3)
        ex["sentence" if kind == "ce" else "source"] = f[1]
        ex["acceptedAnswers"] = split_list(f[2])
    elif kind == "rc":
        need(2)
        ex["text"] = f[1]
        qs = []
        for e in extra:
            if e.startswith("q~:") or e.startswith("q:"):
                ukq = e.startswith("q~:")
                qf = fields(e.split(":", 1)[1].strip())
                qs.append({"question": qf[0], "options": parse_options(qf[1], ukq, f"{key}-q{len(qs)}")})
        if not qs:
            raise SourceError("reading_comprehension needs q: lines")
        for q in qs:
            if sum(o["correct"] for o in q["options"]) != 1:
                raise SourceError("rc question needs exactly one correct")
        ex["questions"] = qs
    elif kind in ("mic", "hm", "tone"):
        if kind == "mic":
            need(4)
            ex["context"], ex["target"] = f[1], f[2]
            ex["options"] = parse_options(f[3], uk_opts, key)
        else:
            need(3)
            ex["context"] = f[1]
            ex["options"] = parse_options(f[2], uk_opts, key)
    elif kind == "np":
        need(3)
        ex["situation"] = f[1]
        ex["options"] = parse_options(f[2], uk_opts, key)
    elif kind == "reg":
        need(3)
        ex["phrase"] = f[1]
        ans = f[2].strip()
        ids = [i for i, _ in REGISTER_OPTS]
        if ans not in ids:
            raise SourceError(f"register answer must be one of {ids}")
        use = REGISTER_OPTS if ans == "slang" or (len(f) > 3 and f[3] == "4") else REGISTER_OPTS[:3]
        ex["options"] = [{"id": i, "text": t, "correct": i == ans} for i, t in use]
    elif kind == "doc":
        need(5)
        flds = []
        for p in split_list(f[2]):
            lab, _, val = p.partition(": ")
            flds.append({"label": lab.strip(), "value": val.strip()})
        ex["document"] = {"title": f[1], "fields": flds}
        ex["question"] = f[3]
        ex["options"] = parse_options(f[4], uk_opts, key)
    elif kind == "msg":
        need(5)
        ex["message"] = {"sender": f[1], "body": f[2]}
        ex["question"] = f[3]
        ex["options"] = parse_options(f[4], uk_opts, key)
    elif kind == "sch":
        need(5)
        rows = []
        for p in split_list(f[2]):
            d, _, h = p.partition(" = ")
            rows.append({"day": d.strip(), "hours": h.strip()})
        ex["schedule"] = {"title": f[1], "rows": rows}
        ex["question"] = f[3]
        ex["options"] = parse_options(f[4], uk_opts, key)
    elif kind == "menu":
        need(2)
        rows = []
        for p in split_list(f[1]):
            cat, _, rest = p.partition(": ")
            item, _, price = rest.partition(" = ")
            rows.append({"category": cat.strip(), "item": item.strip(), "price": price.strip()})
        ex["menuData"] = rows
        qs = []
        for e in extra:
            if e.startswith("q~:") or e.startswith("q:"):
                ukq = e.startswith("q~:")
                qf = fields(e.split(":", 1)[1].strip())
                qs.append({"question": qf[0], "options": parse_options(qf[1], ukq, f"{key}-q{len(qs)}")})
        if not qs:
            raise SourceError("real_menu needs q: lines")
        ex["questions"] = qs

    if kind in ("sc", "ms", "dr", "mic", "hm", "tone", "np", "doc", "msg", "sch") and len(ex.get("options", [])) < 2:
        raise SourceError(f"{kind}: needs >= 2 options")

    for e in extra:
        if e.startswith("= "):
            ex["explanation"] = e[2:].strip()
        elif e.startswith("h: "):
            ex["hint"] = e[3:].strip()
        elif e.startswith("d: "):
            ex["difficulty"] = e[3:].strip()
    return ex


def parse_file(path: Path) -> dict:
    unit = None
    lessons = []
    cur = None
    last = None  # last block receiving continuation lines
    for ln, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.rstrip()
        if not line.strip() or line.lstrip().startswith("//"):
            continue
        try:
            if line.startswith("@unit "):
                f = fields(line[6:])
                if len(f) == 4:
                    f = [f[0], f[2], f[3]]
                if len(f) != 3:
                    raise SourceError("@unit needs 'code | topic uk | topic sk'")
                unit = {"code": f[0], "level": f[0][:2].upper(), "topic": f[1], "topicSk": f[2], "file": path}
                continue
            if line.startswith("@lesson "):
                f = fields(line[8:])
                cur = {"slug": f[0], "title": f[1], "titleSk": f[2], "theory": [], "words": [], "ex": [], "steps": [], "line": ln}
                lessons.append(cur)
                last = None
                continue
            if cur is None:
                raise SourceError("content before @lesson")
            s = line.strip()
            head, sep, rest = s.partition(": ")
            if line.startswith(" ") or line.startswith("\t") or s.startswith("> ") or s.startswith("= ") or re.match(r"^(q~?|h|d): ", s):
                if last is None:
                    raise SourceError("continuation line without block")
                last["extra"].append(s)
                continue
            if head in ("desc", "goal", "done", "intro"):
                cur[head] = rest.strip()
            elif head == "out":
                cur["out"] = split_list(rest)
            elif head == "R":
                cur["now"] = split_list(rest)
            elif head == "T":
                tf = [p.strip() for p in rest.split("||")]
                th = {"title": tf[0], "text": tf[1] if len(tf) > 1 else ""}
                if len(tf) > 2 and tf[2]:
                    exs = []
                    for p in split_list(tf[2]):
                        if " = " not in p:
                            raise SourceError(f"theory example needs ' = ': {p}")
                        a, b = p.split(" = ", 1)
                        exs.append({"sk": a.strip(), "uk": b.strip()})
                    th["examples"] = exs
                if len(tf) > 3 and tf[3]:
                    th["shortRule"] = tf[3]
                cur["theory"].append(th)
                last = None
            elif head in ("mis", "dlg", "pr", "grp", "fp"):
                if not cur["theory"]:
                    raise SourceError(f"{head} before any T:")
                th = cur["theory"][-1]
                if head == "mis":
                    th["commonMistakes"] = [{"mistake": a.strip(), "correct": b.strip()} for a, b in (p.split("=>", 1) for p in split_list(rest))]
                elif head == "dlg":
                    lines = []
                    for p in split_list(rest):
                        spk, _, t = p.partition(": ")
                        skp, _, ukp = t.partition(" = ")
                        lines.append({"speaker": spk.strip(), "sk": skp.strip(), "uk": ukp.strip()})
                    th["dialogue"] = lines
                elif head == "pr":
                    rows = []
                    for p in split_list(rest):
                        a = fields(p)
                        rows.append({"letter": a[0], "readUk": a[1], "exampleSk": a[2], "exampleUk": a[3]})
                    th["pronunciationRows"] = rows
                elif head == "grp":
                    gs = []
                    for p in split_list(rest):
                        a = fields(p)
                        g = {"title": a[0], "letters": a[1].split()}
                        if len(a) > 2:
                            g["noteUk"] = a[2]
                        gs.append(g)
                    th["alphabetGroups"] = gs
                elif head == "fp":
                    th["focusPoints"] = split_list(rest)
            elif head == "W":
                w = fields(rest)
                if len(w) != 5:
                    raise SourceError(f"W needs 5 fields: {rest}")
                cur["words"].append(dict(zip(["sk", "uk", "pron", "exSk", "exUk"], w)))
            elif head.startswith("X "):
                block = {"kind": head[2:].strip(), "body": rest, "extra": [], "line": ln}
                cur["ex"].append(block)
                last = block
            elif head == "F":
                tf = [p.strip() for p in rest.split("||")]
                cur["final"] = {"title": tf[0], "description": tf[1] if len(tf) > 1 else ""}
                last = None
            elif head in ("S", "S~"):
                f = fields(rest)
                if len(f) != 2:
                    raise SourceError(f"S needs 'prompt | options': {rest[:60]}")
                cur["steps"].append({"prompt": f[0], "opts": f[1], "uk": head == "S~"})
            else:
                raise SourceError(f"unknown line: {s[:60]}")
        except (SourceError, IndexError, ValueError) as e:
            raise SourceError(f"{path.relative_to(ROOT)}:{ln}: {type(e).__name__}: {e}") from None
    if unit is None:
        raise SourceError(f"{path}: missing @unit")
    return {"unit": unit, "lessons": lessons}


# ---------------------------------------------------------------- assembly

def word_stems(w: str) -> list[str]:
    out = []
    for tok in re.findall(r"[^\W\d_]+", w.lower()):
        if len(tok) >= 4:
            out.append(tok[: max(4, len(tok) - 2)])
    return out


def ex_text(ex: dict) -> str:
    return json.dumps({k: v for k, v in ex.items() if k not in ("instruction", "explanation", "hint")}, ensure_ascii=False).lower()


def assemble(units: list[dict]) -> list[dict]:
    built = []
    errors = []
    for u in units:
        unit = u["unit"]
        code, lvl = unit["code"], unit["level"]
        if lvl not in LEVEL_ORDER:
            errors.append(f"{code}: bad level {lvl}")
            continue
        for li, L in enumerate(u["lessons"], 1):
            lid = f"{code}-l{li:02d}-{L['slug']}"
            try:
                built.append(assemble_lesson(unit, L, lid, li))
            except SourceError as e:
                errors.append(f"{unit['file'].relative_to(ROOT)} [{L['slug']}]: {e}")
    if errors:
        raise SourceError("\n".join(errors))
    return built


def assemble_lesson(unit: dict, L: dict, lid: str, li: int) -> dict:
    lvl = unit["level"]
    for k in ("desc", "goal", "out", "done"):
        if k not in L:
            raise SourceError(f"missing {k}:")
    if len(L["theory"]) < 2:
        raise SourceError("needs >=2 theory screens")
    if len(L["words"]) < 4:
        raise SourceError("needs >=4 words")
    if len(L["ex"]) < 10:
        raise SourceError(f"needs >=10 exercises (has {len(L['ex'])})")
    if len(L["steps"]) < 3 or "final" not in L:
        raise SourceError("needs F: and >=3 S: steps")

    words = []
    for wi, w in enumerate(L["words"], 1):
        words.append({
            "id": f"{lid}-w{wi:02d}", "sk": w["sk"], "uk": w["uk"], "pronunciationUk": w["pron"],
            "exampleSk": w["exSk"], "exampleUk": w["exUk"], "level": RUNTIME_LEVEL[lvl],
            "topic": unit["topic"], "tags": [unit["code"], lvl.lower()],
        })
    exercises = []
    for ei, b in enumerate(L["ex"], 1):
        eid = f"{lid}-ex{ei:02d}"
        try:
            ex = build_exercise(b["kind"], b["body"], b["extra"], eid, lid)
        except SourceError as e:
            raise SourceError(f"line {b['line']}: {e}")
        ex["order"] = ei
        text = ex_text(ex)
        wids = [w["id"] for w in words if any(st in text for st in word_stems(w["sk"])) or w["sk"].lower() in text]
        if wids:
            ex["wordIds"] = wids
        exercises.append(ex)

    steps = []
    for si, s in enumerate(L["steps"], 1):
        raw = split_list(s["opts"])
        opts = []
        for o in raw:
            c = o.startswith("*")
            opts.append({("text" if s["uk"] else "sk"): o.lstrip("*").strip(), "correct": c})
        if sum(o["correct"] for o in opts) != 1:
            raise SourceError(f"final step {si} needs exactly one correct")
        if len({o.get("sk", o.get("text")) for o in opts}) != len(opts):
            raise SourceError(f"final step {si} duplicate labels")
        steps.append({"id": f"f{si}", "prompt": s["prompt"], "options": shuffled(opts, f"{lid}-f{si}", False)})
    n = len(steps)
    final = {
        "id": "final-situation", "type": "interactive_scenario",
        "title": L["final"]["title"], "description": L["final"]["description"],
        "steps": steps, "passRequirement": f"{n - 1 if n >= 4 else n}/{n}",
        "successMessage": "Ситуацію вирішено! " + L["done"],
    }

    theory = []
    for ti, t in enumerate(L["theory"], 1):
        th = {"id": f"theory-{ti}", "screenType": "theory", "order": ti, "title": t["title"], "text": t["text"]}
        for k in ("examples", "shortRule", "commonMistakes", "dialogue", "pronunciationRows", "alphabetGroups", "focusPoints"):
            if k in t:
                th[k] = t[k]
        th["button"] = "Далі →"
        theory.append(th)

    xp = XP[lvl]
    minutes = max(8, round(len(theory) * 1.2 + len(words) * 0.4 + len(exercises) * 0.9 + n * 0.6))
    eyebrow = f"{lvl} · {unit['topic']}"
    stray = re.findall(r'"([^"]*\|[^"]*)"', json.dumps([exercises, steps, theory, words], ensure_ascii=False))
    if stray:
        raise SourceError(f"stray '|' separator leaked into content: {stray[:3]}")
    lesson = {
        "id": lid,
        "sectionId": unit["code"],
        "level": RUNTIME_LEVEL[lvl],
        "title": L["title"],
        "topic": unit["topic"],
        "description": L["desc"],
        "order": 0,  # filled later
        "xpReward": xp,
        "estimatedMinutes": minutes,
        "isPublished": True,
        "intro": L.get("intro", L["goal"]),
        "completionMessage": L["done"],
        "updatedAt": "2026-10-01T00:00:00+02:00",
        "localization": {"uiLanguages": ["uk"], "targetLanguage": "sk", "fallbackUiLanguage": "uk"},
        "startScreen": {
            "screenType": "lesson_start", "eyebrow": eyebrow, "title": L["title"],
            "shortDescription": L["goal"], "outcomes": L["out"],
            "newWords": [w["sk"] for w in words], "exercisesCount": len(exercises),
            "reward": f"+{xp} XP", "estimatedMinutes": minutes, "button": "Почати урок →",
        },
        "theoryScreens": theory,
        "wordsScreen": {
            "screenType": "lesson_words", "title": "Нові слова й фрази",
            "subtitle": "Прочитай кожне слово з прикладом — далі вони будуть у вправах.",
            "items": [{"wordId": w["id"], "sk": w["sk"], "uk": w["uk"], "pronunciationUk": w["pronunciationUk"],
                       "exampleSk": w["exampleSk"], "exampleUk": w["exampleUk"]} for w in words],
            "button": "До вправ →",
        },
        "words": words,
        "exercises": exercises,
        "finalSituation": final,
        "resultScreen": {
            "screenType": "lesson_result", "title": "Урок завершено!", "text": L["done"],
            "nowYouKnow": L.get("now", L["out"]), "newWordsCount": len(words),
            "exercisesCompleted": len(exercises), "xpReward": xp,
            "mistakesMessage": "Повторити помилки",
            "buttons": ["Продовжити", "Пройти ще раз", "Повторити помилки"],
        },
        "_meta": {"cefr": lvl, "unit": unit["code"], "unitTopicSk": unit["topicSk"], "titleSk": L["titleSk"], "index": li},
    }
    return lesson


def finalize(lessons: list[dict]) -> list[dict]:
    lessons.sort(key=lambda l: (LEVEL_ORDER.index(l["_meta"]["cefr"]), l["_meta"]["unit"], l["_meta"]["index"]))
    counters: dict[str, int] = {}
    for l in lessons:
        rl = l["level"]
        counters[rl] = counters.get(rl, 0) + 1
        l["order"] = counters[rl]
    for i, l in enumerate(lessons):
        nxt = lessons[i + 1] if i + 1 < len(lessons) else None
        if nxt:
            l["resultScreen"]["nextLesson"] = {"id": nxt["id"], "title": nxt["title"]}
    return lessons


def cross_checks(lessons: list[dict]) -> list[str]:
    warn = []
    seen: dict[str, str] = {}
    ids = set()
    for l in lessons:
        if l["id"] in ids:
            warn.append(f"ERROR duplicate lesson id {l['id']}")
        ids.add(l["id"])
        for w in l["words"]:
            k = w["sk"].lower().strip()
            if k in seen:
                warn.append(f"WARN word '{w['sk']}' owned by {seen[k]} and {l['id']}")
            else:
                seen[k] = l["id"]
        types = [e["type"] for e in l["exercises"]]
        for t in set(types):
            if types.count(t) > (7 if l["level"] == "A0" else 4):
                warn.append(f"WARN {l['id']}: type {t} used {types.count(t)}x")
        noexp = [e["id"] for e in l["exercises"] if "explanation" not in e and e["type"] not in ("matching", "collocation", "drag_to_category", "dialogue_order", "branching_dialogue", "true_false_list", "reading_comprehension", "real_menu", "word_bank", "cloze_text")]
        if len(noexp) > len(l["exercises"]) // 3:
            warn.append(f"WARN {l['id']}: {len(noexp)} exercises without explanation")
    return warn


def main() -> int:
    files = sorted(SRC.rglob("*.txt"))
    units = [parse_file(p) for p in files]
    lessons = finalize(assemble(units))
    warns = cross_checks(lessons)
    check = "--check" in sys.argv
    written = set()
    for l in lessons:
        meta = l.pop("_meta")
        folder = OUT / meta["cefr"] / meta["unit"]
        path = folder / f"{l['id']}.json"
        written.add(path)
        if not check:
            folder.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps({"lessons": [l]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if not check:
        for stale in OUT.rglob("*.json"):
            if stale not in written:
                stale.unlink()
    for w in warns:
        print(w)
    by = {}
    for l in lessons:
        by[l["level"]] = by.get(l["level"], 0) + 1
    print(f"built {len(lessons)} lessons from {len(files)} unit files: {by}; exercises={sum(len(l['exercises']) for l in lessons)}")
    return 1 if any(w.startswith("ERROR") for w in warns) else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SourceError as e:
        print(f"SOURCE ERROR\n{e}")
        sys.exit(2)
