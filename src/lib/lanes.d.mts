// Types for lanes.mjs (plain JS so Node scripts can import it too).
export const LANES: { name: string; slug: string }[];
export const REISSUES: string;
export const GENRE_WORDS: [string, RegExp][];
export function currentLane(lane: string | null | undefined, hint?: string): string | null;
