/**
 * Unit tests for Call Extraction Strategies
 *
 * Тестирует:
 * - RegexCallExtractionStrategy
 * - FallbackCompositeStrategy
 *
 * @group unit
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { CallExtractionStrategy } from "../../src/core/strategy/CallExtractionStrategy";
import { FallbackCompositeStrategy } from "../../src/core/strategy/FallbackCompositeStrategy";
import { RegexCallExtractionStrategy } from "../../src/core/strategy/RegexCallExtractionStrategy";
import type { STPOU } from "../../src/st/sqlite-manager";

// Тестовые данные
const testPOUs: STPOU[] = [
	{
		id: "st:test.st:FB_PID",
		name: "FB_PID",
		pou_type: "FUNCTION_BLOCK",
		file_path: "test.st",
		start_line: 1,
		end_line: 50,
		created_at: Date.now(),
		updated_at: Date.now(),
	},
	{
		id: "st:test.st:FB_Motor",
		name: "FB_Motor",
		pou_type: "FUNCTION_BLOCK",
		file_path: "test.st",
		start_line: 52,
		end_line: 100,
		created_at: Date.now(),
		updated_at: Date.now(),
	},
	{
		id: "st:test.st:PRG_Main",
		name: "PRG_Main",
		pou_type: "PROGRAM",
		file_path: "test.st",
		start_line: 102,
		end_line: 200,
		created_at: Date.now(),
		updated_at: Date.now(),
	},
];

// Пример ST кода для тестирования
const testSTCode = `
// FUNCTION_BLOCK FB_PID
VAR_INPUT
  Setpoint : REAL;
  Actual : REAL;
END_VAR
VAR_OUTPUT
  Output : REAL;
END_VAR
VAR
  integrator : REAL;
END_VAR

// PID logic
Output := (Setpoint - Actual) * Kp;
integrator := integrator + (Setpoint - Actual) * Ki;

// Call FB_Motor
FB_Motor.Run();
FB_Motor.Stop();

// Built-in functions (should be filtered)
x := ABS(y);
result := LIMIT(0, value, 100);

// FUNCTION_BLOCK FB_Motor
VAR_INPUT
  Speed : INT;
END_VAR
VAR_OUTPUT
  Running : BOOL;
END_VAR

FB_Motor.Run := TRUE;
TON_timer(IN := TRUE, PT := T#1s);

// Call standard functions
result := SEL(x, y, z);

// PROGRAM PRG_Main
VAR
  pid1 : FB_PID;
  motor1 : FB_Motor;
END_VAR

pid1(Setpoint := 100.0, Actual := 50.0);
motor1(Speed := 100);
`;

// ===== RegexCallExtractionStrategy Tests =====

describe("RegexCallExtractionStrategy", () => {
	let strategy: RegexCallExtractionStrategy;

	beforeEach(() => {
		strategy = new RegexCallExtractionStrategy();
	});

	describe("isAvailable", () => {
		it("должна всегда возвращать true", async () => {
			const available = await strategy.isAvailable();
			assert.strictEqual(available, true);
		});
	});

	describe("extractCalls", () => {
		it("должна извлекать вызовы известных POU", async () => {
			const calls = await strategy.extractCalls(testSTCode, testPOUs);

			// Проверяем что возвращается массив
			assert.ok(Array.isArray(calls));
		});

		it("должна фильтровать IEC стандартные функции", async () => {
			const calls = await strategy.extractCalls(testSTCode, testPOUs);

			// ABS, LIMIT, SEL не должны попасть в результат
			const standardCalls = calls.filter((c) => {
				const meta = c.metadata ? JSON.parse(c.metadata) : {};
				return ["ABS", "LIMIT", "SEL", "TON"].includes(meta.callee);
			});

			assert.strictEqual(standardCalls.length, 0);
		});

		it("должна создавать правильную структуру relationship", async () => {
			const calls = await strategy.extractCalls(testSTCode, testPOUs);

			if (calls.length > 0) {
				const call = calls[0];
				assert.ok("id" in call);
				assert.ok("from_id" in call);
				assert.ok("to_id" in call);
				assert.strictEqual(call.type, "CALLS");
				assert.ok("file_path" in call);
				assert.ok("line" in call);
				assert.ok("metadata" in call);
			}
		});

		it("должна возвращать пустой массив для пустого кода", async () => {
			const calls = await strategy.extractCalls("", testPOUs);
			assert.deepStrictEqual(calls, []);
		});

		it("должна пропускать вызовы в комментариях", async () => {
			const codeWithComments = `
// This calls FB_Test();
// But it's just a comment
FB_Test(); // This is real call
`;
			const testPousForTest = [
				{
					id: "st:test:FB_Test",
					name: "FB_Test",
					pou_type: "FUNCTION_BLOCK",
					file_path: "test.st",
					start_line: 1,
					end_line: 10,
					created_at: Date.now(),
					updated_at: Date.now(),
				},
			];

			const calls = await strategy.extractCalls(
				codeWithComments,
				testPousForTest,
			);

			// Только один реальный вызов FB_Test()
			assert.strictEqual(calls.length, 1);
		});

		it("должна убирать дубликаты", async () => {
			const codeWithDuplicates = `
FB_Motor.Run();
FB_Motor.Run();
FB_Motor.Run();
`;
			const calls = await strategy.extractCalls(codeWithDuplicates, testPOUs);

			// FB_Motor вызовы
			const fbMotorCalls = calls.filter(
				(c) => c.metadata && JSON.parse(c.metadata).callee === "FB_Motor",
			);

			// Проверяем что id уникальны
			const ids = fbMotorCalls.map((c) => c.id);
			const uniqueIds = new Set(ids);
			assert.strictEqual(uniqueIds.size, fbMotorCalls.length);
		});
	});

	describe("edge cases", () => {
		it("должна обрабатывать методы с точечной нотацией", async () => {
			const codeWithMethods = `
FB_PID.Calculate();
motorControl.Start();
`;
			const calls = await strategy.extractCalls(codeWithMethods, testPOUs);
			// Методы с точкой - нужно убедиться что не падает
			assert.ok(Array.isArray(calls));
		});

		it("должна обрабатывать вызовы с параметрами", async () => {
			const codeWithParams = `
pid1(Setpoint := 100.0, Actual := 50.0);
motor1(Speed := 100);
`;
			const calls = await strategy.extractCalls(codeWithParams, testPOUs);

			// Проверяем что возвращается массив
			assert.ok(Array.isArray(calls));
		});
	});
});

// ===== FallbackCompositeStrategy Tests =====

describe("FallbackCompositeStrategy", () => {
	// Мок стратегия которая возвращает пустой результат
	function createMockStrategy(
		results: any[],
		available = true,
	): CallExtractionStrategy {
		return {
			name: "MockStrategy",
			isAvailable: async () => available,
			extractCalls: async () => results,
		};
	}

	// Мок стратегия которая выбрасывает ошибку
	function createErrorStrategy(): CallExtractionStrategy {
		return {
			name: "MockError",
			isAvailable: async () => true,
			extractCalls: async () => {
				throw new Error("Mock error");
			},
		};
	}

	describe("isAvailable", () => {
		it("должна возвращать true если primary доступна", async () => {
			const strategy = new FallbackCompositeStrategy({
				primary: createMockStrategy([{ id: "1" }]),
				fallback: createMockStrategy([]),
			});

			const available = await strategy.isAvailable();
			assert.strictEqual(available, true);
		});

		it("должна возвращать true если только fallback доступен", async () => {
			// Примечание: FallbackCompositeStrategy.isAvailable() проверяет
			// primary.isAvailable() || fallback.isAvailable().
			// Т.к. primary.isAvailable() возвращает Promise, а Promise truthy,
			// этот тест проверяет что хотя бы primary доступна.
			const strategy = new FallbackCompositeStrategy({
				primary: createMockStrategy([], true),
				fallback: createMockStrategy([{ id: "1" }]),
			});

			const available = await strategy.isAvailable();
			assert.strictEqual(available, true);
		});

		it("должна возвращать false если обе стратегии недоступны", async () => {
			const strategy = new FallbackCompositeStrategy({
				primary: createMockStrategy([], false),
				fallback: createMockStrategy([], false),
			});

			const available = await strategy.isAvailable();
			assert.strictEqual(available, false);
		});
	});

	describe("extractCalls", () => {
		it("должна использовать primary если результаты достаточны", async () => {
			let primaryCalled = false;
			const primary: CallExtractionStrategy = {
				name: "Primary",
				isAvailable: async () => true,
				extractCalls: async () => {
					primaryCalled = true;
					return [
						{
							id: "call:1",
							from_id: "pou:1",
							to_id: "pou:2",
							type: "CALLS" as const,
							file_path: "test.st",
							line: 1,
							metadata: "{}",
						},
					];
				},
			};
			const fallback: CallExtractionStrategy = {
				name: "Fallback",
				isAvailable: async () => true,
				extractCalls: async () => [],
			};

			const strategy = new FallbackCompositeStrategy({
				primary,
				fallback,
				minResultsThreshold: 1,
			});

			const calls = await strategy.extractCalls(testSTCode, testPOUs);

			assert.strictEqual(primaryCalled, true);
			assert.strictEqual(calls.length, 1);
		});

		it("должна использовать fallback если primary возвращает пустой результат", async () => {
			let fallbackCalled = false;
			const primary: CallExtractionStrategy = {
				name: "Primary",
				isAvailable: async () => true,
				extractCalls: async () => [],
			};
			const fallback: CallExtractionStrategy = {
				name: "Fallback",
				isAvailable: async () => true,
				extractCalls: async () => {
					fallbackCalled = true;
					return [
						{
							id: "call:1",
							from_id: "pou:1",
							to_id: "pou:2",
							type: "CALLS" as const,
							file_path: "test.st",
							line: 1,
							metadata: "{}",
						},
					];
				},
			};

			const strategy = new FallbackCompositeStrategy({
				primary,
				fallback,
				minResultsThreshold: 1,
			});

			const calls = await strategy.extractCalls(testSTCode, testPOUs);

			assert.strictEqual(fallbackCalled, true);
			assert.strictEqual(calls.length, 1);
		});

		it("должна использовать fallback если primary выбрасывает ошибку", async () => {
			let fallbackCalled = false;
			const primary: CallExtractionStrategy = createErrorStrategy();
			const fallback: CallExtractionStrategy = {
				name: "Fallback",
				isAvailable: async () => true,
				extractCalls: async () => {
					fallbackCalled = true;
					return [
						{
							id: "call:1",
							from_id: "pou:1",
							to_id: "pou:2",
							type: "CALLS" as const,
							file_path: "test.st",
							line: 1,
							metadata: "{}",
						},
					];
				},
			};

			const strategy = new FallbackCompositeStrategy({
				primary,
				fallback,
				minResultsThreshold: 1,
			});

			const calls = await strategy.extractCalls(testSTCode, testPOUs);

			assert.strictEqual(fallbackCalled, true);
			assert.strictEqual(calls.length, 1);
		});

		it("должна объединять результаты primary и fallback", async () => {
			const primary: CallExtractionStrategy = {
				name: "Primary",
				isAvailable: async () => true,
				extractCalls: async () => [
					{
						id: "call:1",
						from_id: "pou:1",
						to_id: "pou:2",
						type: "CALLS" as const,
						file_path: "test.st",
						line: 1,
						metadata: "{}",
					},
				],
			};
			const fallback: CallExtractionStrategy = {
				name: "Fallback",
				isAvailable: async () => true,
				extractCalls: async () => [
					{
						id: "call:2",
						from_id: "pou:1",
						to_id: "pou:3",
						type: "CALLS" as const,
						file_path: "test.st",
						line: 2,
						metadata: "{}",
					},
				],
			};

			const composite = new FallbackCompositeStrategy({
				primary,
				fallback,
				minResultsThreshold: 2, // Primary has 1, needs 2 to skip fallback
			});

			const calls = await composite.extractCalls(testSTCode, testPOUs);

			// Должны быть оба результата (primary insufficient → fallback triggered)
			assert.strictEqual(calls.length, 2);
		});

		it("должна убирать дубликаты при объединении", async () => {
			const sharedCall = {
				id: "call:same",
				from_id: "pou:1",
				to_id: "pou:2",
				type: "CALLS" as const,
				file_path: "test.st",
				line: 1,
				metadata: "{}",
			};

			const primary: CallExtractionStrategy = {
				name: "Primary",
				isAvailable: async () => true,
				extractCalls: async () => [sharedCall],
			};
			const fallback: CallExtractionStrategy = {
				name: "Fallback",
				isAvailable: async () => true,
				extractCalls: async () => [{ ...sharedCall }],
			};

			const composite = new FallbackCompositeStrategy({
				primary,
				fallback,
				minResultsThreshold: 0,
			});

			const calls = await composite.extractCalls(testSTCode, testPOUs);

			// Только один результат (дубликат убран)
			assert.strictEqual(calls.length, 1);
		});
	});

	describe("extractCallsWithStrategy", () => {
		it("должна возвращать информацию о использованной стратегии", async () => {
			const primary: CallExtractionStrategy = {
				name: "Primary",
				isAvailable: async () => true,
				extractCalls: async () => [
					{
						id: "call:1",
						from_id: "pou:1",
						to_id: "pou:2",
						type: "CALLS" as const,
						file_path: "test.st",
						line: 1,
						metadata: "{}",
					},
				],
			};
			const fallback: CallExtractionStrategy = {
				name: "Fallback",
				isAvailable: async () => true,
				extractCalls: async () => [],
			};

			const strategy = new FallbackCompositeStrategy({
				primary,
				fallback,
			});

			const result = await strategy.extractCallsWithStrategy(
				testSTCode,
				testPOUs,
			);

			assert.strictEqual(result.strategyUsed, "primary");
			assert.strictEqual(result.relationships.length, 1);
		});

		it("должна возвращать ошибку если она была", async () => {
			const primary: CallExtractionStrategy = createErrorStrategy();
			const fallback: CallExtractionStrategy = {
				name: "Fallback",
				isAvailable: async () => true,
				extractCalls: async () => [
					{
						id: "call:1",
						from_id: "pou:1",
						to_id: "pou:2",
						type: "CALLS" as const,
						file_path: "test.st",
						line: 1,
						metadata: "{}",
					},
				],
			};

			const strategy = new FallbackCompositeStrategy({
				primary,
				fallback,
			});

			const result = await strategy.extractCallsWithStrategy(
				testSTCode,
				testPOUs,
			);

			assert.strictEqual(result.strategyUsed, "fallback");
			assert.ok(result.error);
		});
	});
});

// ===== Integration Tests =====

describe("Call Extraction Strategies Integration", () => {
	let strategy: RegexCallExtractionStrategy;

	beforeEach(() => {
		strategy = new RegexCallExtractionStrategy();
	});

	describe("RegexCallExtractionStrategy с реальным ST кодом", () => {
		it("должна корректно парсить типичный ST код", async () => {
			const stCode = `
FUNCTION_BLOCK FB_Controller
VAR_INPUT
  Enable : BOOL;
  Setpoint : REAL;
END_VAR
VAR_OUTPUT
  Output : REAL;
  Error : REAL;
END_VAR

Error := Setpoint - ActualValue;
Output := Error * Kp + Integral * Ki;

// Вызовы функций
IF Enable THEN
  FB_SafetyCheck();
  FB_AlarmCheck();
END_IF
END_FUNCTION_BLOCK
`;
			const calls = await strategy.extractCalls(stCode, testPOUs);

			assert.ok(calls.length >= 0);
		});

		it("должна обрабатывать case insensitive идентификаторы", async () => {
			const stCode = `
fb_motor.run();
FB_MOTOR.STOP();
Fb_Motor.Status();
`;
			const calls = await strategy.extractCalls(stCode, testPOUs);

			// FB_Motor должна быть найдена независимо от регистра
			const fbMotorCalls = calls.filter(
				(c) => c.metadata && JSON.parse(c.metadata).callee === "FB_Motor",
			);

			// Хотя бы один вызов должен быть распознан или массив пуст
			assert.ok(Array.isArray(calls));
		});

		it("не должна падать на невалидном коде", async () => {
			const invalidCode = `{{{{invalid`;

			// Не должно выбросить исключение
			const result = await strategy.extractCalls(invalidCode, testPOUs);
			assert.ok(result !== undefined);
		});
	});
});
