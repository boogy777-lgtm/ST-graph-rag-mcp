import * as assert from "assert";
import type { LadderProgram } from "../../ladder/ladderEngine.types";
import {
	exportSchemaV2ToPlcopenLd,
	importPlcopenLdToSchemaV2,
} from "../../ladder/plcopenLdInterop";

function roundtripProgram(): LadderProgram {
	return {
		schemaVersion: 2,
		metadata: {
			name: "RoundtripLD",
			description: "Roundtrip",
		},
		variables: [],
		networks: [
			{
				id: "network_0",
				order: 0,
				layout: { y: 100 },
				nodes: [
					{
						id: "split",
						type: "branchSplit",
						position: { x: 120, y: 100 },
					},
					{
						id: "contact_a",
						type: "contact",
						contactType: "NO",
						variable: "%IX0.0",
						position: { x: 260, y: 80 },
					},
					{
						id: "contact_b",
						type: "contact",
						contactType: "NC",
						variable: "%IX0.1",
						position: { x: 260, y: 120 },
					},
					{
						id: "merge",
						type: "branchMerge",
						position: { x: 360, y: 100 },
					},
					{
						id: "timer_1",
						type: "timer",
						timerType: "TON",
						instance: "T_1",
						presetMs: 200,
						qOutput: "%MX10.0",
						etOutput: "%MW10",
						position: { x: 460, y: 100 },
					},
					{
						id: "counter_1",
						type: "counter",
						counterType: "CTU",
						instance: "C_1",
						preset: 3,
						qOutput: "%MX11.0",
						cvOutput: "%MW11",
						position: { x: 560, y: 100 },
					},
					{
						id: "compare_1",
						type: "compare",
						op: "GT",
						left: "%MW0",
						right: "10",
						position: { x: 660, y: 100 },
					},
					{
						id: "math_1",
						type: "math",
						op: "ADD",
						left: "%MW0",
						right: "1",
						output: "%MW1",
						position: { x: 760, y: 100 },
					},
					{
						id: "coil_1",
						type: "coil",
						coilType: "NORMAL",
						variable: "%QX0.0",
						position: { x: 900, y: 100 },
					},
				],
				edges: [
					{ id: "e1", fromNodeId: "split", toNodeId: "contact_a" },
					{ id: "e2", fromNodeId: "split", toNodeId: "contact_b" },
					{ id: "e3", fromNodeId: "contact_a", toNodeId: "merge" },
					{ id: "e4", fromNodeId: "contact_b", toNodeId: "merge" },
					{
						id: "e5",
						fromNodeId: "merge",
						toNodeId: "timer_1",
						points: [
							{ x: 380, y: 100 },
							{ x: 420, y: 100 },
							{ x: 420, y: 100 },
							{ x: 440, y: 100 },
						],
					},
					{ id: "e6", fromNodeId: "timer_1", toNodeId: "counter_1" },
					{ id: "e7", fromNodeId: "counter_1", toNodeId: "compare_1" },
					{ id: "e8", fromNodeId: "compare_1", toNodeId: "math_1" },
					{ id: "e9", fromNodeId: "math_1", toNodeId: "coil_1" },
				],
			},
		],
	};
}

suite("PLCopen LD interop", () => {
	test("exports schema v2 ladder and imports it back as schema v2", () => {
		const source = roundtripProgram();

		const exported = exportSchemaV2ToPlcopenLd(source, "RoundtripLD");
		assert.strictEqual(exported.diagnostics.length, 0);
		assert.match(exported.xml, /<LD>/);
		assert.match(exported.xml, /<network id="network_0"/);

		const imported = importPlcopenLdToSchemaV2(exported.xml);
		assert.strictEqual(imported.program.schemaVersion, 2);
		assert.strictEqual(imported.program.networks.length, 1);
		assert.strictEqual(
			imported.program.networks[0].nodes.length,
			source.networks[0].nodes.length,
		);
		assert.strictEqual(
			imported.program.networks[0].edges.length,
			source.networks[0].edges.length,
		);
	});

	test("reports unsupported constructs during import", () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://www.plcopen.org/xml/tc6_0200">
  <types>
    <pous>
      <pou name="UnsupportedLD" pouType="PROGRAM">
        <body>
          <LD>
            <network id="n0" order="0" y="100">
              <contact id="c1" contactType="NO" variable="%IX0.0" x="100" y="100" />
              <fbdBlock id="f1" x="220" y="100" />
              <coil id="q1" coilType="NORMAL" variable="%QX0.0" x="360" y="100" />
            </network>
          </LD>
        </body>
      </pou>
    </pous>
  </types>
</project>`;

		const imported = importPlcopenLdToSchemaV2(xml);
		assert.strictEqual(imported.program.networks.length, 1);
		assert.strictEqual(imported.program.networks[0].nodes.length, 2);
		assert.ok(
			imported.diagnostics.some((entry) =>
				entry.includes("unsupported LD construct"),
			),
		);
	});

	test("emits diagnostics for malformed node payloads", () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://www.plcopen.org/xml/tc6_0200">
  <types>
    <pous>
      <pou name="MalformedLD" pouType="PROGRAM">
        <body>
          <LD>
            <network id="n0" order="0" y="100">
              <contact id="c1" contactType="NO" x="100" y="100" />
              <edge id="e1" from="c1" />
            </network>
          </LD>
        </body>
      </pou>
    </pous>
  </types>
</project>`;

		const imported = importPlcopenLdToSchemaV2(xml);
		assert.strictEqual(imported.program.networks.length, 1);
		assert.strictEqual(imported.program.networks[0].nodes.length, 0);
		assert.ok(
			imported.diagnostics.some((entry) => entry.includes("missing variable")),
		);
		assert.ok(
			imported.diagnostics.some((entry) => entry.includes("edge skipped")),
		);
	});

	test("does not silently coerce invalid node enum attributes", () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://www.plcopen.org/xml/tc6_0200">
  <types>
    <pous>
      <pou name="StrictEnums" pouType="PROGRAM">
        <body>
          <LD>
            <network id="n0" order="0" y="100">
              <contact id="c1" contactType="NO" variable="%IX0.0" x="100" y="100" />
              <coil id="q1" coilType="LATCH" variable="%QX0.0" x="240" y="100" />
            </network>
          </LD>
        </body>
      </pou>
    </pous>
  </types>
</project>`;

		const imported = importPlcopenLdToSchemaV2(xml);
		assert.strictEqual(imported.program.networks.length, 1);
		assert.strictEqual(imported.program.networks[0].nodes.length, 1);
		assert.ok(
			imported.diagnostics.some((entry) =>
				entry.includes("invalid coilType 'LATCH'"),
			),
		);
	});
});
