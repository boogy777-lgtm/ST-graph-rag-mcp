import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./index.css";

class ErrorBoundary extends Component<{children: ReactNode}, {error: Error | null}> {
	constructor(props: {children: ReactNode}) {
		super(props);
		this.state = { error: null };
	}
	static getDerivedStateFromError(error: Error) {
		return { error };
	}
	render() {
		if (this.state.error) {
			return (
				<div className="flex h-full w-full items-center justify-center bg-bg p-8 text-fg">
					<div className="w-full max-w-2xl rounded-lg border border-danger/50 bg-panel p-6 shadow-xl">
						<h1 className="mb-4 flex items-center gap-2 text-lg font-semibold text-danger">
							<span>⚠</span> React Crash
						</h1>
						<pre className="overflow-x-auto rounded bg-panel-2 p-4 font-mono text-xs text-fg-muted">
							{this.state.error.stack ?? this.state.error.message}
						</pre>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}

const container = document.getElementById("root");
if (container === null) {
	throw new Error("Root container #root not found in index.html");
}

createRoot(container).render(
	<StrictMode>
		<ErrorBoundary>
			<App />
		</ErrorBoundary>
	</StrictMode>,
);
