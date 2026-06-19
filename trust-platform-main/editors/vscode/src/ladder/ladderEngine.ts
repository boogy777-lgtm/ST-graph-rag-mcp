/**
 * Ladder Logic Engine - Executes ladder programs with PLC-style scan cycle.
 * Supports simulation and hardware execution modes.
 */

import type { RuntimeClient } from "../statechart/runtimeClient";
import type {
	Coil,
	CompareNode,
	Contact,
	Counter,
	LadderNode,
	LadderProgram,
	MathNode,
	Network,
	Timer,
	Variable,
	VariableScope,
} from "./ladderEngine.types";
import {
	isCoilType,
	isCompareOp,
	isContactType,
	isCounterType,
	isMathOp,
	isTimerType,
} from "./ladderEngine.types";

type ExecutionMode = "simulation" | "hardware";

interface LadderEngineOptions {
	scanCycleMs?: number;
	runtimeClient?: RuntimeClient;
}

type AddressValue = boolean | number;

type NodeEvalContext = {
	incomingPower: boolean;
};

interface TimerState {
	etMs: number;
	lastIn: boolean;
}

interface CounterState {
	cv: number;
	lastIn: boolean;
}

interface NetworkTopology {
	incoming: Map<string, string[]>;
	outgoing: Map<string, string[]>;
	sortedNodes: LadderNode[];
}

const LEFT_RAIL_ID = "__LEFT_RAIL__";
const SYMBOL_FORCE_PREFIX = "__SYM__:";

interface VariableBinding {
	name: string;
	type: Variable["type"];
	scope: VariableScope;
	address?: string;
}

interface ForcedInputState {
	target: string;
	value: boolean;
}

/**
 * Ladder Logic execution engine.
 * Implements PLC scan cycle:
 * 1. Read inputs
 * 2. Evaluate networks in deterministic order
 * 3. Commit buffered writes
 * 4. Write outputs
 */
export class LadderEngine {
	private program: LadderProgram;
	private mode: ExecutionMode;
	private scanCycleMs: number;
	private runtimeClient?: RuntimeClient;
	private forcedInputs: Map<string, ForcedInputState> = new Map();

	// Memory areas (simulation mode)
	private inputs: Map<string, boolean> = new Map();
	private outputs: Map<string, boolean> = new Map();
	private markers: Map<string, boolean> = new Map();
	private memoryWords: Map<string, number> = new Map();

	// IEC variable bindings and symbolic storage.
	private localBindings: Map<string, VariableBinding> = new Map();
	private globalBindings: Map<string, VariableBinding> = new Map();
	private localBoolValues: Map<string, boolean> = new Map();
	private globalBoolValues: Map<string, boolean> = new Map();
	private localNumericValues: Map<string, number> = new Map();
	private globalNumericValues: Map<string, number> = new Map();

	// Write buffering prevents same-cycle cascades.
	private pendingWrites: Map<string, { target: string; value: AddressValue }> =
		new Map();

	// Stateful FB memory.
	private timerStates: Map<string, TimerState> = new Map();
	private counterStates: Map<string, CounterState> = new Map();

	// Execution control.
	private scanIntervalHandle?: NodeJS.Timeout;
	private isRunning = false;
	private scanCount = 0;
	private forcedAddresses: Set<string> = new Set();

	// Diagnostics surfaced to editor.
	private topologyDiagnostics: string[] = [];
	private semanticDiagnostics: string[] = [];

	// State callback.
	private onStateChange?: (state: unknown) => void;

	constructor(
		program: LadderProgram,
		mode: ExecutionMode = "simulation",
		options: LadderEngineOptions = {},
	) {
		this.program = program;
		this.mode = mode;
		this.scanCycleMs = options.scanCycleMs ?? 100;
		this.runtimeClient = options.runtimeClient;

		this.topologyDiagnostics = this.validateProgramTopology(program);
		if (this.topologyDiagnostics.length > 0) {
			throw new Error(
				`Invalid ladder topology:\n${this.topologyDiagnostics.join("\n")}`,
			);
		}

		this.initializeVariables();
		this.semanticDiagnostics = this.validateProgramSemantics(program);
		if (this.semanticDiagnostics.length > 0) {
			throw new Error(
				`Invalid ladder semantics:\n${this.semanticDiagnostics.join("\n")}`,
			);
		}
	}

	private initializeVariables(): void {
		this.inputs.clear();
		this.outputs.clear();
		this.markers.clear();
		this.memoryWords.clear();
		this.localBindings.clear();
		this.globalBindings.clear();
		this.localBoolValues.clear();
		this.globalBoolValues.clear();
		this.localNumericValues.clear();
		this.globalNumericValues.clear();
		this.forcedInputs.clear();
		this.forcedAddresses.clear();
		this.pendingWrites.clear();

		for (const variable of this.program.variables) {
			const name = variable.name?.trim();
			if (!name) {
				continue;
			}
			const scope = this.variableScope(variable);
			const scopeBindings =
				scope === "local" ? this.localBindings : this.globalBindings;
			const binding: VariableBinding = {
				name,
				type: variable.type,
				scope,
				address: this.normalizedAddress(variable.address),
			};
			scopeBindings.set(this.normalizedSymbolKey(name), binding);

			const initial = this.coerceValueForVariable(
				variable.type,
				variable.initialValue,
			);
			this.writeBinding(binding, initial);
		}
	}

	private variableScope(variable: Variable): VariableScope {
		return variable.scope === "local" ? "local" : "global";
	}

	private normalizedSymbolKey(name: string): string {
		return name.trim().toUpperCase();
	}

	private canonicalAddress(address: string): string {
		const trimmed = address.trim();
		if (!trimmed.startsWith("%") || trimmed.length < 3) {
			return trimmed;
		}
		return `%${trimmed.slice(1, 3).toUpperCase()}${trimmed.slice(3)}`;
	}

	private normalizedAddress(address?: string): string | undefined {
		const trimmed = address?.trim();
		if (!trimmed) {
			return undefined;
		}
		return this.isAddressToken(trimmed)
			? this.canonicalAddress(trimmed)
			: undefined;
	}

	private isAddressToken(token: string): boolean {
		const normalized = token.trim().toUpperCase();
		return (
			normalized.startsWith("%IX") ||
			normalized.startsWith("%QX") ||
			normalized.startsWith("%MX") ||
			normalized.startsWith("%MW")
		);
	}

