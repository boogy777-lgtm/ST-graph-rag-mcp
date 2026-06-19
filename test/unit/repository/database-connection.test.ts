/**
 * Unit-тесты для DatabaseConnection
 *
 * Проверяют:
 * - Создание подключения к БД
 * - Закрытие подключения
 * - Инициализацию схемы
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { existsSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { DatabaseConnection } from "../../../src/infrastructure/database/DatabaseConnection";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("DatabaseConnection", () => {
	const testDbPath = join(__dirname, "test-db.sqlite");
	let db: DatabaseConnection | undefined;

	afterEach(() => {
		db?.close();
		// Cleanup test database
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

	describe("constructor", () => {
		it("создаёт экземпляр с дефолтными настройками", () => {
			db = new DatabaseConnection({ dbPath: testDbPath });
			assert.ok(db);
		});

		it("создаёт экземпляр с кастомными настройками", () => {
			db = new DatabaseConnection({
				dbPath: testDbPath,
				walMode: false,
				loadVecExtension: false,
			});
			assert.ok(db);
		});
	});

	describe("getDatabase()", () => {
		it("возвращает экземпляр Database", () => {
			db = new DatabaseConnection({
				dbPath: testDbPath,
				loadVecExtension: false,
			});
			const database = db.getDatabase();
			assert.ok(database);
		});

		it("инициализирует подключение при первом вызове", () => {
			db = new DatabaseConnection({
				dbPath: testDbPath,
				loadVecExtension: false,
			});
			assert.strictEqual(db.isOpen(), false);
			db.getDatabase();
			assert.strictEqual(db.isOpen(), true);
		});
	});

	describe("isOpen()", () => {
		it("возвращает false до инициализации", () => {
			db = new DatabaseConnection({ dbPath: testDbPath });
			assert.strictEqual(db.isOpen(), false);
		});

		it("возвращает true после инициализации", () => {
			db = new DatabaseConnection({
				dbPath: testDbPath,
				loadVecExtension: false,
			});
			db.getDatabase();
			assert.strictEqual(db.isOpen(), true);
		});

		it("возвращает false после закрытия", () => {
			db = new DatabaseConnection({
				dbPath: testDbPath,
				loadVecExtension: false,
			});
			db.getDatabase();
			db.close();
			assert.strictEqual(db.isOpen(), false);
		});
	});

	describe("close()", () => {
		it("закрывает соединение", () => {
			db = new DatabaseConnection({
				dbPath: testDbPath,
				loadVecExtension: false,
			});
			db.getDatabase();
			db.close();
			assert.strictEqual(db.isOpen(), false);
		});

		it("не выбрасывает ошибку при повторном закрытии", () => {
			db = new DatabaseConnection({
				dbPath: testDbPath,
				loadVecExtension: false,
			});
			db.getDatabase();
			db.close();
			assert.doesNotThrow(() => db.close());
		});
	});

	describe("prepare()", () => {
		it("создаёт prepared statement", () => {
			db = new DatabaseConnection({
				dbPath: testDbPath,
				loadVecExtension: false,
			});
			const stmt = db.prepare("SELECT 1 as value");
			assert.ok(stmt);
		});
	});

	describe("exec()", () => {
		it("выполняет SQL DDL", () => {
			db = new DatabaseConnection({
				dbPath: testDbPath,
				loadVecExtension: false,
			});
			db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)");
			const stmt = db.prepare("INSERT INTO test (name) VALUES (?)");
			stmt.run("test");
			const result = db.prepare("SELECT * FROM test").get();
			assert.deepStrictEqual(result, { id: 1, name: "test" });
		});
	});

	describe("transaction()", () => {
		it("выполняет операции в транзакции", () => {
			db = new DatabaseConnection({
				dbPath: testDbPath,
				loadVecExtension: false,
			});
			db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)");

			const result = db.transaction(() => {
				const stmt = db.prepare("INSERT INTO test (name) VALUES (?)");
				stmt.run("first");
				stmt.run("second");
				return db.prepare("SELECT COUNT(*) as count FROM test").get() as {
					count: number;
				};
			});

			assert.strictEqual(result.count, 2);
		});

		it("откатывает изменения при ошибке", () => {
			db = new DatabaseConnection({
				dbPath: testDbPath,
				loadVecExtension: false,
			});
			db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT UNIQUE)");

			assert.throws(() => {
				db.transaction(() => {
					db.prepare("INSERT INTO test (name) VALUES (?)").run("unique");
					db.prepare("INSERT INTO test (name) VALUES (?)").run("unique"); // Duplicate
				});
			});

			const result = db.prepare("SELECT COUNT(*) as count FROM test").get() as {
				count: number;
			};
			assert.strictEqual(result.count, 0);
		});
	});
});
