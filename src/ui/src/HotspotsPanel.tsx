import { useEffect, useState, type ReactElement } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface HotspotData {
	name: string;
	dependents_count: number;
}

export function HotspotsPanel(): ReactElement {
	const [data, setData] = useState<HotspotData[]>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchHotspots = async () => {
			try {
				const res = await fetch("/api/analytics/hotspots");
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

		fetchHotspots();
		const interval = setInterval(fetchHotspots, 10000); // 10s
		return () => clearInterval(interval);
	}, []);

	return (
		<div className="rounded-lg border border-border bg-panel p-4 h-80 flex flex-col">
			<div className="mb-2 text-[11px] uppercase tracking-wider text-fg-dim">
				Top 10 Hotspots (Dependents)
			</div>
			{error ? (
				<div className="flex-1 flex items-center justify-center text-xs text-red-500">
					{error}
				</div>
			) : data.length === 0 ? (
				<div className="flex-1 flex items-center justify-center text-xs text-fg-muted">
					No data available
				</div>
			) : (
				<div className="flex-1 min-h-0">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
							<XAxis type="number" hide />
							<YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10, fill: '#888' }} />
							<Tooltip 
								contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333', fontSize: '12px' }}
								itemStyle={{ color: '#fff' }}
							/>
							<Bar dataKey="dependents_count" fill="#4f46e5" radius={[0, 4, 4, 0]}>
								{data.map((_, index) => (
									<Cell key={`cell-${index}`} fill={index < 3 ? "#ef4444" : "#4f46e5"} />
								))}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				</div>
			)}
		</div>
	);
}
