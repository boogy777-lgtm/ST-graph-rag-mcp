/**
 * Unit-тесты для POURepository
 *
 * Проверяют CRUD-операции и специфичные методы для POU-сущностей.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { existsSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
	POURepository,
	type STPOU,
} from "../../../src/core/repository/POURepository";
import { DatabaseConnection } from "../../../src/infrastructure/database/DatabaseConnection";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("POURepository", () => {
	const testDbPath = join(__dirname, "test-pou.sqlite");
	let db: DatabaseConnection;
	let repo: POURepository;

	const createTestPOU = (overrides: Partial<STPOU> = {}): STPOU => ({
		id: `st:test:${overrides.name || "TestPOU"}`,
		name: overrides.name || "TestPOU",
		pou_type: "FUNCTION_BLOCK",
		file_path: "/test/path.st",
		start_line: 1,
		end_line: 10,
		namespace: undefined,
		extends: undefined,
		implements: undefined,
		signature: undefined,
		created_at: Date.now(),
		updated_at: Date.now(),
		...overrides,
	});

	beforeEach(() => {
		db = new DatabaseConnection({
			dbPath: testDbPath,
			loadVecExtension: false,
		});
		db.exec(`
      CREATE TABLE st_pous (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        pou_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER,
        namespace TEXT,
        extends TEXT,
        implements TEXT,
        signature TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
		repo = new POURepository(db);
	});

	afterEach(() => {
		db?.close();
		if (existsSync(testDbPath)) {
			try {
				unlinkSync(testDbPath);
				if (existsSync(`${testDbPath}-wal`)) unlinkSync(`${testDbPath}-wal`);
				if (existsSync(`${testDbPath}-shm`)) unlinkSync(`${testDbPath}-shm`);
			} catch {
				// Ignore cleanup errors
			}
		}
	});

	describe("findById()", () => {
		it("возвращает null/undefined для несуществующего POU", async () => {
			const result = await repo.findById("nonexistent");
			assert.ok(result == null); // null or undefined
		});

		it("возвращает POU по id", async () => {
			const pou = createTestPOU();
			await repo.save(pou);

			const result = await repo.findById(pou.id);
			assert.ok(result);
			assert.strictEqual(result.name, pou.name);
			assert.strictEqual(result.id, pou.id);
		});
	});

	describe("findAll()", () => {
		it("возвращает пустой массив для пустой таблицы", async () => {
			const result = await repo.findAll();
			assert.deepStrictEqual(result, []);
		});

		it("возвращает все POU", async () => {
			await repo.save(createTestPOU({ name: "POU1" }));
			await repo.save(createTestPOU({ name: "POU2" }));
			await repo.save(createTestPOU({ name: "POU3" }));

			const result = await repo.findAll();
			assert.strictEqual(result.length, 3);
		});
	});

	describe("save()", () => {
		it("сохраняет новый POU", async () => {
			const pou = createTestPOU();
			await repo.save(pou);

			const result = await repo.findById(pou.id);
			assert.ok(result);
			assert.strictEqual(result.name, pou.name);
		});

		it("обновляет существующий POU", async () => {
			const pou = createTestPOU();
			await repo.save(pou);

			const updated = { ...pou, end_line: 20 };
			await repo.save(updated);

			const result = await repo.findById(pou.id);
			assert.strictEqual(result?.end_line, 20);
		});
	});

	describe("delete()", () => {
		it("удаляет POU", async () => {
			const pou = createTestPOU();
			await repo.save(pou);

			await repo.delete(pou.id);

			const result = await repo.findById(pou.id);
			assert.ok(result == null); // null or undefined
		});

		it("не выбрасывает ошибку при удалении несуществующего POU", async () => {
			await assert.doesNotReject(() => repo.delete("nonexistent"));
		});
	});

	describe("findByName()", () => {
		it("возвращает POU по точному имени", async () => {
			const pou = createTestPOU({ name: "ExactName" });
			await repo.save(pou);

			const result = await repo.findByName("ExactName");
			assert.strictEqual(result?.name, "ExactName");
		});

		it("возвращает null/undefined для несуществующего имени", async () => {
			const result = await repo.findByName("Nonexistent");
			assert.ok(result == null); // null or undefined
		});
	});

	describe("findByType()", () => {
		it("возвращает POU по типу", async () => {
			await repo.save(
				createTestPOU({ name: "FB1", pou_type: "FUNCTION_BLOCK" }),
			);
			await repo.save(
				createTestPOU({ name: "FB2", pou_type: "FUNCTION_BLOCK" }),
			);
			await repo.save(createTestPOU({ name: "FC1", pou_type: "FUNCTION" }));

			const result = await repo.findByType("FUNCTION_BLOCK");
			assert.strictEqual(result.length, 2);
		});
	});

	describe("findByFile()", () => {
		it("возвращает POU из файла", async () => {
			const filePath = "/test/specific.st";
			await repo.save(createTestPOU({ name: "P1", file_path: filePath }));
			await repo.save(
				createTestPOU({ name: "P2", file_path: "/test/other.st" }),
			);

			const result = await repo.findByFile(filePath);
			assert.strictEqual(result.length, 1);
			assert.strictEqual(result[0].file_path, filePath);
		});
	});

	describe("deleteByFile()", () => {
		it("удаляет все POU из файла", async () => {
			const filePath = "/test/to-delete.st";
			await repo.save(createTestPOU({ file_path: filePath }));
			await repo.save(createTestPOU({ file_path: filePath }));
			await repo.save(createTestPOU({ file_path: "/test/keep.st" }));

			await repo.deleteByFile(filePath);

			const result = await repo.findByFile(filePath);
			assert.strictEqual(result.length, 0);

			const kept = await repo.findByFile("/test/keep.st");
			assert.strictEqual(kept.length, 1);
		});
	});

	describe("searchByName()", () => {
		it("находит POU по шаблону", async () => {
			await repo.save(createTestPOU({ name: "FB_Motor" }));
			await repo.save(createTestPOU({ name: "FB_Valve" }));
			await repo.save(createTestPOU({ name: "PRG_Main" }));

			const result = await repo.searchByName("FB_");
			assert.strictEqual(result.length, 2);
		});

		it("возвращает пустой массив при отсутствии совпадений", async () => {
			await repo.save(createTestPOU({ name: "FB_Motor" }));

			const result = await repo.searchByName("NonExistent");
			assert.strictEqual(result.length, 0);
		});
	});

	describe("saveMany()", () => {
		it("сохраняет несколько POU за одну операцию", async () => {
			const pous = [
				createTestPOU({ name: "POU1" }),
				createTestPOU({ name: "POU2" }),
				createTestPOU({ name: "POU3" }),
			];

			await repo.saveMany(pous);

			const result = await repo.findAll();
			assert.strictEqual(result.length, 3);
		});
	});
});
