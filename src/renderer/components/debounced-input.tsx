import { useEffect, useRef, useState } from 'react';
import { Input, Typography } from 'antd';
import { useDebouncedCommit } from '@renderer/hooks/use-debounced-commit';

interface DebouncedInputProps {
    value: string;
    onChange: (val: string) => void;
    password?: boolean;
    placeholder?: string;
    delay?: number;
    id?: string;
    /** Returns an error text for a value that must not be saved. */
    validate?: (val: string) => string | undefined;
    /** Cleans up the shown value when the field loses focus (e.g. trims it). */
    normalize?: (val: string) => string;
}

export default function DebouncedInput({
    value: externalValue,
    onChange,
    password,
    placeholder,
    delay = 600,
    id,
    validate,
    normalize,
}: DebouncedInputProps) {
    const [localValue, setLocalValue] = useState(externalValue);
    const commit = useDebouncedCommit(onChange, delay);
    const error = validate?.(localValue);
    const errorId = id ? `${id}-error` : undefined;

    const focusedRef = useRef(false);
    const typedSinceFocusRef = useRef(false);

    useEffect(() => {
        if (focusedRef.current || commit.isPending()) return;
        setLocalValue((current) => (current === externalValue ? current : externalValue));
    }, [externalValue, commit]);

    function handleFocus() {
        focusedRef.current = true;
        typedSinceFocusRef.current = false;
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const next = e.target.value;
        typedSinceFocusRef.current = true;
        setLocalValue(next);
        if (validate?.(next)) {
            commit.cancel();
            return;
        }
        commit.schedule(next);
    }

    function handleBlur() {
        focusedRef.current = false;
        commit.flush();
        if (!typedSinceFocusRef.current) {
            setLocalValue(externalValue);
            return;
        }
        if (normalize && !validate?.(localValue)) setLocalValue(normalize(localValue));
    }

    const InputComponent = password ? Input.Password : Input;
    return (
        <>
            <InputComponent
                id={id}
                value={localValue}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder={placeholder}
                status={error ? 'error' : undefined}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
            />
            {error ? (
                <Typography.Text
                    id={errorId}
                    type="danger"
                    style={{ fontSize: 'var(--fs-rel-lg)', display: 'block', marginTop: 2 }}
                >
                    {error}
                </Typography.Text>
            ) : null}
        </>
    );
}