	private coerceValueForVariable(
		type: Variable["type"],
		value: unknown,
	): AddressValue {
		if (type === "BOOL") {
			return this.toBooleanValue(value);
		}
		return this.toNumericValue(value);
	}

	private toBooleanValue(value: unknown): boolean {
		if (typeof value === "boolean") {
			return value;
		}
		if (typeof value === "number") {
			return value !== 0;
		}
		if (typeof value === "string") {
			const normalized = value.trim().toUpperCase();
			if (
				normalized === "TRUE" ||
				normalized === "1" ||
				normalized === "BOOL(TRUE)"
			) {
				return true;
			}
			if (
				normalized === "FALSE" ||
				normalized === "0" ||
				normalized === "BOOL(FALSE)"
			) {
				return false;
			}
		}
		return false;
	}

	private toNumericValue(value: unknown): number {
		if (typeof value === "number" && Number.isFinite(value)) {
			return value;
		}
		if (typeof value === "boolean") {
			return value ? 1 : 0;
		}
		if (typeof value === "string") {
			const parsed = Number(value);
			if (Number.isFinite(parsed)) {
				return parsed;
			}
		}
		return 0;
	}

	private symbolStorageMap(
		scope: VariableScope,
		type: Variable["type"],
	): Map<string, boolean> | Map<string, number> {
		if (type === "BOOL") {
			return scope === "local" ? this.localBoolValues : this.globalBoolValues;
		}
		return scope === "local"
			? this.localNumericValues
			: this.globalNumericValues;
	}

	private addressValueType(address: string): "bool" | "number" {
		return address.startsWith("%MW") ? "number" : "bool";
	}

	private writeAddress(address: string, value: AddressValue): void {
		if (address.startsWith("%MW")) {
			this.memoryWords.set(address, this.toNumericValue(value));
			return;
		}

		const boolValue = this.toBooleanValue(value);
		if (address.startsWith("%IX")) {
			this.inputs.set(address, boolValue);
		} else if (address.startsWith("%QX")) {
			this.outputs.set(address, boolValue);
		} else if (address.startsWith("%MX")) {
			this.markers.set(address, boolValue);
		}
	}

	private writeBinding(binding: VariableBinding, value: AddressValue): void {
		if (binding.address) {
			this.writeAddress(binding.address, value);
			return;
		}

		const symbolKey = this.normalizedSymbolKey(binding.name);
		const storage = this.symbolStorageMap(binding.scope, binding.type);
		if (binding.type === "BOOL") {
			(storage as Map<string, boolean>).set(
				symbolKey,
				this.toBooleanValue(value),
			);
		} else {
			(storage as Map<string, number>).set(
				symbolKey,
				this.toNumericValue(value),
			);
		}
	}

	private readAddressAsBoolean(address: string): boolean {
		if (address.startsWith("%IX")) {
			return this.inputs.get(address) ?? false;
		}
		if (address.startsWith("%QX")) {
			return this.outputs.get(address) ?? false;
		}
		if (address.startsWith("%MX")) {
			return this.markers.get(address) ?? false;
		}
		if (address.startsWith("%MW")) {
			return (this.memoryWords.get(address) ?? 0) !== 0;
		}
		return false;
	}

	private readAddressAsNumber(address: string): number {
		if (address.startsWith("%MW")) {
			return this.memoryWords.get(address) ?? 0;
		}
		return this.readAddressAsBoolean(address) ? 1 : 0;
	}

	private readBindingAsBoolean(binding: VariableBinding): boolean {
		if (binding.address) {
			return this.readAddressAsBoolean(binding.address);
		}

		const symbolKey = this.normalizedSymbolKey(binding.name);
		if (binding.type === "BOOL") {
			const storage =
				binding.scope === "local"
					? this.localBoolValues
					: this.globalBoolValues;
			return storage.get(symbolKey) ?? false;
		}
		const storage =
			binding.scope === "local"
				? this.localNumericValues
				: this.globalNumericValues;
		return (storage.get(symbolKey) ?? 0) !== 0;
	}

	private readBindingAsNumber(binding: VariableBinding): number {
		if (binding.address) {
			return this.readAddressAsNumber(binding.address);
		}

		const symbolKey = this.normalizedSymbolKey(binding.name);
		if (binding.type === "BOOL") {
			const storage =
				binding.scope === "local"
					? this.localBoolValues
					: this.globalBoolValues;
			return (storage.get(symbolKey) ?? false) ? 1 : 0;
		}
		const storage =
			binding.scope === "local"
				? this.localNumericValues
				: this.globalNumericValues;
		return storage.get(symbolKey) ?? 0;
	}

	private parseQualifiedSymbol(reference: string): {
		scope?: VariableScope;
		name: string;
	} {
		const trimmed = reference.trim();
		if (!trimmed) {
			return { name: "" };
		}

		const upper = trimmed.toUpperCase();
		if (upper.startsWith("LOCAL::")) {
			return { scope: "local", name: trimmed.slice(7).trim() };
		}
		if (upper.startsWith("L::")) {
			return { scope: "local", name: trimmed.slice(3).trim() };
		}
		if (upper.startsWith("GLOBAL::")) {
			return { scope: "global", name: trimmed.slice(8).trim() };
		}
		if (upper.startsWith("G::")) {
			return { scope: "global", name: trimmed.slice(3).trim() };
		}
		if (upper.startsWith("LOCAL.")) {
			return { scope: "local", name: trimmed.slice(6).trim() };
		}
		if (upper.startsWith("GLOBAL.")) {
			return { scope: "global", name: trimmed.slice(7).trim() };
		}

		return { name: trimmed };
	}

	private resolveBinding(reference: string): VariableBinding | undefined {
		const parsed = this.parseQualifiedSymbol(reference);
		if (!parsed.name) {
			return undefined;
		}

		const key = this.normalizedSymbolKey(parsed.name);
		if (parsed.scope === "local") {
			return this.localBindings.get(key);
		}
		if (parsed.scope === "global") {
			return this.globalBindings.get(key);
		}
		return this.localBindings.get(key) ?? this.globalBindings.get(key);
	}

