import { useEffect, useState, type ReactElement } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface HealthData {
	score: number;
	fbCount: number;
	prgCount: number;
	totalNodes: number;
	isolatedNodes: number;
}

export function HealthScore(): ReactElement {
	const [data, setData] = useState<HealthData | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchHealth = async () => {
			try {
				const res = await fetch("/api/analytics/health");
				if (!res.ok) {
					throw new Error(await res.text());
				}
				const json = await res.json();
				if (json.error) throw new Error(json.error);
				setData(json);
				setError(null);
			} catch (err: any) {
				setError(err.message);
			}
		};

		fetchHealth();
		const interval = setInterval(fetchHealth, 10000); // 10s
		return () => clearInterval(interval);
	}, []);

	const pieData = data ? [
		{ name: "Connected Nodes", value: data.totalNodes - data.isolatedNodes },
		{ name: "Isolated Nodes", value: data.isolatedNodes },
	] : [];

	const COLORS = ["#10b981", "#ef4444"]; // Emerald for connected, Red for isolated

	return (
		<div className="rounded-lg border border-border bg-panel p-4 h-80 flex flex-col">
			<div className="mb-2 text-[11px] uppercase tracking-wider text-fg-dim">
				Code Health Score
			</div>
			{error ? (
				<div className="flex-1 flex items-center justify-center text-xs text-red-500">
					{error}
				</div>
			) : !data ? (
				<div className="flex-1 flex items-center justify-center text-xs text-fg-muted">
					Loading...
				</div>
			) : (
				<div className="flex-1 flex flex-row items-center gap-4 min-h-0">
					<div className="flex-1 h-full">
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={pieData}
									innerRadius={60}
									outerRadius={80}
									paddingAngle={5}
									dataKey="value"
									stroke="none"
								>
									{pieData.map((_, index) => (
										<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
									))}
								</Pie>
								<Tooltip 
									contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333', fontSize: '12px', color: '#fff' }}
									itemStyle={{ color: '#fff' }}
								/>
							</PieChart>
						</ResponsiveContainer>
					</div>
					<div className="flex-1 flex flex-col justify-center gap-2 text-xs">
						<div className="text-4xl font-bold mb-2">
							<span className={data.score > 80 ? "text-emerald-500" : data.score > 50 ? "text-yellow-500" : "text-red-500"}>
								{data.score}
							</span>
							<span className="text-fg-dim text-lg">/100</span>
						</div>
						<div className="grid grid-cols-2 gap-2 text-fg-muted">
							<span>Total POU:</span>
							<span className="text-fg font-mono">{data.totalNodes}</span>
							
							<span>Function Blocks:</span>
							<span className="text-fg font-mono">{data.fbCount}</span>
							
							<span>Programs:</span>
							<span className="text-fg font-mono">{data.prgCount}</span>

							<span>Isolated:</span>
							<span className="text-fg font-mono">{data.isolatedNodes}</span>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
