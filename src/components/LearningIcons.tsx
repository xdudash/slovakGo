import type { ReactNode, SVGProps } from 'react';

export type LearningIconName = 'path' | 'words' | 'practice' | 'ranking' | 'profile' | 'streak' | 'xp' | 'freeze';

const drawings: Record<LearningIconName, ReactNode> = {
  path: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h7a4 4 0 0 0 0-8H9a4 4 0 0 1 0-8h4M18 8v2" /></>,
  words: <><path d="M12 5v15M12 5C9 3 5 3 2.5 4.5v14C6 17 9 18 12 20c3-2 6-3 9.5-1.5v-14C19 3 15 3 12 5Z" /><path d="M6 8h2M16 8h2M6 11h2M16 11h2" /></>,
  practice: <><path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /><path d="m9 8-2 2.5L9 13m6-5 2 2.5-2 2.5" /></>,
  ranking: <><path d="M9 21V10h6v11M3 21v-7h6M15 21v-5h6v5M2 21h20" /><path d="m10 5 2-3 2 3-2 2-2-2Z" /></>,
  profile: <><rect x="4" y="2.5" width="16" height="19" rx="3" /><circle cx="12" cy="9" r="2.5" /><path d="M8 17c0-4 8-4 8 0M9 21.5h6" /></>,
  streak: <path d="M13 2c1 5-4 6-4 10-2-1-2-3-2-3-5 6-1 13 5 13s9-6 6-11c0 3-2 4-3 4 2-6 0-10-2-13Z" />,
  xp: <path d="m14 2-10 12h7l-1 8 10-12h-7l1-8Z" />,
  freeze: <><path d="M12 2v20M3.5 7l17 10M3.5 17l17-10M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1-1-4M20 14l-4 1 1 4M4 14l4 1-1 4M20 10l-4-1 1-4" /></>,
};

/** Original small pictograms: one optical size and stroke across native chrome. */
export function LearningIcon({ name, size = 24, ...props }: SVGProps<SVGSVGElement> & { name: LearningIconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{drawings[name]}</svg>;
}
