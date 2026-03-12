import { Typography } from 'antd';

const { Text } = Typography;

export function Hint({ children }: { children: string }) {
    return (
        <Text type="secondary" style={{ fontSize: '0.8em', display: 'block', marginTop: 2 }}>
            {children}
        </Text>
    );
}

export function Field({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <Text strong style={{ fontSize: '0.9em' }}>
                {label}
            </Text>
            {hint ? <Hint>{hint}</Hint> : null}
            <div style={{ marginTop: 4 }}>{children}</div>
        </div>
    );
}
