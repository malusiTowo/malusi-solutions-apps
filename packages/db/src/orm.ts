/**
 * Re-export of drizzle's query builders (`eq`, `and`, `desc`, `sql`, …).
 *
 * Products import from here rather than from `drizzle-orm` directly so the whole
 * workspace provably shares one copy: two resolved copies would produce two
 * incompatible `NeonHttpDatabase<TSchema>` types and break assignment across the
 * package boundary.
 */
export * from "drizzle-orm";