	private hasShadowedSymbol(symbolName: string): boolean {
		return (
			this.localBindings.has(symbolName) && this.globalBindings.has(symbolName)
		);
	}

	private bindingStateKey(binding: VariableBinding): string {
		const symbolName = this.normalizedSymbolKey(binding.name);
		if (this.hasShadowedSymbol(symbolName)) {
			return `${binding.scope.toUpperCase()}::${binding.name}`;
		}
		return binding.name;
	}

	private readReferenceAsBoolean(reference: string): boolean {
		const resolved = this.resolveReference(reference);
		if (resolved?.kind === "address") {
			return this.readAddressAsBoolean(resolved.address);
		}
		if (resolved?.kind === "binding") {
			return this.readBindingAsBoolean(resolved.binding);
		}
		return false;
	}

	private readReferenceAsNumber(reference: string): number {
		const resolved = this.resolveReference(reference);
		if (resolved?.kind === "address") {
			return this.readAddressAsNumber(resolved.address);
		}
		if (resolved?.kind === "binding") {
			return this.readBindingAsNumber(resolved.binding);
		}
		return 0;
	}

	private writeReference(reference: string, value: AddressValue): void {
		const resolved = this.resolveReference(reference);
		if (resolved?.kind === "address") {
			this.writeAddress(resolved.address, value);
			return;
		}
		if (resolved?.kind === "binding") {
			this.writeBinding(resolved.binding, value);
			return;
		}

		const token = reference.trim();
		if (this.isAddressToken(token)) {
			this.writeAddress(this.canonicalAddress(token), value);
		}
	}

	private isNumericLiteralToken(token: string): boolean {
		const parsed = Number(token.trim());
		return Number.isFinite(parsed);
	}

	private isCoilAssignableAddress(address: string): boolean {
		return address.startsWith("%QX") || address.startsWith("%MX");
	}

	private isBooleanCompatibleType(type: Variable["type"]): boolean {
		return type === "BOOL";
	}

	private isNumericCompatibleType(type: Variable["type"]): boolean {
		return type !== "BOOL";
	}

