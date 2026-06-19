/**
 * Blockly Program Interpreter
 * Interprets and executes Blockly blocks
 */

import type { BlockDefinition, BlocklyWorkspace } from "./blocklyEngine";
import type { RuntimeClient } from "./runtimeClient";

interface ExecutionContext {
	variables: Map<string, any>;
	running: boolean;
	runtimeClient?: RuntimeClient;
}

export class BlocklyInterpreter {
	private context: ExecutionContext;
	private blocks: Map<string, BlockDefinition>;
	private executionTimer?: NodeJS.Timeout;
	private variableIdToName: Map<string, string>;

	constructor(
		workspace: BlocklyWorkspace,
		private mode: "simulation" | "hardware",
		private runtimeClient?: RuntimeClient,
	) {
		this.context = {
			variables: new Map(),
			running: false,
			runtimeClient,
		};

		// Build block map for quick lookup
		this.blocks = new Map();
		if (workspace.blocks?.blocks) {
			for (const block of workspace.blocks.blocks) {
				this.flattenAndRegisterBlock(block);
			}
		}

		// Build variable ID to name mapping
		this.variableIdToName = new Map();
		if (workspace.variables) {
			for (const variable of workspace.variables) {
				this.variableIdToName.set(variable.id, variable.name);
				this.context.variables.set(
					variable.name,
					this.getDefaultValue(variable.type),
				);
			}
		}
	}

	/**
	 * Recursively flatten nested block structure and register all blocks
	 */
	private flattenAndRegisterBlock(block: any): void {
		if (!block || !block.id) return;

		// Register this block
		this.blocks.set(block.id, block);

		// Process nested blocks in inputs
		if (block.inputs) {
			for (const [key, input] of Object.entries(block.inputs)) {
				if (typeof input === "object" && input !== null && "block" in input) {
					const nestedBlock = (input as any).block;
					if (nestedBlock && typeof nestedBlock === "object") {
						this.flattenAndRegisterBlock(nestedBlock);
					}
				}
			}
		}

		// Process next block (could be nested or ID reference)
		if (block.next) {
			if (typeof block.next === "object" && "block" in block.next) {
				// Nested block structure
				const nextBlock = (block.next as any).block;
				if (nextBlock && nextBlock.id) {
					this.flattenAndRegisterBlock(nextBlock);
					// Convert to ID reference for easier navigation
					block.next = nextBlock.id;
				}
			}
			// If it's already a string ID, nothing to do
		}
	}

	private resolveNextId(nextRef: BlockDefinition["next"]): string | undefined {
		if (!nextRef) {
			return undefined;
		}

		if (typeof nextRef === "string") {
			return nextRef;
		}

		if (
			typeof nextRef === "object" &&
			nextRef.block &&
			typeof nextRef.block.id === "string"
		) {
			return nextRef.block.id;
		}

		return undefined;
	}

	/**
	 * Get variable name from field value (handles both string and {id: string} formats)
	 */
	private getVariableName(varField: any): string | undefined {
		if (typeof varField === "string") {
			return varField;
		}
		if (typeof varField === "object" && varField?.id) {
			return this.variableIdToName.get(varField.id);
		}
		return undefined;
	}

	private getDefaultValue(type: string): any {
		switch (type) {
			case "INT":
			case "DINT":
			case "REAL":
				return 0;
			case "BOOL":
				return false;
			case "STRING":
				return "";
			default:
				return null;
		}
	}

	async start(): Promise<void> {
		this.context.running = true;

		// Build set of all block IDs that are referenced by next or inputs
		const referencedBlocks = new Set<string>();

		for (const block of this.blocks.values()) {
			// Blocks referenced via next
			const nextId = this.resolveNextId(block.next);
			if (nextId) {
				referencedBlocks.add(nextId);
			}

			// Blocks referenced via inputs
			if (block.inputs) {
				for (const input of Object.values(block.inputs)) {
					if (
						input.block &&
						typeof input.block === "object" &&
						"id" in input.block
					) {
						referencedBlocks.add(input.block.id);
					}
				}
			}
		}

		// Find entry blocks (root blocks that are not referenced by any other block)
		const entryBlocks = Array.from(this.blocks.values()).filter(
			(block) => !referencedBlocks.has(block.id),
		);

		if (entryBlocks.length === 0) {
			console.warn("No entry blocks found");
			console.log("Total blocks:", this.blocks.size);
			console.log("Referenced blocks:", referencedBlocks.size);
			return;
		}

		console.log(`Found ${entryBlocks.length} entry block(s)`);

		// Execute the first entry block
		const entryBlock = entryBlocks[0];
		await this.executeBlock(entryBlock);
	}

	private blockContains(blockDef: any, targetId: string): boolean {
		if (!blockDef || typeof blockDef !== "object") return false;
		if ("id" in blockDef && blockDef.id === targetId) return true;
		if ("next" in blockDef && typeof blockDef.next === "string") {
			const nextBlock = this.blocks.get(blockDef.next);
			if (nextBlock && this.blockContains(nextBlock, targetId)) return true;
		}
		return false;
	}

