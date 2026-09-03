import { describe, expect, it } from 'vitest';
import { formatCorrectAnswer, isLegacyCorrectOption } from './exerciseChecking';
import { progressService } from './progressService';
import type { Exercise } from '../types';

function legacyExercise(overrides: Partial<Exercise>): Exercise {
  return {
    id: 'ex-1',
    lessonId: 'lesson-1',
    type: 'multiple_choice_translation',
    question: 'Що означає "abeceda"?',
    order: 1,
    difficulty: 'easy',
    ...overrides,
  } as Exercise;
}

describe('isLegacyCorrectOption', () => {
  it('matches the single correct option', () => {
    const ex = legacyExercise({ options: ['алфавіт', 'літера'], correctAnswer: 'алфавіт' });
    expect(isLegacyCorrectOption(ex, 'алфавіт')).toBe(true);
    expect(isLegacyCorrectOption(ex, 'літера')).toBe(false);
  });

  it('ignores case, surrounding space and terminal punctuation', () => {
    const ex = legacyExercise({ correctAnswer: 'Dobrý deň!' });
    expect(isLegacyCorrectOption(ex, '  dobrý deň  ')).toBe(true);
  });

  it('treats any member of a multi-answer array as correct', () => {
    const ex = legacyExercise({ correctAnswer: ['káva', 'čaj'] });
    expect(isLegacyCorrectOption(ex, 'čaj')).toBe(true);
    expect(isLegacyCorrectOption(ex, 'voda')).toBe(false);
  });

  it('reports nothing correct when the exercise carries no answer', () => {
    expect(isLegacyCorrectOption(legacyExercise({}), 'алфавіт')).toBe(false);
  });

  /*
   * The whole point of sharing this helper: the green highlight must never
   * disagree with the grade the learner was just given.
   */
  it('agrees with the grader on every option of a legacy true/false', () => {
    const ex = legacyExercise({
      type: 'true_false',
      options: ['Правильно', 'Неправильно'],
      correctAnswer: 'Правильно',
    });
    for (const option of ex.options as string[]) {
      expect(isLegacyCorrectOption(ex, option)).toBe(progressService.check(ex, option));
    }
  });

  it('agrees with the grader on legacy fill_blank options and formats the answer', () => {
    const ex = legacyExercise({
      type: 'fill_blank',
      options: ['idem pešo', 'idem do práce', 'ráno idem do práce', 'nejdem do práce'],
      correctAnswer: 'idem pešo',
    });
    expect(progressService.check(ex, 'idem pešo')).toBe(true);
    expect(progressService.check(ex, 'idem do práce')).toBe(false);
    for (const option of ex.options as string[]) {
      expect(isLegacyCorrectOption(ex, option)).toBe(progressService.check(ex, option));
    }
    expect(formatCorrectAnswer(ex)).toBe('idem pešo');
  });

  it('agrees with the grader when correctAnswer is an array of acceptable answers', () => {
    const ex = legacyExercise({
      type: 'fill_blank',
      options: ['káva', 'čaj', 'voda'],
      correctAnswer: ['káva', 'čaj'],
    });
    expect(progressService.check(ex, 'čaj')).toBe(true);
    expect(progressService.check(ex, 'káva')).toBe(true);
    expect(progressService.check(ex, 'voda')).toBe(false);
    for (const option of ex.options as string[]) {
      expect(isLegacyCorrectOption(ex, option)).toBe(progressService.check(ex, option));
    }
    expect(formatCorrectAnswer(ex)).toBe('káva, čaj');
  });
});
