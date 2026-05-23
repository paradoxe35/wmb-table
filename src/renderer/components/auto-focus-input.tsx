import { useEffect, useRef, type ComponentProps } from 'react';
import { Input } from 'antd';
import type { InputRef } from 'antd';

export function AutoFocusInput(props: ComponentProps<typeof Input>) {
    const ref = useRef<InputRef>(null);

    useEffect(() => {
        const id = window.setTimeout(() => ref.current?.focus({ cursor: 'all' }), 50);
        return () => window.clearTimeout(id);
    }, []);

    return <Input {...props} ref={ref} />;
}
