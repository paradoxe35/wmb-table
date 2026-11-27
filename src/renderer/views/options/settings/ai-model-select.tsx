import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AutoComplete } from 'antd';
import { useTranslation } from 'react-i18next';
import { RECOMMENDED_MIN_CONTEXT_WINDOW, type AiRemoteModel } from '@shared/ai.types';
import { useDebouncedCommit } from '@renderer/hooks/use-debounced-commit';

function ModelContextWarning({
    providerId,
    model,
    baseUrl,
    listedContextWindow,
}: {
    providerId: string;
    model: string;
    baseUrl?: string;
    listedContextWindow?: number;
}) {
    const { t } = useTranslation();
    const [contextWindow, setContextWindow] = useState<number>();

    useEffect(() => {
        if (!model) {
            setContextWindow(undefined);
            return;
        }
        if (listedContextWindow) {
            setContextWindow(listedContextWindow);
            return;
        }

        let active = true;
        window.api.ai
            .getModelLimits({ providerId, model, baseUrl })
            .then((limits) => active && setContextWindow(limits.contextWindow))
            .catch(() => active && setContextWindow(undefined));

        return () => {
            active = false;
        };
    }, [providerId, model, baseUrl, listedContextWindow]);

    if (!contextWindow || contextWindow >= RECOMMENDED_MIN_CONTEXT_WINDOW) {
        return null;
    }

    return (
        <Alert
            type="error"
            showIcon
            style={{ marginBlockStart: 8 }}
            title={t(
                "Ce modèle est trop limité pour l'assistant. Choisissez-en un autre pour pouvoir l'utiliser.",
            )}
        />
    );
}

export function ModelSelect({
    id,
    providerId,
    value,
    defaultModel,
    apiKey,
    baseUrl,
    onChange,
}: {
    id?: string;
    providerId: string;
    value: string | null | undefined;
    defaultModel?: string | null;
    apiKey?: string;
    baseUrl?: string;
    onChange: (model: string) => void;
}) {
    const { t } = useTranslation();
    const [localValue, setLocalValue] = useState(value ?? '');
    const [models, setModels] = useState<AiRemoteModel[]>([]);
    const [fetched, setFetched] = useState(false);
    const commit = useDebouncedCommit(onChange, 500);

    const focusedRef = useRef(false);

    useEffect(() => {
        if (focusedRef.current || commit.isPending()) return;
        const nextValue = value ?? '';
        setLocalValue((current) => (current === nextValue ? current : nextValue));
    }, [value, commit]);

    function handleChange(val: string) {
        setLocalValue(val);
        commit.schedule(val);
    }

    function handleSelect(val: string) {
        setLocalValue(val);
        commit.cancel();
        onChange(val);
    }

    function handleBlur() {
        focusedRef.current = false;
        if (localValue.trim() || !defaultModel) {
            commit.flush();
            return;
        }
        commit.cancel();
        setLocalValue(defaultModel);
        onChange(defaultModel);
    }

    const fetchModels = useCallback(async () => {
        try {
            setModels(await window.api.ai.fetchProviderModels({ providerId, apiKey, baseUrl }));
            setFetched(true);
        } catch {
            // Fetch failed — user can still type a custom model
        }
    }, [providerId, apiKey, baseUrl]);

    // Fetch once when ready (API key available, or custom provider with baseUrl)
    useEffect(() => {
        if (!fetched && (apiKey || baseUrl)) {
            fetchModels();
        }
    }, [apiKey, baseUrl, fetched, fetchModels]);

    // Reset when provider/apiKey/baseUrl changes
    useEffect(() => {
        setFetched(false);
        setModels([]);
    }, [providerId, apiKey, baseUrl]);

    const allOptions = models.map((m) => ({
        value: m.id,
        label: m.name !== m.id ? `${m.name} (${m.id})` : m.id,
    }));
    if (localValue && !allOptions.some((o) => o.value === localValue)) {
        allOptions.unshift({ value: localValue, label: localValue });
    }

    return (
        <>
            <AutoComplete
                id={id}
                value={localValue}
                placeholder={t('Sélectionner ou saisir un modèle')}
                onChange={handleChange}
                onSelect={handleSelect}
                onFocus={() => {
                    focusedRef.current = true;
                }}
                onBlur={handleBlur}
                options={allOptions}
                filterOption={(input, option) => {
                    return (
                        ((option?.label as string) ?? '')
                            .toLowerCase()
                            .includes(input.toLowerCase()) ||
                        (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                    );
                }}
                onOpenChange={(open) => {
                    if (open && !fetched && (apiKey || baseUrl)) fetchModels();
                }}
                style={{ width: '100%' }}
            />
            <ModelContextWarning
                providerId={providerId}
                model={value ?? ''}
                baseUrl={baseUrl}
                listedContextWindow={models.find((m) => m.id === value)?.contextWindow}
            />
        </>
    );
}
