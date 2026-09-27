import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional classes with Tailwind conflict resolution. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
