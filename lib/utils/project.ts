/**
 * A Supabase embed arrives as an object or a single-element array depending on
 * how PostgREST infers the relationship. Normalise to one row or null.
 */
export function one<T>(embed: T | T[] | null | undefined): T | null {
  return Array.isArray(embed) ? (embed[0] ?? null) : (embed ?? null)
}

export function getOwnerId(projectData: any): string | undefined {
  return Array.isArray(projectData)
    ? projectData[0]?.owner_id
    : projectData?.owner_id;
}