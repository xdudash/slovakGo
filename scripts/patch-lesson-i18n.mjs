import fs from 'node:fs';

const path = 'src/features/student/StudentScreens.tsx';
let s = fs.readFileSync(path, 'utf8');

function replaceOnce(oldText, newText) {
  const count = s.split(oldText).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one match, got ${count}: ${oldText.slice(0, 100)}`);
  s = s.replace(oldText, newText);
}

replaceOnce(
  'import { resolveText } from "../../utils/lessonLocale";',
  'import { resolveText, resolveWordExampleTranslation, resolveWordTranslation } from "../../utils/lessonLocale";'
);

replaceOnce(
  'function TheoryView({ screen, onNext, tx }: { screen: TheoryScreen; onNext: () => void; tx: (v: LocalizedText | undefined) => string }) {',
  'function TheoryView({ screen, onNext, tx, t }: { screen: TheoryScreen; onNext: () => void; tx: (v: LocalizedText | undefined) => string; t: (key: string) => string }) {'
);
replaceOnce(
  '<Button onClick={onNext}>{screen.button ?? "Далі →"}</Button>',
  '<Button onClick={onNext}>{screen.button ?? `${t("student.lesson.next")} →`}</Button>'
);
replaceOnce(
  '<TheoryView key={`theory-${theoryIndex}`} screen={theories[theoryIndex]} onNext={advanceFromTheory} tx={tx} />',
  '<TheoryView key={`theory-${theoryIndex}`} screen={theories[theoryIndex]} onNext={advanceFromTheory} tx={tx} t={t} />'
);
replaceOnce(
  '{lesson.startScreen.outcomes!.map((o, i) => <li key={i}>{o}</li>)}',
  '{lesson.startScreen.outcomes!.map((o, i) => <li key={i}>{tx(o as unknown as LocalizedText)}</li>)}'
);
replaceOnce(
  '<span>{lesson.startScreen.newWords!.length} нових слів</span>',
  '<span>{lesson.startScreen.newWords!.length} {t("student.lesson.new_words")}</span>'
);
replaceOnce(
  '<span>{lesson.startScreen.exercisesCount} вправ</span>',
  '<span>{lesson.startScreen.exercisesCount} {t("student.lesson.exercises_label")}</span>'
);
replaceOnce(
  '<Button onClick={advanceFromStart}>{lesson.startScreen.button ?? "Почати →"}</Button>',
  '<Button onClick={advanceFromStart}>{lesson.startScreen.button ?? `${t("student.lesson.start")} →`}</Button>'
);
replaceOnce(
  '<span className="lesson-word-uk">{word.uk}</span>',
  '<span className="lesson-word-uk">{resolveWordTranslation(word, tx)}</span>'
);
replaceOnce(
  '{word.exampleSk && <div className="lesson-word-example">{word.exampleSk} — {word.exampleUk}</div>}',
  '{(word.example?.sk ?? word.exampleSk) && <div className="lesson-word-example">{word.example?.sk ?? word.exampleSk} — {resolveWordExampleTranslation(word, tx)}</div>}'
);
replaceOnce(
  '<Button onClick={advanceFromStart}>Почати урок →</Button>',
  '<Button onClick={advanceFromStart}>{t("student.lesson.start_lesson")} →</Button>'
);
replaceOnce(
  '<Button onClick={advanceFromWords}>{lesson.wordsScreen.button ?? "Почати вправи →"}</Button>',
  '<Button onClick={advanceFromWords}>{lesson.wordsScreen.button ?? `${t("student.lesson.start_exercises")} →`}</Button>'
);
replaceOnce(
  'if (phase === "words") return "Слова";',
  'if (phase === "words") return t("student.lesson.words");'
);
replaceOnce(
  'if (phase === "final") return "Ситуація";',
  'if (phase === "final") return t("student.lesson.situation");'
);
replaceOnce(
  '<span className="badge">Крок {finalStepIndex + 1} / {sit.steps.length}</span>',
  '<span className="badge">{t("student.lesson.step")} {finalStepIndex + 1} / {sit.steps.length}</span>'
);
replaceOnce(
  '<span className="lesson-result-stat-l">нових слів</span>',
  '<span className="lesson-result-stat-l">{t("student.lesson.new_words")}</span>'
);
replaceOnce(
  '<span className="lesson-result-stat-l">вправ</span>',
  '<span className="lesson-result-stat-l">{t("student.lesson.exercises_label")}</span>'
);
replaceOnce(
  '<span className="lesson-result-stat-l">правильно</span>',
  '<span className="lesson-result-stat-l">{t("student.lesson.correct_label")}</span>'
);
replaceOnce('<h3>Тепер ти знаєш</h3>', '<h3>{t("student.lesson.now_you_know")}</h3>');
replaceOnce('<p>Наступний урок:</p>', '<p>{t("student.lesson.next_lesson")}:</p>');
replaceOnce(
  '{opensTrialAfterLesson ? "Відкрити повний доступ →" : lesson.resultScreen.buttons?.[0] ?? "Продовжити"}',
  '{opensTrialAfterLesson ? `${t("student.lesson.open_full_access")} →` : lesson.resultScreen.buttons?.[0] ?? t("student.lesson.continue")}'
);
replaceOnce(
  '{lesson.resultScreen.buttons?.[1] ?? "Повторити урок"}',
  '{lesson.resultScreen.buttons?.[1] ?? t("student.lesson.repeat_lesson")}'
);
replaceOnce(
  '{lesson.resultScreen.mistakesMessage ?? lesson.resultScreen.buttons?.[2] ?? "Тренувати помилки"}',
  '{lesson.resultScreen.mistakesMessage ?? lesson.resultScreen.buttons?.[2] ?? t("student.lesson.practice_mistakes")}'
);
replaceOnce(
  '{celebration.correct} / {celebration.total} правильно\n              {celebration.wrong.length === 0 && " · Ідеально!"}',
  '{celebration.correct} / {celebration.total} {t("student.lesson.correct_label")}\n              {celebration.wrong.length === 0 && ` · ${t("student.lesson.perfect")}`}'
);
replaceOnce('<p className="celebrate-mistakes-title">Помилки:</p>', '<p className="celebrate-mistakes-title">{t("student.lesson.mistakes")}:</p>');
replaceOnce('<Share2 size={16} /> {sharing ? "…" : "Поділитись"}', '<Share2 size={16} /> {sharing ? "…" : t("student.lesson.share")}');
replaceOnce(
  '{opensTrialAfterLesson ? "Відкрити повний доступ →" : "Продовжити"}',
  '{opensTrialAfterLesson ? `${t("student.lesson.open_full_access")} →` : t("student.lesson.continue")}'
);

fs.writeFileSync(path, s);

const localeValues = {
  uk: {
    start: 'Почати', start_lesson: 'Почати урок', start_exercises: 'Почати вправи', words: 'Слова', situation: 'Ситуація', step: 'Крок',
    new_words: 'нових слів', exercises_label: 'вправ', correct_label: 'правильно', now_you_know: 'Тепер ти знаєш', next_lesson: 'Наступний урок',
    continue: 'Продовжити', repeat_lesson: 'Повторити урок', practice_mistakes: 'Тренувати помилки', open_full_access: 'Відкрити повний доступ',
    perfect: 'Ідеально!', mistakes: 'Помилки', share: 'Поділитись'
  },
  ru: {
    start: 'Начать', start_lesson: 'Начать урок', start_exercises: 'Начать упражнения', words: 'Слова', situation: 'Ситуация', step: 'Шаг',
    new_words: 'новых слов', exercises_label: 'упражнений', correct_label: 'правильно', now_you_know: 'Теперь ты знаешь', next_lesson: 'Следующий урок',
    continue: 'Продолжить', repeat_lesson: 'Повторить урок', practice_mistakes: 'Тренировать ошибки', open_full_access: 'Открыть полный доступ',
    perfect: 'Идеально!', mistakes: 'Ошибки', share: 'Поделиться'
  },
  en: {
    start: 'Start', start_lesson: 'Start lesson', start_exercises: 'Start exercises', words: 'Words', situation: 'Situation', step: 'Step',
    new_words: 'new words', exercises_label: 'exercises', correct_label: 'correct', now_you_know: 'Now you know', next_lesson: 'Next lesson',
    continue: 'Continue', repeat_lesson: 'Repeat lesson', practice_mistakes: 'Practice mistakes', open_full_access: 'Unlock full access',
    perfect: 'Perfect!', mistakes: 'Mistakes', share: 'Share'
  },
  sk: {
    start: 'Začať', start_lesson: 'Začať lekciu', start_exercises: 'Začať cvičenia', words: 'Slová', situation: 'Situácia', step: 'Krok',
    new_words: 'nových slov', exercises_label: 'cvičení', correct_label: 'správne', now_you_know: 'Teraz už vieš', next_lesson: 'Ďalšia lekcia',
    continue: 'Pokračovať', repeat_lesson: 'Zopakovať lekciu', practice_mistakes: 'Precvičiť chyby', open_full_access: 'Odomknúť plný prístup',
    perfect: 'Perfektné!', mistakes: 'Chyby', share: 'Zdieľať'
  }
};

for (const [lang, values] of Object.entries(localeValues)) {
  const localePath = `src/locales/${lang}.json`;
  const data = JSON.parse(fs.readFileSync(localePath, 'utf8'));
  data.student ??= {};
  data.student.lesson ??= {};
  Object.assign(data.student.lesson, values);
  fs.writeFileSync(localePath, JSON.stringify(data, null, 2) + '\n');
}

console.log('Patched multilingual lesson renderer and locale labels.');