	private async executeBlock(blockDef: BlockDefinition): Promise<any> {
		if (!this.context.running) return;

		console.log(`Executing block: ${blockDef.type} (${blockDef.id})`);

		try {
			switch (blockDef.type) {
				case "procedures_defnoreturn":
					// Execute procedure body
					if (blockDef.inputs?.STACK?.block) {
						await this.executeBlock(blockDef.inputs.STACK.block);
					}
					break;

				case "variables_set":
					await this.executeVariableSet(blockDef);
					break;

				case "controls_whileUntil":
					await this.executeWhileLoop(blockDef);
					break;

				case "controls_if":
					await this.executeIf(blockDef);
					break;

				case "io_digital_write":
					await this.executeDigitalWrite(blockDef);
					break;

				case "math_arithmetic":
					return await this.executeMathArithmetic(blockDef);

				case "math_number":
					return blockDef.fields?.NUM ?? 0;

				case "logic_boolean":
					return blockDef.fields?.BOOL === "TRUE";

				case "logic_compare":
					return await this.executeLogicCompare(blockDef);

				case "variables_get": {
					const varNameGet = this.getVariableName(blockDef.fields?.VAR);
					return varNameGet ? (this.context.variables.get(varNameGet) ?? 0) : 0;
				}

				case "comment":
					// Comments don't execute
					break;

				default:
					console.warn(`Unknown block type: ${blockDef.type}`);
			}

			// Execute next block in sequence
			const nextId = this.resolveNextId(blockDef.next);
			if (nextId) {
				const nextBlock = this.blocks.get(nextId);
				if (nextBlock) {
					await this.executeBlock(nextBlock);
				}
			}
		} catch (error) {
			console.error(`Error executing block ${blockDef.id}:`, error);
		}
	}

	private async executeVariableSet(blockDef: BlockDefinition): Promise<void> {
		const varName = this.getVariableName(blockDef.fields?.VAR);
		if (!varName) return;

		const value = await this.evaluateInput(blockDef, "VALUE");
		this.context.variables.set(varName, value);
		console.log(`Set ${varName} = ${value}`);
	}

	private async executeWhileLoop(blockDef: BlockDefinition): Promise<void> {
		const mode = blockDef.fields?.MODE;
		let iterations = 0;
		const maxIterations = 10000; // Safety limit

		while (iterations < maxIterations && this.context.running) {
			const condition = await this.evaluateInput(blockDef, "BOOL");
			const shouldContinue = mode === "WHILE" ? condition : !condition;

			if (!shouldContinue) break;

			// Execute loop body
			if (blockDef.inputs?.DO?.block) {
				await this.executeBlock(blockDef.inputs.DO.block);
			}

			iterations++;

			// Yield to event loop every 100 iterations to prevent complete blocking
			if (iterations % 100 === 0) {
				await this.sleep(0);
			}
		}

		if (iterations >= maxIterations) {
			console.warn("Loop iteration limit reached");
		}
	}

	private async executeIf(blockDef: BlockDefinition): Promise<void> {
		const condition = await this.evaluateInput(blockDef, "IF0");

		if (condition) {
			if (blockDef.inputs?.DO0?.block) {
				await this.executeBlock(blockDef.inputs.DO0.block);
			}
		} else if (blockDef.inputs?.ELSE?.block) {
			await this.executeBlock(blockDef.inputs.ELSE.block);
		}
	}

	private async executeDigitalWrite(blockDef: BlockDefinition): Promise<void> {
		const address = blockDef.fields?.ADDRESS ?? "%QX0.0";
		const value = await this.evaluateInput(blockDef, "VALUE");

		console.log(`[${this.mode}] Write ${address} = ${value}`);

		if (this.mode === "hardware" && this.runtimeClient) {
			try {
				// Convert boolean to string for runtime protocol
				const valueStr = value ? "TRUE" : "FALSE";
				await this.runtimeClient.writeIo(address, valueStr);
				console.log(`✅ Hardware write: ${address} = ${valueStr}`);
			} catch (error) {
				console.error(`❌ Failed to write ${address}:`, error);
			}
		}
	}

	private async executeMathArithmetic(
		blockDef: BlockDefinition,
	): Promise<number> {
		const a = await this.evaluateInput(blockDef, "A");
		const b = await this.evaluateInput(blockDef, "B");
		const op = blockDef.fields?.OP;

		switch (op) {
			case "ADD":
				return Number(a) + Number(b);
			case "MINUS":
				return Number(a) - Number(b);
			case "MULTIPLY":
				return Number(a) * Number(b);
			case "DIVIDE":
				return Number(b) !== 0 ? Number(a) / Number(b) : 0;
			case "POWER":
				return Number(a) ** Number(b);
			default:
				return 0;
		}
	}

	private async executeLogicCompare(
		blockDef: BlockDefinition,
	): Promise<boolean> {
		const a = await this.evaluateInput(blockDef, "A");
		const b = await this.evaluateInput(blockDef, "B");
		const op = blockDef.fields?.OP;

		switch (op) {
			case "EQ":
				return a === b;
			case "NEQ":
				return a !== b;
			case "LT":
				return a < b;
			case "LTE":
				return a <= b;
			case "GT":
				return a > b;
			case "GTE":
				return a >= b;
			default:
				return false;
		}
	}

	private async evaluateInput(
		blockDef: BlockDefinition,
		inputName: string,
	): Promise<any> {
		const input = blockDef.inputs?.[inputName];
		if (!input?.block) return null;

		return await this.executeBlock(input.block);
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	stop(): void {
		this.context.running = false;
		if (this.executionTimer) {
			clearInterval(this.executionTimer);
		}
	}

	getContext(): ExecutionContext {
		return this.context;
	}
}