	private validateProgramSemantics(program: LadderProgram): string[] {
		const diagnostics: string[] = [];
		const seenLocal = new Set<string>();
		const seenGlobal = new Set<string>();

		for (const variable of program.variables) {
			const name = variable.name?.trim();
			if (!name) {
				diagnostics.push("Variable declarations require a non-empty name.");
				continue;
			}
			const key = this.normalizedSymbolKey(name);
			const scope = this.variableScope(variable);
			const seen = scope === "local" ? seenLocal : seenGlobal;
			if (seen.has(key)) {
				diagnostics.push(`Duplicate ${scope} variable declaration '${name}'.`);
			}
			seen.add(key);

			const address = this.normalizedAddress(variable.address);
			if (variable.address && !address) {
				diagnostics.push(
					`Variable '${name}' uses unsupported address '${variable.address}'.`,
				);
			}
			if (address && variable.type === "BOOL" && address.startsWith("%MW")) {
				diagnostics.push(
					`Variable '${name}' is BOOL but bound to numeric word '${address}'.`,
				);
			}
			if (
				address &&
				variable.type !== "BOOL" &&
				(address.startsWith("%IX") ||
					address.startsWith("%QX") ||
					address.startsWith("%MX"))
			) {
				diagnostics.push(
					`Variable '${name}' is ${variable.type} but bound to boolean address '${address}'.`,
				);
			}
		}

		for (const network of program.networks) {
			for (const node of network.nodes) {
				if (node.type === "contact") {
					if (!isContactType(node.contactType)) {
						diagnostics.push(
							`Network '${network.id}' contact '${node.id}' has unsupported contactType '${String(
								(node as { contactType?: unknown }).contactType,
							)}'.`,
						);
					}
					const reference = node.variable.trim();
					if (
						reference &&
						!this.isAddressToken(reference) &&
						!this.resolveBinding(reference)
					) {
						diagnostics.push(
							`Network '${network.id}' contact '${node.id}' has unresolved variable '${node.variable}'.`,
						);
					}
					continue;
				}

				if (node.type === "coil") {
					if (!isCoilType(node.coilType)) {
						diagnostics.push(
							`Network '${network.id}' coil '${node.id}' has unsupported coilType '${String(
								(node as { coilType?: unknown }).coilType,
							)}'.`,
						);
					}
					const reference = node.variable.trim();
					if (!reference) {
						diagnostics.push(
							`Network '${network.id}' coil '${node.id}' requires a target variable.`,
						);
						continue;
					}
					if (this.isAddressToken(reference)) {
						const normalized = reference.toUpperCase();
						if (!this.isCoilAssignableAddress(normalized)) {
							diagnostics.push(
								`Network '${network.id}' coil '${node.id}' uses non-assignable target '${node.variable}'.`,
							);
						}
						continue;
					}

					const binding = this.resolveBinding(reference);
					if (!binding) {
						diagnostics.push(
							`Network '${network.id}' coil '${node.id}' has unresolved target '${node.variable}'.`,
						);
						continue;
					}
					if (!this.isBooleanCompatibleType(binding.type)) {
						diagnostics.push(
							`Network '${network.id}' coil '${node.id}' target '${node.variable}' must be BOOL-compatible.`,
						);
					}
					if (
						binding.address &&
						!this.isCoilAssignableAddress(binding.address.toUpperCase())
					) {
						diagnostics.push(
							`Network '${network.id}' coil '${node.id}' target '${node.variable}' resolves to non-assignable address '${binding.address}'.`,
						);
					}
					continue;
				}

				if (node.type === "timer") {
					if (!isTimerType(node.timerType)) {
						diagnostics.push(
							`Network '${network.id}' timer '${node.id}' has unsupported timerType '${String(
								(node as { timerType?: unknown }).timerType,
							)}'.`,
						);
					}

					if (!node.qOutput?.trim()) {
						diagnostics.push(
							`Network '${network.id}' timer '${node.id}' requires qOutput target.`,
						);
					} else if (this.isAddressToken(node.qOutput.trim())) {
						const normalized = node.qOutput.trim().toUpperCase();
						if (!this.isCoilAssignableAddress(normalized)) {
							diagnostics.push(
								`Network '${network.id}' timer '${node.id}' qOutput '${node.qOutput}' uses non-assignable BOOL target.`,
							);
						}
					} else {
						const binding = this.resolveBinding(node.qOutput.trim());
						if (!binding) {
							diagnostics.push(
								`Network '${network.id}' timer '${node.id}' qOutput '${node.qOutput}' is unresolved.`,
							);
						} else if (!this.isBooleanCompatibleType(binding.type)) {
							diagnostics.push(
								`Network '${network.id}' timer '${node.id}' qOutput '${node.qOutput}' must be BOOL-compatible.`,
							);
						}
					}

					if (!node.etOutput?.trim()) {
						diagnostics.push(
							`Network '${network.id}' timer '${node.id}' requires etOutput target.`,
						);
					} else if (this.isAddressToken(node.etOutput.trim())) {
						const normalized = node.etOutput.trim().toUpperCase();
						if (!normalized.startsWith("%MW")) {
							diagnostics.push(
								`Network '${network.id}' timer '${node.id}' etOutput '${node.etOutput}' must target numeric memory (%MW*) or numeric variable.`,
							);
						}
					} else {
						const binding = this.resolveBinding(node.etOutput.trim());
						if (!binding) {
							diagnostics.push(
								`Network '${network.id}' timer '${node.id}' etOutput '${node.etOutput}' is unresolved.`,
							);
						} else if (!this.isNumericCompatibleType(binding.type)) {
							diagnostics.push(
								`Network '${network.id}' timer '${node.id}' etOutput '${node.etOutput}' must be numeric-compatible.`,
							);
						}
					}

					if (node.input?.trim()) {
						const inputRef = node.input.trim();
						if (this.isAddressToken(inputRef)) {
							const normalized = inputRef.toUpperCase();
							if (
								!(
									normalized.startsWith("%IX") ||
									normalized.startsWith("%MX") ||
									normalized.startsWith("%QX")
								)
							) {
								diagnostics.push(
									`Network '${network.id}' timer '${node.id}' input '${node.input}' must resolve to BOOL-compatible source.`,
								);
							}
						} else {
							const binding = this.resolveBinding(inputRef);
							if (!binding) {
								diagnostics.push(
									`Network '${network.id}' timer '${node.id}' input '${node.input}' is unresolved.`,
								);
							} else if (!this.isBooleanCompatibleType(binding.type)) {
								diagnostics.push(
									`Network '${network.id}' timer '${node.id}' input '${node.input}' must be BOOL-compatible.`,
								);
							}
						}
					}

					continue;
				}

				if (node.type === "counter") {
					if (!isCounterType(node.counterType)) {
						diagnostics.push(
							`Network '${network.id}' counter '${node.id}' has unsupported counterType '${String(
								(node as { counterType?: unknown }).counterType,
							)}'.`,
						);
					}

					if (!node.qOutput?.trim()) {
						diagnostics.push(
							`Network '${network.id}' counter '${node.id}' requires qOutput target.`,
						);
					} else if (this.isAddressToken(node.qOutput.trim())) {
						const normalized = node.qOutput.trim().toUpperCase();
						if (!this.isCoilAssignableAddress(normalized)) {
							diagnostics.push(
								`Network '${network.id}' counter '${node.id}' qOutput '${node.qOutput}' uses non-assignable BOOL target.`,
							);
						}
					} else {
						const binding = this.resolveBinding(node.qOutput.trim());
						if (!binding) {
							diagnostics.push(
								`Network '${network.id}' counter '${node.id}' qOutput '${node.qOutput}' is unresolved.`,
							);
						} else if (!this.isBooleanCompatibleType(binding.type)) {
							diagnostics.push(
								`Network '${network.id}' counter '${node.id}' qOutput '${node.qOutput}' must be BOOL-compatible.`,
							);
						}
					}

					if (!node.cvOutput?.trim()) {
						diagnostics.push(
							`Network '${network.id}' counter '${node.id}' requires cvOutput target.`,
						);
					} else if (this.isAddressToken(node.cvOutput.trim())) {
						const normalized = node.cvOutput.trim().toUpperCase();
						if (!normalized.startsWith("%MW")) {
							diagnostics.push(
								`Network '${network.id}' counter '${node.id}' cvOutput '${node.cvOutput}' must target numeric memory (%MW*) or numeric variable.`,
							);
						}
					} else {
						const binding = this.resolveBinding(node.cvOutput.trim());
						if (!binding) {
							diagnostics.push(
								`Network '${network.id}' counter '${node.id}' cvOutput '${node.cvOutput}' is unresolved.`,
							);
						} else if (!this.isNumericCompatibleType(binding.type)) {
							diagnostics.push(
								`Network '${network.id}' counter '${node.id}' cvOutput '${node.cvOutput}' must be numeric-compatible.`,
							);
						}
					}

					if (node.input?.trim()) {
						const inputRef = node.input.trim();
						if (this.isAddressToken(inputRef)) {
							const normalized = inputRef.toUpperCase();
							if (
								!(
									normalized.startsWith("%IX") ||
									normalized.startsWith("%MX") ||
									normalized.startsWith("%QX")
								)
							) {
								diagnostics.push(
									`Network '${network.id}' counter '${node.id}' input '${node.input}' must resolve to BOOL-compatible source.`,
								);
							}
						} else {
							const binding = this.resolveBinding(inputRef);
							if (!binding) {
								diagnostics.push(
									`Network '${network.id}' counter '${node.id}' input '${node.input}' is unresolved.`,
								);
							} else if (!this.isBooleanCompatibleType(binding.type)) {
								diagnostics.push(
									`Network '${network.id}' counter '${node.id}' input '${node.input}' must be BOOL-compatible.`,
								);
							}
						}
					}

					continue;
				}

				if (node.type === "compare" || node.type === "math") {
					if (node.type === "compare" && !isCompareOp(node.op)) {
						diagnostics.push(
							`Network '${network.id}' compare '${node.id}' has unsupported operator '${String(
								(node as { op?: unknown }).op,
							)}'.`,
						);
					}
					if (node.type === "math" && !isMathOp(node.op)) {
						diagnostics.push(
							`Network '${network.id}' math '${node.id}' has unsupported operator '${String(
								(node as { op?: unknown }).op,
							)}'.`,
						);
					}
					const operands = [node.left, node.right];
					for (const operand of operands) {
						const token = operand.trim();
						if (!token || this.isNumericLiteralToken(token)) {
							continue;
						}
						if (this.isAddressToken(token)) {
							continue;
						}
						const binding = this.resolveBinding(token);
						if (!binding) {
							diagnostics.push(
								`Network '${network.id}' ${node.type} '${node.id}' has unresolved operand '${operand}'.`,
							);
							continue;
						}
						if (!this.isNumericCompatibleType(binding.type)) {
							diagnostics.push(
								`Network '${network.id}' ${node.type} '${node.id}' operand '${operand}' must be numeric-compatible.`,
							);
						}
					}
				}

				if (node.type === "math") {
					const target = node.output.trim();
					if (!target) {
						diagnostics.push(
							`Network '${network.id}' math '${node.id}' requires an output target.`,
						);
						continue;
					}
					if (this.isAddressToken(target)) {
						if (!target.toUpperCase().startsWith("%MW")) {
							diagnostics.push(
								`Network '${network.id}' math '${node.id}' output '${node.output}' must target numeric memory (%MW*) or a numeric variable.`,
							);
						}
						continue;
					}
					const binding = this.resolveBinding(target);
					if (!binding) {
						diagnostics.push(
							`Network '${network.id}' math '${node.id}' has unresolved output '${node.output}'.`,
						);
						continue;
					}
					if (!this.isNumericCompatibleType(binding.type)) {
						diagnostics.push(
							`Network '${network.id}' math '${node.id}' output '${node.output}' must be numeric-compatible.`,
						);
					}
				}
			}
		}

		return diagnostics;
	}

