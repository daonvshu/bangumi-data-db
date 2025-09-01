import Database from "better-sqlite3";
import { items, siteMeta } from "bangumi-data";
import type { Item, Site, SiteList } from "bangumi-data";

const db = new Database("bangumi.db");

// ⏳ ISO 字符串 → 时间戳 (ms)
function toTimestamp(iso?: string): number | null {
  if (!iso || iso.trim() === "") return null;
  const t = Date.parse(iso);
  return isNaN(t) ? null : t;
}

// ⏳ broadcast → 起始时间戳
function extractBroadcastBegin(broadcast?: string): number | null {
  if (!broadcast) return null;
  // 格式: R/<time>/P...
  const parts = broadcast.split("/");
  if (parts.length >= 2) {
    const t = Date.parse(parts[1]);
    return isNaN(t) ? null : t;
  }
  return null;
}

// 🚀 创建数据库表
function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      lang TEXT NOT NULL,
      official_site TEXT,
      begin INTEGER,
      broadcast TEXT,
      broadcast_begin INTEGER,
      end INTEGER,
      comment TEXT
    );

    CREATE TABLE IF NOT EXISTS title_translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      language TEXT NOT NULL,
      title TEXT NOT NULL,
      FOREIGN KEY(item_id) REFERENCES items(id)
    );

    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      site_name TEXT NOT NULL,
      site_type TEXT NOT NULL,
      site_id TEXT,
      url TEXT,
      url_template TEXT,
      url_resolved TEXT,
      begin INTEGER,
      end INTEGER,
      broadcast TEXT,
      broadcast_begin INTEGER,
      comment TEXT,
      regions TEXT,
      FOREIGN KEY(item_id) REFERENCES items(id)
    );

    CREATE TABLE IF NOT EXISTS site_meta (
      site_name TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url_template TEXT NOT NULL,
      type TEXT NOT NULL,
      regions TEXT
    );
  `);
}

// 🚀 判断 site 类型
function getSiteType(site: Site): "onair" | "info" | "resource" {
  if ("begin" in site) return "onair";
  const resourceSites = ["dmhy", "mikan", "bangumi_moe"];
  return resourceSites.includes(site.site) ? "resource" : "info";
}

// 🚀 生成 resolved URL
function resolveUrl(site: Site): { url: string | null; urlTemplate: string | null } {
  const meta = siteMeta[site.site as SiteList];
  if (!meta) return { url: (site as any).url ?? null, urlTemplate: null };

  const urlTemplate = meta.urlTemplate;
  if ((site as any).url) {
    return { url: (site as any).url, urlTemplate };
  } else if ((site as any).id) {
    return { url: urlTemplate.replace("{{id}}", (site as any).id), urlTemplate };
  }
  return { url: null, urlTemplate };
}

// 🚀 插入站点元数据
function insertSiteMeta() {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO site_meta (site_name, title, url_template, type, regions)
    VALUES (?, ?, ?, ?, ?)
  `);

  (Object.keys(siteMeta) as SiteList[]).forEach(siteName => {
    const m = siteMeta[siteName];
    insert.run(
      siteName,
      m.title,
      m.urlTemplate,
      m.type,
      m.regions ? m.regions.join(",") : null
    );
  });
}

// 🚀 插入单个 item
function insertItem(item: Item) {
  const insertItem = db.prepare(`
    INSERT INTO items (title, type, lang, official_site, begin, broadcast, broadcast_begin, end, comment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = insertItem.run(
    item.title,
    item.type,
    item.lang,
    item.officialSite,
    toTimestamp(item.begin),
    item.broadcast ?? null,
    extractBroadcastBegin(item.broadcast),
    toTimestamp(item.end),
    item.comment ?? null
  );
  const itemId = result.lastInsertRowid as number;

  // 标题翻译
  const insertTrans = db.prepare(`
    INSERT INTO title_translations (item_id, language, title)
    VALUES (?, ?, ?)
  `);
  for (const [lang, titles] of Object.entries(item.titleTranslate)) {
    for (const t of titles) {
      insertTrans.run(itemId, lang, t);
    }
  }

  // 站点
  const insertSite = db.prepare(`
    INSERT INTO sites (item_id, site_name, site_type, site_id, url, url_template, url_resolved, begin, end, broadcast, broadcast_begin, comment, regions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  item.sites.forEach(site => {
    const siteType = getSiteType(site);
    const { url, urlTemplate } = resolveUrl(site);

    let regions = null;
    if ("regions" in site && Array.isArray((site as any).regions)) {
      regions = (site as any).regions.join(",");
    }

    insertSite.run(
      itemId,
      site.site,
      siteType,
      (site as any).id ?? null,
      (site as any).url ?? null,
      urlTemplate,
      url,
      toTimestamp((site as any).begin),
      toTimestamp((site as any).end),
      (site as any).broadcast ?? null,
      extractBroadcastBegin((site as any).broadcast),
      (site as any).comment ?? null,
      regions
    );
  });
}

// 🚀 主流程
function main() {
  console.log("⏳ 创建表结构...");
  createTables();

  console.log("⏳ 写入站点元数据...");
  insertSiteMeta();

  console.log("⏳ 导入 items...");
  const tx = db.transaction(() => {
    for (const item of items) insertItem(item);
  });
  tx();

  console.log("✅ 数据已保存到 bangumi.db");
}

main();
