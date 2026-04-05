import { persist } from 'zustand/middleware';
import { createStore } from './create-store';

export const FEATURE_REMINDER_KEYS = ['ai', 'tts', 'backup'] as const;
export type FeatureReminderKey = (typeof FEATURE_REMINDER_KEYS)[number];

type ReminderFlagMap = Record<FeatureReminderKey, boolean>;
type ReminderHiddenUntilMap = Record<FeatureReminderKey, number | null>;

const EMPTY_FLAGS: ReminderFlagMap = {
    ai: false,
    tts: false,
    backup: false,
};

const EMPTY_HIDDEN_UNTIL: ReminderHiddenUntilMap = {
    ai: null,
    tts: null,
    backup: null,
};

const FEATURE_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
const SESSION_SNOOZE_MS = 12 * 60 * 60 * 1000;

interface FeatureRemindersState {
    hydrated: boolean;
    used: ReminderFlagMap;
    hiddenUntilByKey: ReminderHiddenUntilMap;
    sessionHiddenUntil: number | null;

    markUsed(key: FeatureReminderKey): void;
    snooze(key: FeatureReminderKey): void;
    setHydrated(value: boolean): void;
}

export const useFeatureRemindersStore = createStore<FeatureRemindersState>()(
    persist(
        (set) => ({
            hydrated: false,
            used: { ...EMPTY_FLAGS },
            hiddenUntilByKey: { ...EMPTY_HIDDEN_UNTIL },
            sessionHiddenUntil: null,

            markUsed: (key) =>
                set((state) =>
                    state.used[key]
                        ? state
                        : {
                              used: { ...state.used, [key]: true },
                          },
                ),
            snooze: (key) =>
                set((state) => ({
                    hiddenUntilByKey: {
                        ...state.hiddenUntilByKey,
                        [key]: Date.now() + FEATURE_SNOOZE_MS,
                    },
                    sessionHiddenUntil: Date.now() + SESSION_SNOOZE_MS,
                })),
            setHydrated: (value) => set({ hydrated: value }),
        }),
        {
            name: 'wmb-feature-reminders',
            partialize: (state) => ({
                used: state.used,
                hiddenUntilByKey: state.hiddenUntilByKey,
                sessionHiddenUntil: state.sessionHiddenUntil,
            }),
            onRehydrateStorage: () => (state) => {
                state?.setHydrated(true);
            },
        },
    ),
);
