import { useEffect, useRef, useState } from 'react';
import { App as AntApp, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAiChatStore, useAppStore } from '@renderer/stores';
import { useTtsStore } from '@renderer/stores/tts.store';
import { useFeatureRemindersStore } from '@renderer/stores/feature-reminders.store';
import {
    FEATURE_REMINDER_DEFINITIONS,
    FEATURE_REMINDER_NOTIFICATION_KEY,
    FEATURE_REMINDER_SESSION_DELAY_MS,
    getFeatureReminderCopy,
    isFeatureReminderConfigured,
    loadFeatureReminderBackendSnapshot,
    markFeatureReminderUsed,
    syncFeatureReminderUsageFromSnapshot,
} from '@renderer/lib/feature-reminders';

export default function FeatureReminderBanner() {
    const { t } = useTranslation();
    const { notification } = AntApp.useApp();
    const loaded = useAppStore((s) => s.loaded);
    const syncing = useAppStore((s) => s.syncing);
    const mainView = useAppStore((s) => s.mainView);
    const optionView = useAppStore((s) => s.optionView);
    const settingsTab = useAppStore((s) => s.settingsTab);
    const readingMode = useAppStore((s) => s.readingMode);
    const openSettingsTab = useAppStore((s) => s.openSettingsTab);
    const hydrated = useFeatureRemindersStore((s) => s.hydrated);
    const hiddenUntilByKey = useFeatureRemindersStore((s) => s.hiddenUntilByKey);
    const sessionHiddenUntil = useFeatureRemindersStore((s) => s.sessionHiddenUntil);
    const used = useFeatureRemindersStore((s) => s.used);
    const snooze = useFeatureRemindersStore((s) => s.snooze);
    const ttsStatus = useTtsStore((s) => s.status);
    const aiConversations = useAiChatStore((s) => s.conversations.length);
    const suppressCloseRef = useRef(false);
    const notificationOpenRef = useRef(false);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [sessionDelayElapsed, setSessionDelayElapsed] = useState(false);
    const [configured, setConfigured] = useState<Record<'ai' | 'tts' | 'backup', boolean>>({
        ai: false,
        tts: false,
        backup: false,
    });
    const [backendLoaded, setBackendLoaded] = useState(false);

    useEffect(() => {
        const markInteracted = () => setHasInteracted(true);
        const timer = window.setTimeout(
            () => setSessionDelayElapsed(true),
            FEATURE_REMINDER_SESSION_DELAY_MS,
        );

        window.addEventListener('pointerdown', markInteracted, { once: true, passive: true });
        window.addEventListener('keydown', markInteracted, { once: true });
        window.addEventListener('scroll', markInteracted, { once: true, passive: true });

        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('pointerdown', markInteracted);
            window.removeEventListener('keydown', markInteracted);
            window.removeEventListener('scroll', markInteracted);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        void loadFeatureReminderBackendSnapshot()
            .then((snapshot) => {
                if (cancelled) {
                    return;
                }

                syncFeatureReminderUsageFromSnapshot(snapshot);
                setConfigured({
                    ai: isFeatureReminderConfigured('ai', snapshot),
                    tts: isFeatureReminderConfigured('tts', snapshot),
                    backup: isFeatureReminderConfigured('backup', snapshot),
                });
                setBackendLoaded(true);
            })
            .catch(() => {
                if (!cancelled) {
                    setBackendLoaded(true);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (ttsStatus !== 'idle') {
            markFeatureReminderUsed('tts');
        }
    }, [ttsStatus]);

    useEffect(() => {
        if (aiConversations > 0) {
            markFeatureReminderUsed('ai');
        }
    }, [aiConversations]);

    useEffect(() => {
        return window.api.on.backupAccessStatus((hasAccess) => {
            if (hasAccess) {
                markFeatureReminderUsed('backup');
            }
            setConfigured((state) => ({ ...state, backup: hasAccess || state.backup }));
        });
    }, []);

    const canShowReminders =
        hydrated &&
        backendLoaded &&
        loaded &&
        !syncing &&
        !readingMode &&
        hasInteracted &&
        sessionDelayElapsed &&
        (!sessionHiddenUntil || sessionHiddenUntil <= Date.now());

    const activeReminder = canShowReminders
        ? FEATURE_REMINDER_DEFINITIONS.find((reminder) => {
              const hiddenUntil = hiddenUntilByKey[reminder.key];
              return (
                  (!used[reminder.key] || !configured[reminder.key]) &&
                  (!hiddenUntil || hiddenUntil <= Date.now())
              );
          })
        : null;

    useEffect(() => {
        const closeNotification = () => {
            if (notificationOpenRef.current) {
                suppressCloseRef.current = true;
                notificationOpenRef.current = false;
            }
            notification.destroy(FEATURE_REMINDER_NOTIFICATION_KEY);
        };

        const copy = activeReminder ? getFeatureReminderCopy(activeReminder, t) : null;

        if (
            !activeReminder ||
            (mainView === 'options' &&
                optionView === 'settings' &&
                settingsTab === activeReminder.tab)
        ) {
            closeNotification();
            return;
        }

        suppressCloseRef.current = false;
        notificationOpenRef.current = true;
        notification.info({
            key: FEATURE_REMINDER_NOTIFICATION_KEY,
            placement: 'topRight',
            duration: 0,
            message: copy?.title,
            description: copy?.description,
            icon: activeReminder.renderIcon(),
            btn: (
                <Button
                    size="small"
                    type="primary"
                    onClick={() => {
                        snooze(activeReminder.key);
                        closeNotification();
                        openSettingsTab(activeReminder.tab);
                    }}
                >
                    {copy?.actionLabel}
                </Button>
            ),
            onClose: () => {
                notificationOpenRef.current = false;
                if (suppressCloseRef.current) {
                    suppressCloseRef.current = false;
                    return;
                }
                snooze(activeReminder.key);
            },
        });

        return () => {
            closeNotification();
        };
    }, [
        activeReminder,
        mainView,
        notification,
        openSettingsTab,
        optionView,
        settingsTab,
        snooze,
        t,
    ]);

    return null;
}
