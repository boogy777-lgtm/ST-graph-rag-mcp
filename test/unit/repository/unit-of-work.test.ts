/**
 * Unit-тесты для UnitOfWork
 *
 * Проверяют транзакционное поведение.
 * Примечание: better-sqlite3 транзакции синхронные,
 * поэтому execute() работает только с синхронными callback.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { existsSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { DatabaseConnection } from "../../../src/infrastructure/database/DatabaseConnection";
import { UnitOfWork } from "../../../src/infrastructure/database/UnitOfWork";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("UnitOfWork", () => {
	const testDbPath = join(__dirname, "test-uow.sqlite");
	let db: DatabaseConnection;
	let uow: UnitOfWork;

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

      CREATE TABLE st_variables (
        id TEXT PRIMARY KEY,
        pou_id TEXT NOT NULL,
        name TEXT NOT NULL,
        direction TEXT NOT NULL,
        var_type TEXT NOT NULL,
        default_value TEXT,
        start_line INTEGER,
        end_line INTEGER
      );
    `);
		uow = new UnitOfWork(db);
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

	describe("execute()", () => {
		it("выполняет синхронные операции в транзакции", async () => {
			const result = await uow.execute(() => {
				db.prepare(
					"INSERT INTO st_pous (id, name, pou_type, file_path, start_line, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
				).run(
					"pou1",
					"POU1",
					"FUNCTION_BLOCK",
					"/test.st",
					1,
					Date.now(),
					Date.now(),
				);
				db.prepare(
					"INSERT INTO st_pous (id, name, pou_type, file_path, start_line, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
				).run(
					"pou2",
					"POU2",
					"FUNCTION_BLOCK",
					"/test.st",
					2,
					Date.now(),
					Date.now(),
				);
				return 2;
			});

			assert.strictEqual(result, 2);
		});

		it("возвращает результат операции", async () => {
			const result = await uow.execute(() => {
				db.prepare(
					"INSERT INTO st_pous (id, name, pou_type, file_path, start_line, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
				).run(
					"pou1",
					"POU1",
					"FUNCTION_BLOCK",
					"/test.st",
					1,
					Date.now(),
					Date.now(),
				);
				return "success";
			});

			assert.strictEqual(result, "success");
		});

		it("откатывает изменения при ошибке", async () => {
			try {
				await uow.execute(() => {
					db.prepare(
						"INSERT INTO st_pous (id, name, pou_type, file_path, start_line, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
					).run(
						"pou1",
						"POU1",
						"FUNCTION_BLOCK",
						"/test.st",
						1,
						Date.now(),
						Date.now(),
					);
					throw new Error("Test error");
				});
			} catch {
				// Expected
			}

			const result = db
				.prepare("SELECT COUNT(*) as count FROM st_pous")
				.get() as { count: number };
			assert.strictEqual(result.count, 0);
		});

		it("выполняет связанные операции атомарно", async () => {
			uow.execute(() => {
				const pouId = "pou1";
				db.prepare(
					"INSERT INTO st_pous (id, name, pou_type, file_path, start_line, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
				).run(
					pouId,
					"POU1",
					"FUNCTION_BLOCK",
					"/test.st",
					1,
					Date.now(),
					Date.now(),
				);
				db.prepare(
					"INSERT INTO st_variables (id, pou_id, name, direction, var_type) VALUES (?, ?, ?, ?, ?)",
				).run("var1", pouId, "inputVar", "VAR_INPUT", "BOOL");
				db.prepare(
					"INSERT INTO st_variables (id, pou_id, name, direction, var_type) VALUES (?, ?, ?, ?, ?)",
				).run("var2", pouId, "outputVar", "VAR_OUTPUT", "INT");
				return "done";
			});

			const pous = db
				.prepare("SELECT COUNT(*) as count FROM st_pous")
				.get() as { count: number };
			const vars = db
				.prepare("SELECT COUNT(*) as count FROM st_variables")
				.get() as { count: number };

			assert.strictEqual(pous.count, 1);
			assert.strictEqual(vars.count, 2);
		});
	});

	describe("executeSync()", () => {
		it("выполняет синхронные операции в транзакции", () => {
			const result = uow.executeSync(() => {
				db.prepare(
					"INSERT INTO st_pous (id, name, pou_type, file_path, start_line, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
				).run(
					"pou1",
					"POU1",
					"FUNCTION_BLOCK",
					"/test.st",
					1,
					Date.now(),
					Date.now(),
				);
				return "sync-success";
			});

			assert.strictEqual(result, "sync-success");

			const count = db
				.prepare("SELECT COUNT(*) as count FROM st_pous")
				.get() as { count: number };
			assert.strictEqual(count.count, 1);
		});

		it("откатывает синхронные изменения при ошибке", () => {
			try {
				uow.executeSync(() => {
					db.prepare(
						"INSERT INTO st_pous (id, name, pou_type, file_path, start_line, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
					).run(
						"pou1",
						"POU1",
						"FUNCTION_BLOCK",
						"/test.st",
						1,
						Date.now(),
						Date.now(),
					);
					throw new Error("Sync test error");
				});
			} catch {
				// Expected
			}

			const count = db
				.prepare("SELECT COUNT(*) as count FROM st_pous")
				.get() as { count: number };
			assert.strictEqual(count.count, 0);
		});
	});
});
