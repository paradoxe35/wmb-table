import { useCallback, useEffect, useMemo, useState } from 'react';
import { Input } from 'antd';
import { debounce } from '@renderer/utils/functions';

interface DebouncedInputProps {
    value: string;
    onChange: (val: string) => void;
    password?: boolean;
    placeholder?: string;
    delay?: number;
}

export default function DebouncedInput({
    value: externalValue,
    onChange,
    password,
    placeholder,
    delay = 600,
}: DebouncedInputProps) {
    const [localValue, setLocalValue] = useState(externalValue);

    useEffect(() => {
        setLocalValue(externalValue);
    }, [externalValue]);

    const debouncedOnChange = useMemo(() => debounce(onChange, delay), [onChange, delay]);
    useEffect(() => () => debouncedOnChange.cancel(), [debouncedOnChange]);

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setLocalValue(e.target.value);
            debouncedOnChange(e.target.value);
        },
        [debouncedOnChange],
    );

    const InputComponent = password ? Input.Password : Input;
    return <InputComponent value={localValue} onChange={handleChange} placeholder={placeholder} />;
}
