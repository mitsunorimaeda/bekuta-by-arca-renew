import React from 'react';

export class ChartErrorBoundary extends React.Component<
  { name: string; children: React.ReactNode },
  { hasError: boolean; message?: string }
> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: String(err?.message || err) };
  }

  componentDidCatch(err: any) {
    console.error(`[ChartErrorBoundary] ${this.props.name}`, err);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          チャート描画エラー：{this.props.name}
          <div className="text-xs mt-1 opacity-80">{this.state.message}</div>
        </div>
      );
    }
    return this.props.children;
  }
}