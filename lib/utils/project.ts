import type { Embedded } from "@/lib/types/db"

/**
 * A Supabase embed arrives as an object or a single-element array depending on
 * how PostgREST infers the relationship. Normalise to one row or null.
 */
export function one<T>(embed: T | T[] | null | undefined): T | null {
  return Array.isArray(embed) ? (embed[0] ?? null) : (embed ?? null)
}

/** The owning profile id off an embedded `projects` relation, however it arrived. */
export function getOwnerId(projectData: Embedded<{ owner_id: string }>): string | undefined {
  return one(projectData)?.owner_id
}
