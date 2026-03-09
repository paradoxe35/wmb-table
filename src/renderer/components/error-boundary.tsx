import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Result } from 'antd';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <Result
                    status="error"
                    title="Une erreur inattendue s'est produite"
                    subTitle={this.state.error?.message}
                    extra={
                        <Button type="primary" onClick={this.handleReload}>
                            {"Recharger l'application"}
                        </Button>
                    }
                />
            );
        }
        return this.props.children;
    }
}
