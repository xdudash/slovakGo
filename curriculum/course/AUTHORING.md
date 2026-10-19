# SlovakGO course sources — authoring syntax

Sources live in `curriculum/course/src/<LEVEL>/<unit>.txt` (one unit = 10 lessons).
`python3 curriculum/course/build.py` compiles them to `lessons/<LEVEL>/<unit>/<lesson-id>.json`
(one lesson per file, root `{"lessons":[...]}`). `python3 curriculum/course/validate.py`
runs JSON Schema + `scripts/qa-lessons.ts` + `curriculum/course/runtime-check.ts`
(real checker code, renderer-shaped answers). Never edit `lessons/` by hand — edit sources and rebuild.

Separators: ` | ` fields · ` ;; ` list items · ` = ` pairs · `*` marks correct · `-` = empty/default field.
Lines starting with `//` are comments.

```
@unit a1-u03 | A1 | <topic uk> | <topic sk>
@lesson <slug> | <title uk> | <title sk>
desc: …            goal: …           done: …  (completion)
out: outcome ;; outcome ;; outcome
T: title || text || sk = uk ;; sk = uk || short rule        (theory screen)
  mis: wrong => right ;; …     dlg: Spk: sk = uk ;; …     fp: point ;; …
  pr: letter | read | exSk | exUk ;; …    grp: title | l1 l2 | note ;; …
W: sk | uk | pronunciationUk | exampleSk | exampleUk
X <kind>: <instruction|-> | fields…      followed by optional
  = explanation      h: hint      q: …   > node…
F: final title || description
S: prompt | *opt ;; opt          (S~ = options are Ukrainian text)
R: now-you-know ;; …             (optional, defaults to out:)
```

Exercise kinds (`~` after kind = options are Ukrainian; `^` = force Slovak for mic/hm/tone/msg):

| kind | type | fields after instruction |
|---|---|---|
| sc / ms | single_choice / multiple_select | prompt | *opt ;; opt |
| tf | true_false | text or - | statement | T/F |
| tfl | true_false_list | text | *true stmt ;; false stmt |
| fb | fill_blank | sentence with ___ | ans ;; alt | hint? |
| dd | dropdown_blank | text [*right/wrong] text [..] |
| cz | cloze_text | text {ans/alt} text {ans} | hint? |
| wb | word_bank | sentence [ans] ;; sentence [ans] | extra ;; extra |
| dtb | drag_to_blank | sentence [*right/wrong/wrong] |
| cat | drag_to_category | Title: a, b ;; Title: c, d |
| mt / col | matching / collocation | left = right ;; … |
| sb / so | sentence_builder / sentence_order | context or - | Correct sentence. |
| do | dialogue_order | line ;; line (correct order) |
| dr | dialogue_choose_reply | Spk: line ;; … | *opt ;; opt |
| bd | branching_dialogue | success msg; then `> Spk: text | *best ;; wrong` lines |
| fe | find_error | sentence with [wrong>right] |
| ce / tr | correct_error / transformation | source | acc ;; acc |
| rc | reading_comprehension | text; then `q: question | *opt ;; opt` (q~ = uk options) |
| mic | meaning_in_context | context | target | *opt ;; opt (uk) |
| np | natural_phrase | situation | *opt ;; opt (sk) |
| tone / hm | tone / hidden_meaning | context | *opt ;; opt (uk) |
| reg | register | phrase | formal/neutral/informal/slang |
| doc | real_document | title | label: value ;; … | question | *opt ;; opt |
| msg | real_message | sender | body | question | *opt ;; opt (uk) |
| sch | real_schedule | title | day = hours ;; … | question | *opt ;; opt |
| menu | real_menu | Cat: item = price ;; …; then q: lines |

Runtime facts the builder relies on (verified in src/): tokens/lines/options are displayed in JSON
order, so the builder shuffles them deterministically; `find_error` tokens are whitespace-split and
only `.!?` are normalized (never put the error word before a comma); free input is compared
case-insensitively with `.!?` stripped; interactive final steps are matched by option label.
No audio assets exist, so listening mechanics are not used.
