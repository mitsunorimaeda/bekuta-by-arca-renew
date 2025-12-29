import React from "react";

type Props = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  compact?: boolean;
};

type State = {
  hasError: boolean;
  error?: any;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    console.error("[ErrorBoundary] caught", error, info);
  }

  retry = () => this.setState({ hasError: false, error: undefined });

  render() {
    if (!this.state.hasError) return this.props.children;

    const title = this.props.title ?? "この表示でエラーが起きました";
    const desc =
      this.props.description ??
      "このセクションだけ復旧できます。もう一度表示を試してください。";

    if (this.props.compact) {
      return (
        <div className="rounded-xl border bg-white p-4 dark:bg-gray-800">
          <div className="font-semibold text-gray-900 dark:text-white">{title}</div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">{desc}</div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={this.retry}
              className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white"
            >
              再表示
            </button>
          </div>

          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-gray-50 p-2 text-xs text-red-600 dark:bg-gray-900/40">
              {String(this.state.error?.stack ?? this.state.error)}
            </pre>
          )}
        </div>
      );
    }

    return (
      <div className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-800">
        <div className="text-lg font-bold text-gray-900 dark:text-white">{title}</div>
        <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">{desc}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={this.retry}
            className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white"
          >
            もう一度表示する
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border px-3 py-2 text-sm font-medium dark:border-gray-700"
          >
            ページを再読み込み
          </button>
        </div>

        {import.meta.env.DEV && this.state.error && (
          <pre className="mt-4 max-h-56 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-red-600 dark:bg-gray-900/40">
            {String(this.state.error?.stack ?? this.state.error)}
          </pre>
        )}
      </div>
    );
  }
}