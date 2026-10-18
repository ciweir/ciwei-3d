import { Component } from 'react';

class SceneErrorBoundary extends Component {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error('[SceneErrorBoundary]', error, info);
        this.props.onError?.(error);
    }

    render() {
        return this.state.hasError ? null : this.props.children;
    }
}

export default SceneErrorBoundary;
