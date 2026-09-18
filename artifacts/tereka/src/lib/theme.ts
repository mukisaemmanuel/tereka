/**
 * ==============================================================================
 * TEREKA FINANCIAL INTELLIGENCE - THEME MANAGER (LIGHT / DARK / SYSTEM)
 * ==============================================================================
 * 
 * Manages Tailwind / CSS dark mode state on the root `<html>` (`document.documentElement`).
 * 
 * Modes:
 * - 'light': Forces clean light aesthetic
 * - 'dark': Forces high-contrast dark aesthetic
 * - 'system': Dynamically syncs with the user's operating system preferences
 */

export type AppTheme = 'light' | 'dark' | 'system';

/**
 * Applies the selected theme to the root HTML element.
 * 
 * - Toggles the `.dark` class on `document.documentElement`
 * - Sets the CSS `color-scheme` property for native inputs and scrollbars
 * 
 * @param theme - Desired theme mode ('light', 'dark', or 'system')
 */
export function applyTheme(theme: AppTheme): void {
  // Check OS level dark mode preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Resolve whether dark mode should be enabled
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);

  // Apply or remove the `.dark` class on <html>
  document.documentElement.classList.toggle('dark', isDark);

  // Set native CSS color-scheme
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
}