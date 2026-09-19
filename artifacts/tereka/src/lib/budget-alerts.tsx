import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AlertTriangle, ShieldAlert, Volume2, X } from 'lucide-react';

export type BudgetAlertType = 'amber' | 'red';

export interface BudgetAlertState {
  message: string;
  type: BudgetAlertType;
  timestamp: number;
}

interface BudgetAlertContextType {
  currentAlert: BudgetAlertState | null;
  triggerBudgetAlert: (message: string) => void;
  dismissAlert: () => void;
  replayVoice: () => void;
}

const BudgetAlertContext = createContext<BudgetAlertContextType | undefined>(undefined);

/**
 * Native Web Speech API Voice Synthesizer
 * Speaks advisory strings with clear pitch and cadence.
 */
export function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis is not supported in this browser environment.');
    return;
  }

  try {
    window.speechSynthesis.cancel(); // Stop any overlapping voice audio
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.98; // Natural speaking pace
    utterance.pitch = 1.05;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';

    // Pick an English voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha'))
    ) || voices.find((v) => v.lang.startsWith('en'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error('Failed to trigger speech synthesis:', err);
  }
}

export function BudgetAlertProvider({ children }: { children: ReactNode }) {
  const [currentAlert, setCurrentAlert] = useState<BudgetAlertState | null>(null);

  const triggerBudgetAlert = useCallback((message: string) => {
    if (!message) return;

    // Categorize as red (exceeded/100%+) or amber (80%-99%)
    const isExceeded = message.toLowerCase().includes('warning') || message.toLowerCase().includes('exceeded');
    const type: BudgetAlertType = isExceeded ? 'red' : 'amber';

    setCurrentAlert({
      message,
      type,
      timestamp: Date.now(),
    });

    // Voice announcement
    speak(message);
  }, []);

  const dismissAlert = useCallback(() => {
    setCurrentAlert(null);
  }, []);

  const replayVoice = useCallback(() => {
    if (currentAlert?.message) {
      speak(currentAlert.message);
    }
  }, [currentAlert]);

  return (
    <BudgetAlertContext.Provider
      value={{
        currentAlert,
        triggerBudgetAlert,
        dismissAlert,
        replayVoice,
      }}
    >
      {children}
    </BudgetAlertContext.Provider>
  );
}

export function useBudgetAlert() {
  const context = useContext(BudgetAlertContext);
  if (!context) {
    throw new Error('useBudgetAlert must be used within a BudgetAlertProvider');
  }
  return context;
}

/**
 * Top-of-screen Banner Alert Component
 * Displays real-time amber (80%) or red (100%+) warnings with audio playback.
 */
export function BudgetAlertBanner() {
  const { currentAlert, dismissAlert, replayVoice } = useBudgetAlert();

  if (!currentAlert) return null;

  const isRed = currentAlert.type === 'red';

  return (
    <div
      role="alert"
      data-testid="budget-alert-banner"
      className={`sticky top-0 z-50 flex items-center justify-between gap-4 border-b px-5 py-3.5 shadow-md backdrop-blur-md transition-all animate-in slide-in-from-top-4 duration-300 ${
        isRed
          ? 'border-red-500/50 bg-red-600/15 text-red-950 dark:bg-red-950/80 dark:text-red-100'
          : 'border-amber-500/50 bg-amber-500/15 text-amber-950 dark:bg-amber-950/80 dark:text-amber-100'
      }`}
    >
      <div className="flex items-start gap-3 sm:items-center">
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl shadow-sm ${
            isRed
              ? 'bg-red-600 text-white animate-pulse'
              : 'bg-amber-600 text-white'
          }`}
        >
          {isRed ? <ShieldAlert size={20} /> : <AlertTriangle size={20} />}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                isRed
                  ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                  : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
              }`}
            >
              {isRed ? '🚨 Limit Exceeded' : '⚠️ 80% Threshold Warning'}
            </span>
            <span className="text-xs opacity-75 hidden sm:inline">AI Financial Advisory</span>
          </div>
          <p className="mt-0.5 text-sm font-semibold leading-snug">
            {currentAlert.message}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={replayVoice}
          title="Replay Voice Warning"
          aria-label="Replay Voice Warning"
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all shadow-sm active:scale-95 ${
            isRed
              ? 'border-red-500/40 bg-red-600/10 hover:bg-red-600/20 text-red-900 dark:text-red-200'
              : 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200'
          }`}
          data-testid="button-replay-voice-alert"
        >
          <Volume2 size={14} />
          <span className="hidden sm:inline">Listen</span>
        </button>

        <button
          type="button"
          onClick={dismissAlert}
          title="Dismiss Alert"
          aria-label="Dismiss Alert"
          className="rounded-xl p-1.5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground transition-colors"
          data-testid="button-dismiss-budget-alert"
        >
          <X size={17} />
        </button>
      </div>
    </div>
  );
}