	private resolveReference(
		reference: string,
	):
		| { kind: "address"; address: string }
		| { kind: "binding"; binding: VariableBinding }
		| undefined {
		const token = reference.trim();
		if (!token) {
			return undefined;
		}
		if (this.isAddressToken(token)) {
			return { kind: "address", address: this.canonicalAddress(token) };
		}
		const binding = this.resolveBinding(token);
		if (binding) {
			return { kind: "binding", binding };
		}
		return undefined;
	}

	private pendingWriteKey(target: string): string {
		const resolved = this.resolveReference(target);
		if (resolved?.kind === "address") {
			return `A:${resolved.address}`;
		}
		if (resolved?.kind === "binding") {
			const binding = resolved.binding;
			const symbolKey = this.normalizedSymbolKey(binding.name);
			return `S:${binding.scope}:${symbolKey}`;
		}
		const token = target.trim();
		if (!token) {
			return "U:EMPTY";
		}
		if (this.isAddressToken(token)) {
			return `A:${this.canonicalAddress(token).toUpperCase()}`;
		}
		return `U:${token}`;
	}

	private validateProgramTopology(program: LadderProgram): string[] {
		const diagnostics: string[] = [];
		for (const network of program.networks) {
			diagnostics.push(...this.validateNetworkTopology(network));
		}
		return diagnostics;
	}

	private validateNetworkTopology(network: Network): string[] {
		const diagnostics: string[] = [];
		const nodeIdSet = new Set<string>();

		for (const node of network.nodes) {
			if (nodeIdSet.has(node.id)) {
				diagnostics.push(
					`Network '${network.id}': duplicate node id '${node.id}'.`,
				);
			}
			nodeIdSet.add(node.id);
		}

		for (const edge of network.edges) {
			if (!nodeIdSet.has(edge.fromNodeId)) {
				diagnostics.push(
					`Network '${network.id}': edge '${edge.id}' has unknown fromNodeId '${edge.fromNodeId}'.`,
				);
			}
			if (!nodeIdSet.has(edge.toNodeId)) {
				diagnostics.push(
					`Network '${network.id}': edge '${edge.id}' has unknown toNodeId '${edge.toNodeId}'.`,
				);
			}
		}

		const topology = this.buildNetworkTopology(network);
		const indegree = new Map<string, number>();
		for (const node of topology.sortedNodes) {
			indegree.set(node.id, 0);
		}
		for (const [fromId, toIds] of topology.outgoing.entries()) {
			if (fromId === LEFT_RAIL_ID) {
				continue;
			}
			for (const toId of toIds) {
				indegree.set(toId, (indegree.get(toId) ?? 0) + 1);
			}
		}

		const queue: LadderNode[] = topology.sortedNodes
			.filter((node) => (indegree.get(node.id) ?? 0) === 0)
			.sort(compareNodesDeterministic);
		const visited = new Set<string>();

		while (queue.length > 0) {
			const current = queue.shift();
			if (!current || visited.has(current.id)) {
				continue;
			}
			visited.add(current.id);
			const next = topology.outgoing.get(current.id) ?? [];
			for (const nextId of next) {
				const count = (indegree.get(nextId) ?? 0) - 1;
				indegree.set(nextId, count);
				if (count === 0) {
					const node = topology.sortedNodes.find(
						(entry) => entry.id === nextId,
					);
					if (node) {
						queue.push(node);
						queue.sort(compareNodesDeterministic);
					}
				}
			}
		}

		if (visited.size !== topology.sortedNodes.length) {
			diagnostics.push(
				`Network '${network.id}': graph contains a cycle or unreachable loop.`,
			);
		}

		const reachable = new Set<string>();
		const frontier = [...(topology.outgoing.get(LEFT_RAIL_ID) ?? [])];
		while (frontier.length > 0) {
			const current = frontier.shift();
			if (!current || reachable.has(current)) {
				continue;
			}
			reachable.add(current);
			const next = topology.outgoing.get(current) ?? [];
			frontier.push(...next);
		}

		for (const node of topology.sortedNodes) {
			if (!reachable.has(node.id)) {
				diagnostics.push(
					`Network '${network.id}': node '${node.id}' is disconnected from the left power rail.`,
				);
			}
		}

		return diagnostics;
	}

	async start(): Promise<void> {
		if (this.isRunning) {
			return;
		}

		this.isRunning = true;
		this.scanCount = 0;

		await this.executeScanCycle();
		this.scanIntervalHandle = setInterval(async () => {
			await this.executeScanCycle();
		}, this.scanCycleMs);
	}

	async stop(): Promise<void> {
		if (!this.isRunning) {
			return;
		}

		this.isRunning = false;
		if (this.scanIntervalHandle) {
			clearInterval(this.scanIntervalHandle);
			this.scanIntervalHandle = undefined;
		}

		await this.clearAllOutputs();
	}

