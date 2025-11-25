// New: Theme interface and predefined themes
export interface AppTheme {
  name: string;
  primary: string; // Tailwind color name (e.g., 'green', 'amber')
  accent: string;  // Tailwind color name for DJ mode (e.g., 'amber', 'blue')
  neutral: string; // Tailwind color name for neutral backgrounds/text (e.g., 'neutral', 'stone')
  purple: string; // Added for editor themes, though usually generic, using it for specific editors
  red: string; // Added for editor themes, though usually generic, using it for specific editors
  blue: string; // NEW: Added for networking theme
}

export const THEMES: AppTheme[] = [
  { name: 'Green Vintage', primary: 'indigo', accent: 'pink', neutral: 'neutral', purple: 'purple', red: 'red', blue: 'blue' },
  { name: 'Blue Retro', primary: 'blue', accent: 'fuchsia', neutral: 'zinc', purple: 'purple', red: 'red', blue: 'blue' },
  { name: 'Red Glitch', primary: 'red', accent: 'cyan', neutral: 'stone', purple: 'purple', red: 'red', blue: 'blue' },
  { name: 'Amber Glow', primary: 'amber', accent: 'green', neutral: 'neutral', purple: 'purple', red: 'red', blue: 'blue' },
  { name: 'Purple Haze', primary: 'purple', accent: 'lime', neutral: 'slate', purple: 'purple', red: 'red', blue: 'blue' },
  { name: 'Cyan Wave', primary: 'cyan', accent: 'violet', neutral: 'gray', purple: 'purple', red: 'red', blue: 'blue' },
  { name: 'Yellow Neon', primary: 'yellow', accent: 'red', neutral: 'stone', purple: 'purple', red: 'red', blue: 'blue' },
];
