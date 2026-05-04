// services/categoryCache.ts
// Caches categories, subcategories and components in SQLite.
// Seeded when online, read when offline.

import * as SQLite from "expo-sqlite";

const DB_NAME = "submissions.db"; // reuse the same DB file

let db: SQLite.SQLiteDatabase | null = null;

const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS cached_categories (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      synced_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS cached_subcategories (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      category_id TEXT NOT NULL,
      synced_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS cached_components (
      id             TEXT PRIMARY KEY,
      component_id   TEXT NOT NULL,
      component_name TEXT NOT NULL,
      subcategory_id TEXT NOT NULL,
      synced_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sub_cat   ON cached_subcategories(category_id);
    CREATE INDEX IF NOT EXISTS idx_comp_sub  ON cached_components(subcategory_id);
  `);
  return db;
};

// ─── Seed ─────────────────────────────────────────────────────

export const seedCategories = async (
  categories: Array<{ id: string; categoryName: string }>,
): Promise<void> => {
  const database = await getDb();
  await database.execAsync(`DELETE FROM cached_categories`);
  for (const cat of categories) {
    await database.runAsync(
      `INSERT OR REPLACE INTO cached_categories (id, name) VALUES (?, ?)`,
      [cat.id, cat.categoryName],
    );
  }
};

export const seedSubcategories = async (
  subcategories: Array<{
    id: string;
    subcategoryName: string;
    categoryId: string;
  }>,
): Promise<void> => {
  const database = await getDb();
  for (const sub of subcategories) {
    await database.runAsync(
      `INSERT OR REPLACE INTO cached_subcategories (id, name, category_id) VALUES (?, ?, ?)`,
      [sub.id, sub.subcategoryName, sub.categoryId],
    );
  }
};

export const seedComponents = async (
  components: Array<{
    id: string;
    componentId: string;
    componentName: string;
    subcategoryId: string;
  }>,
): Promise<void> => {
  const database = await getDb();
  for (const comp of components) {
    await database.runAsync(
      `INSERT OR REPLACE INTO cached_components (id, component_id, component_name, subcategory_id) VALUES (?, ?, ?, ?)`,
      [comp.id, comp.componentId, comp.componentName, comp.subcategoryId],
    );
  }
};

// ─── Read ──────────────────────────────────────────────────────

export const getCachedCategories = async (): Promise<
  Array<{ id: string; categoryName: string }>
> => {
  const database = await getDb();
  const rows = await database.getAllAsync<{ id: string; name: string }>(
    `SELECT id, name FROM cached_categories ORDER BY name ASC`,
  );
  return rows.map((r) => ({ id: r.id, categoryName: r.name }));
};

export const getCachedSubcategories = async (
  categoryId: string,
): Promise<
  Array<{ id: string; subcategoryName: string; categoryId: string }>
> => {
  const database = await getDb();
  const rows = await database.getAllAsync<{
    id: string;
    name: string;
    category_id: string;
  }>(
    `SELECT id, name, category_id FROM cached_subcategories WHERE category_id = ? ORDER BY name ASC`,
    [categoryId],
  );
  return rows.map((r) => ({
    id: r.id,
    subcategoryName: r.name,
    categoryId: r.category_id,
  }));
};

export const getCachedComponents = async (
  subcategoryId: string,
): Promise<
  Array<{
    id: string;
    componentId: string;
    componentName: string;
    subcategoryId: string;
  }>
> => {
  const database = await getDb();
  const rows = await database.getAllAsync<{
    id: string;
    component_id: string;
    component_name: string;
    subcategory_id: string;
  }>(
    `SELECT id, component_id, component_name, subcategory_id FROM cached_components WHERE subcategory_id = ? ORDER BY component_name ASC`,
    [subcategoryId],
  );
  return rows.map((r) => ({
    id: r.id,
    componentId: r.component_id,
    componentName: r.component_name,
    subcategoryId: r.subcategory_id,
  }));
};

// ─── Last synced ───────────────────────────────────────────────

export const getLastSyncedAt = async (): Promise<string | null> => {
  const database = await getDb();
  const row = await database.getFirstAsync<{ synced_at: string }>(
    `SELECT synced_at FROM cached_categories ORDER BY synced_at DESC LIMIT 1`,
  );
  return row?.synced_at ?? null;
};