	private async executeScanCycle(): Promise<void> {
		this.scanCount += 1;

		try {
			this.pendingWrites.clear();
			await this.readInputs();
			this.applyForcedInputOverrides();
			await this.evaluateNetworks();
			this.applyPendingWrites();
			await this.writeOutputs();

			if (this.onStateChange) {
				this.onStateChange(this.getExecutionState());
			}
		} catch (error) {
			console.error(`Error in scan cycle ${this.scanCount}:`, error);
		}
	}

	private async readInputs(): Promise<void> {
		if (this.mode !== "hardware" || !this.runtimeClient?.isConnected()) {
			return;
		}

		for (const address of this.inputs.keys()) {
			try {
				const value = await this.runtimeClient.readIo(address);
				this.inputs.set(address, Boolean(value));
			} catch (error) {
				console.error(`Failed to read ${address}:`, error);
			}
		}
	}

	private async evaluateNetworks(): Promise<void> {
		const ordered = [...this.program.networks].sort(
			(left, right) => left.order - right.order,
		);

		for (const network of ordered) {
			await this.evaluateNetwork(network);
		}
	}

	private async evaluateNetwork(network: Network): Promise<void> {
		const topology = this.buildNetworkTopology(network);
		const nodeById = new Map<string, LadderNode>(
			topology.sortedNodes.map((node) => [node.id, node]),
		);

		const indegree = new Map<string, number>();
		for (const node of topology.sortedNodes) {
			indegree.set(node.id, 0);
		}
		for (const [fromId, toIds] of topology.outgoing.entries()) {
			if (fromId === LEFT_RAIL_ID) {
				continue;
			}
			for (const toId of toIds) {
				indegree.set(toId, (indegree.get(toId) ?? 0) + 1);
			}
		}

		const queue = topology.sortedNodes
			.filter((node) => (indegree.get(node.id) ?? 0) === 0)
			.sort(compareNodesDeterministic);
		const order: LadderNode[] = [];

		while (queue.length > 0) {
			const next = queue.shift();
			if (!next) {
				continue;
			}
			order.push(next);
			const outgoing = topology.outgoing.get(next.id) ?? [];
			for (const toId of outgoing) {
				const remaining = (indegree.get(toId) ?? 0) - 1;
				indegree.set(toId, remaining);
				if (remaining === 0) {
					const node = nodeById.get(toId);
					if (node) {
						queue.push(node);
						queue.sort(compareNodesDeterministic);
					}
				}
			}
		}

		// Deterministic fallback for partially disconnected acyclic nodes.
		if (order.length < topology.sortedNodes.length) {
			for (const node of topology.sortedNodes) {
				if (!order.find((entry) => entry.id === node.id)) {
					order.push(node);
				}
			}
		}

		const outgoingPower = new Map<string, boolean>();

		for (const node of order) {
			const incomingSources = topology.incoming.get(node.id) ?? [];
			const incomingPower =
				incomingSources.length === 0
					? false
					: incomingSources.some((source) => {
							if (source === LEFT_RAIL_ID) {
								return true;
							}
							return outgoingPower.get(source) ?? false;
						});

			const context: NodeEvalContext = { incomingPower };
			const outPower = await this.evaluateNode(node, context);
			outgoingPower.set(node.id, outPower);
		}
	}

	private buildNetworkTopology(network: Network): NetworkTopology {
		const sortedNodes = [...network.nodes].sort(compareNodesDeterministic);
		const incoming = new Map<string, string[]>();
		const outgoing = new Map<string, string[]>();

		for (const node of sortedNodes) {
			incoming.set(node.id, []);
			outgoing.set(node.id, []);
		}
		outgoing.set(LEFT_RAIL_ID, []);

		const addEdge = (from: string, to: string): void => {
			if (!incoming.has(to)) {
				return;
			}
			if (!outgoing.has(from)) {
				outgoing.set(from, []);
			}
			const fromTargets = outgoing.get(from) ?? [];
			if (!fromTargets.includes(to)) {
				fromTargets.push(to);
				outgoing.set(from, fromTargets);
			}
			const toSources = incoming.get(to) ?? [];
			if (!toSources.includes(from)) {
				toSources.push(from);
				incoming.set(to, toSources);
			}
		};

		if (network.edges.length > 0) {
			for (const edge of network.edges) {
				addEdge(edge.fromNodeId, edge.toNodeId);
			}

			const nodesWithNoIncoming = sortedNodes.filter(
				(node) => (incoming.get(node.id) ?? []).length === 0,
			);
			for (const node of nodesWithNoIncoming) {
				addEdge(LEFT_RAIL_ID, node.id);
			}
		} else if (sortedNodes.length > 0) {
			addEdge(LEFT_RAIL_ID, sortedNodes[0].id);
			for (let idx = 0; idx < sortedNodes.length - 1; idx += 1) {
				addEdge(sortedNodes[idx].id, sortedNodes[idx + 1].id);
			}
		}

		return {
			incoming,
			outgoing,
			sortedNodes,
		};
	}

	private async evaluateNode(
		node: LadderNode,
		context: NodeEvalContext,
	): Promise<boolean> {
		if (node.type === "contact") {
			return context.incomingPower && this.evaluateContact(node);
		}

		if (node.type === "coil") {
			await this.executeCoil(node, context.incomingPower);
			return context.incomingPower;
		}

		if (node.type === "timer") {
			await this.executeTimer(node, context.incomingPower);
			return context.incomingPower;
		}

		if (node.type === "counter") {
			await this.executeCounter(node, context.incomingPower);
			return context.incomingPower;
		}

		if (node.type === "compare") {
			this.executeCompare(node, context.incomingPower);
			return context.incomingPower;
		}

		if (node.type === "math") {
			this.executeMath(node, context.incomingPower);
			return context.incomingPower;
		}

		// Topology-only nodes pass power through.
		return context.incomingPower;
	}

	private evaluateContact(contact: Contact): boolean {
		const value = this.readVariable(contact.variable);
		if (contact.contactType === "NO") {
			return value;
		}
		return !value;
	}

