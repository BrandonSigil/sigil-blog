// Types for calendar-core.mjs (plain JS so Node scripts can import it too).
export const LANES: string[]; // lane names, from lanes.mjs
export function looseKey(artist: string, title: string): string;
export function buildCalendar(input: {
	wiki?: unknown[];
	crate?: unknown[];
	press?: Record<string, unknown>;
	history: { artists: string[]; picks: string[]; laneCounts: Record<string, number> };
}): any[];
export function byTaste<T extends { month: string }>(albums: T[], month: string): T[];
export function hotList<T extends { month: string }>(albums: T[], month: string, count?: number): T[];
export function monthKey(date: Date): string;
