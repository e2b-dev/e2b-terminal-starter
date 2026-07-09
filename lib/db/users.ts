import { randomUUID } from "node:crypto";
import type { User } from "@/lib/contracts";
import { getDatabase, now } from "./client";

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 80);
}

export function upsertUser(name: string) {
  const db = getDatabase();
  const normalizedName = normalizeName(name);
  if (!normalizedName) throw new Error("User name is required.");

  const existing = db
    .prepare("SELECT * FROM users WHERE name = ?")
    .get(normalizedName) as User | undefined;
  if (existing) return existing;

  const user: User = {
    id: randomUUID(),
    name: normalizedName,
    created_at: now(),
  };
  db.prepare("INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)").run(
    user.id,
    user.name,
    user.created_at,
  );
  return user;
}

export function getUser(userId: string) {
  return getDatabase()
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(userId) as User | undefined;
}