	private async executeCoil(coil: Coil, networkPower: boolean): Promise<void> {
		if (coil.coilType === "NORMAL") {
			this.bufferWrite(coil.variable, networkPower);
			return;
		}

		if (coil.coilType === "NEGATED") {
			this.bufferWrite(coil.variable, !networkPower);
			return;
		}

		if (coil.coilType === "SET") {
			if (networkPower) {
				this.bufferWrite(coil.variable, true);
			}
			return;
		}

		if (coil.coilType === "RESET") {
			if (networkPower) {
				this.bufferWrite(coil.variable, false);
			}
			return;
		}

		throw new Error(`Unsupported coilType '${String(coil.coilType)}'.`);
	}

	private async executeTimer(
		timer: Timer,
		networkPower: boolean,
	): Promise<void> {
		const key = timer.instance.trim() || timer.id;
		const state = this.timerStates.get(key) ?? {
			etMs: 0,
			lastIn: false,
		};

		const presetMs = Math.max(0, Math.round(timer.presetMs));
		const timerInput =
			timer.input && timer.input.trim().length > 0
				? this.readReferenceAsBoolean(timer.input.trim())
				: networkPower;
		let q = false;

		if (timer.timerType === "TON") {
			if (timerInput) {
				state.etMs = Math.min(presetMs, state.etMs + this.scanCycleMs);
			} else {
				state.etMs = 0;
			}
			q = timerInput && state.etMs >= presetMs;
		} else if (timer.timerType === "TOF") {
			if (timerInput) {
				state.etMs = presetMs;
				q = true;
			} else {
				if (state.lastIn) {
					state.etMs = presetMs;
				}
				state.etMs = Math.max(0, state.etMs - this.scanCycleMs);
				q = state.etMs > 0;
			}
		} else if (timer.timerType === "TP") {
			// TP pulse timer driven by rising edge on network power.
			const rising = timerInput && !state.lastIn;
			if (rising) {
				state.etMs = presetMs;
			}
			if (state.etMs > 0) {
				q = true;
				state.etMs = Math.max(0, state.etMs - this.scanCycleMs);
			}
		} else {
			throw new Error(`Unsupported timerType '${String(timer.timerType)}'.`);
		}

		state.lastIn = timerInput;
		this.timerStates.set(key, state);

		this.bufferWrite(timer.etOutput, state.etMs);
		this.bufferWrite(timer.qOutput, q);
	}

	private async executeCounter(
		counter: Counter,
		networkPower: boolean,
	): Promise<void> {
		const key = counter.instance.trim() || counter.id;
		const state = this.counterStates.get(key) ?? {
			cv: 0,
			lastIn: false,
		};

		const counterInput =
			counter.input && counter.input.trim().length > 0
				? this.readReferenceAsBoolean(counter.input.trim())
				: networkPower;
		const rising = counterInput && !state.lastIn;

		if (rising) {
			if (counter.counterType === "CTU") {
				state.cv += 1;
			} else if (counter.counterType === "CTD") {
				state.cv -= 1;
			} else if (counter.counterType === "CTUD") {
				// CTUD node model currently exposes one power input;
				// treat it as CU in this profile.
				state.cv += 1;
			} else {
				throw new Error(
					`Unsupported counterType '${String(counter.counterType)}'.`,
				);
			}
		}

		const q =
			counter.counterType === "CTD"
				? state.cv <= 0
				: state.cv >= counter.preset;

		state.lastIn = counterInput;
		this.counterStates.set(key, state);

		this.bufferWrite(counter.cvOutput, state.cv);
		this.bufferWrite(counter.qOutput, q);
	}

	private executeCompare(node: CompareNode, networkPower: boolean): void {
		if (!networkPower) {
			return;
		}

		const left = this.resolveNumericOperand(node.left);
		const right = this.resolveNumericOperand(node.right);
		let result = false;

		if (node.op === "GT") {
			result = left > right;
		} else if (node.op === "LT") {
			result = left < right;
		} else if (node.op === "EQ") {
			result = left === right;
		} else {
			throw new Error(`Unsupported compare operator '${String(node.op)}'.`);
		}

		this.bufferWrite(`%MX_LD_COMPARE_${node.id}_Q`, result);
	}

	private executeMath(node: MathNode, networkPower: boolean): void {
		if (!networkPower) {
			return;
		}

		const left = this.resolveNumericOperand(node.left);
		const right = this.resolveNumericOperand(node.right);
		let result = 0;

		if (node.op === "ADD") {
			result = left + right;
		} else if (node.op === "SUB") {
			result = left - right;
		} else if (node.op === "MUL") {
			result = left * right;
		} else if (node.op === "DIV") {
			result = right === 0 ? 0 : left / right;
		} else {
			throw new Error(`Unsupported math operator '${String(node.op)}'.`);
		}

		const outputTarget = node.output.trim();
		const resolvedOutput = this.resolveReference(outputTarget);
		if (
			resolvedOutput?.kind === "binding" ||
			(resolvedOutput?.kind === "address" &&
				resolvedOutput.address.startsWith("%MW"))
		) {
			this.bufferWrite(outputTarget, result);
			return;
		}

		this.bufferWrite(`%MW_LD_MATH_${node.id}_OUT`, result);
	}

	private resolveNumericOperand(operand: string): number {
		const trimmed = operand.trim();
		if (!trimmed) {
			return 0;
		}

		if (this.isNumericLiteralToken(trimmed)) {
			return Number(trimmed);
		}

		return this.readReferenceAsNumber(trimmed);
	}

	private bufferWrite(target: string, value: AddressValue): void {
		const key = this.pendingWriteKey(target);
		this.pendingWrites.set(key, { target, value });
	}

	private applyPendingWrites(): void {
		for (const pending of this.pendingWrites.values()) {
			this.writeReference(pending.target, pending.value);
		}
	}

	private readVariable(reference: string): boolean {
		return this.readReferenceAsBoolean(reference);
	}

	private inputForceKey(reference: string): string | undefined {
		const resolved = this.resolveReference(reference);
		if (!resolved) {
			return undefined;
		}

		if (resolved.kind === "address") {
			if (!resolved.address.startsWith("%IX")) {
				return undefined;
			}
			return resolved.address;
		}

		if (resolved.binding.type !== "BOOL") {
			return undefined;
		}

		if (resolved.binding.address) {
			const address = this.canonicalAddress(resolved.binding.address);
			if (!address.startsWith("%IX")) {
				return undefined;
			}
			return address;
		}

		return `${SYMBOL_FORCE_PREFIX}${this.bindingStateKey(resolved.binding)}`;
	}

	private forcedInputDisplayKey(key: string): string {
		if (key.startsWith(SYMBOL_FORCE_PREFIX)) {
			return key.slice(SYMBOL_FORCE_PREFIX.length);
		}
		return key;
	}

	private forcedInputStateObject(): Record<string, boolean> {
		const values: Record<string, boolean> = {};
		for (const [key, forced] of this.forcedInputs.entries()) {
			values[this.forcedInputDisplayKey(key)] = forced.value;
		}
		return values;
	}

	private variableSnapshots(): {
		variableBooleans: Record<string, boolean>;
		variableNumbers: Record<string, number>;
	} {
		const variableBooleans: Record<string, boolean> = {};
		const variableNumbers: Record<string, number> = {};

		const appendBinding = (binding: VariableBinding) => {
			const key = this.bindingStateKey(binding);
			if (binding.type === "BOOL") {
				variableBooleans[key] = this.readBindingAsBoolean(binding);
			} else {
				variableNumbers[key] = this.readBindingAsNumber(binding);
			}
		};

		for (const binding of this.globalBindings.values()) {
			appendBinding(binding);
		}
		for (const binding of this.localBindings.values()) {
			appendBinding(binding);
		}

		return { variableBooleans, variableNumbers };
	}

	private async writeOutputs(): Promise<void> {
		if (this.mode !== "hardware" || !this.runtimeClient?.isConnected()) {
			return;
		}

		for (const [address, value] of this.outputs) {
			try {
				await this.runtimeClient.forceIo(address, value);
				this.forcedAddresses.add(address);
			} catch (error) {
				console.error(`Failed to write ${address}:`, error);
			}
		}
	}

	private async clearAllOutputs(): Promise<void> {
		for (const address of this.outputs.keys()) {
			this.outputs.set(address, false);
		}

		if (this.mode !== "hardware" || !this.runtimeClient?.isConnected()) {
			return;
		}

		for (const address of this.forcedAddresses) {
			try {
				await this.runtimeClient.unforceIo(address);
			} catch (error) {
				console.error(`Failed to unforce ${address}:`, error);
			}
		}
		this.forcedAddresses.clear();
		this.forcedInputs.clear();
	}

	writeInput(address: string, value: boolean): void {
		const target = address.trim();
		if (!target) {
			return;
		}
		const key = this.inputForceKey(target);
		if (!key) {
			return;
		}
		const forced = this.forcedInputs.get(key);
		this.writeReference(forced?.target ?? target, value);
	}

	/**
	 * Backward-compatible alias used by existing tests.
	 */
	setInput(address: string, value: boolean): void {
		this.writeInput(address, value);
	}

	forceInput(address: string, value: boolean): void {
		const target = address.trim();
		if (!target) {
			return;
		}
		const key = this.inputForceKey(target);
		if (!key) {
			return;
		}
		this.forcedInputs.set(key, { target, value });
		this.writeReference(target, value);
	}

	releaseInput(address: string): void {
		const target = address.trim();
		if (!target) {
			return;
		}
		const key = this.inputForceKey(target);
		if (!key) {
			return;
		}
		this.forcedInputs.delete(key);
	}

	isInputForced(address: string): boolean {
		const key = this.inputForceKey(address.trim());
		if (!key) {
			return false;
		}
		return this.forcedInputs.has(key);
	}

	private applyForcedInputOverrides(): void {
		for (const forced of this.forcedInputs.values()) {
			this.writeReference(forced.target, forced.value);
		}
	}

	getOutput(address: string): boolean {
		if (!address.trim().startsWith("%QX")) {
			return this.readReferenceAsBoolean(address);
		}
		return this.outputs.get(address) ?? false;
	}

	getExecutionState(): unknown {
		const variables = this.variableSnapshots();
		return {
			scanCount: this.scanCount,
			mode: this.mode,
			inputs: Object.fromEntries(this.inputs),
			forcedInputs: this.forcedInputStateObject(),
			outputs: Object.fromEntries(this.outputs),
			markers: Object.fromEntries(this.markers),
			memoryWords: Object.fromEntries(this.memoryWords),
			variableBooleans: variables.variableBooleans,
			variableNumbers: variables.variableNumbers,
			topologyDiagnostics: this.topologyDiagnostics,
			semanticDiagnostics: this.semanticDiagnostics,
		};
	}

	setStateChangeCallback(callback: (state: unknown) => void): void {
		this.onStateChange = callback;
	}

	updateProgram(program: LadderProgram): void {
		const topologyDiagnostics = this.validateProgramTopology(program);
		if (topologyDiagnostics.length > 0) {
			throw new Error(
				`Invalid ladder topology:\n${topologyDiagnostics.join("\n")}`,
			);
		}

		this.program = program;
		this.topologyDiagnostics = topologyDiagnostics;
		this.timerStates.clear();
		this.counterStates.clear();
		this.initializeVariables();

		const semanticDiagnostics = this.validateProgramSemantics(program);
		this.semanticDiagnostics = semanticDiagnostics;
		if (semanticDiagnostics.length > 0) {
			throw new Error(
				`Invalid ladder semantics:\n${semanticDiagnostics.join("\n")}`,
			);
		}
	}

	async cleanup(): Promise<void> {
		await this.stop();

		this.inputs.clear();
		this.outputs.clear();
		this.markers.clear();
		this.memoryWords.clear();
		this.localBindings.clear();
		this.globalBindings.clear();
		this.localBoolValues.clear();
		this.globalBoolValues.clear();
		this.localNumericValues.clear();
		this.globalNumericValues.clear();
		this.pendingWrites.clear();
		this.forcedInputs.clear();
		this.forcedAddresses.clear();
		this.timerStates.clear();
		this.counterStates.clear();
		this.topologyDiagnostics = [];
		this.semanticDiagnostics = [];
	}
}

function compareNodesDeterministic(
	left: LadderNode,
	right: LadderNode,
): number {
	if (left.position.x !== right.position.x) {
		return left.position.x - right.position.x;
	}
	if (left.position.y !== right.position.y) {
		return left.position.y - right.position.y;
	}
	return left.id.localeCompare(right.id);
}
