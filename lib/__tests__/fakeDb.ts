// A small in-memory stand-in for the service-role client: tables as arrays, the
// handful of filters billing uses. apply_subscription's own behaviour is tested
// against the migration's text, so this only has to hold rows.

type Row = Record<string, unknown>
type Check = (row: Row) => boolean

/** One `a.is.null` or `a.lt.value` term of an .or() string. */
function term(expr: string): Check {
  const [col, op, ...rest] = expr.split(".")
  const value = rest.join(".")
  if (op === "is") return (r) => r[col] === null || r[col] === undefined
  if (op === "lt") return (r) => String(r[col]) < value
  if (op === "gte") return (r) => Number(r[col]) >= Number(value)
  throw new Error(`fakeDb: ${expr}`)
}

export function fakeDb(
  tables: Record<string, Row[]>,
  opts: {
    unique?: Record<string, (row: Row, rows: Row[]) => boolean>
    /** What each RPC answers; every call is kept in rpcCalls. */
    rpc?: Record<string, (args: Row) => unknown>
  } = {},
) {
  const rpcCalls: { name: string; args: Row }[] = []
  const from = (table: string) => {
    const rows = (tables[table] ??= [])
    const checks: Check[] = []
    let mode: "select" | "update" | "delete" | "insert" = "select"
    let patch: Row = {}
    let max = Infinity
    let failure: { code: string; message: string } | null = null

    const run = () => {
      if (failure) return { data: null, error: failure }
      const matched = rows.filter((r) => checks.every((c) => c(r)))
      if (mode === "update") matched.forEach((r) => Object.assign(r, patch))
      if (mode === "delete") tables[table] = rows.filter((r) => !matched.includes(r))
      return { data: matched.slice(0, max), error: null, count: matched.length }
    }

    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => (checks.push((r) => r[c] === v), q),
      is: (c: string, v: unknown) => (checks.push((r) => (r[c] ?? null) === v), q),
      in: (c: string, v: unknown[]) => (checks.push((r) => v.includes(r[c])), q),
      lt: (c: string, v: string) => (checks.push((r) => String(r[c]) < v), q),
      neq: (c: string, v: unknown) => (checks.push((r) => r[c] !== v), q),
      not: (c: string, op: string, v: unknown) => (checks.push((r) => !(op === "is" ? (r[c] ?? null) === v : r[c] === v)), q),
      order: () => q,
      or: (expr: string) => {
        const terms = expr.split(",").map(term)
        checks.push((r) => terms.some((t) => t(r)))
        return q
      },
      limit: (n: number) => ((max = n), q),
      update: (p: Row) => ((mode = "update"), (patch = p), q),
      delete: () => ((mode = "delete"), q),
      insert: (row: Row) => {
        mode = "insert"
        if (opts.unique?.[table]?.(row, rows)) failure = { code: "23505", message: "duplicate key" }
        else rows.push({ ...row })
        return q
      },
      upsert: (row: Row, o: { onConflict: string; ignoreDuplicates?: boolean }) => {
        mode = "insert"
        if (!rows.some((r) => r[o.onConflict] === row[o.onConflict])) rows.push({ ...row })
        return q
      },
      maybeSingle: async () => {
        const { data, error } = run()
        return { data: (data as Row[] | null)?.[0] ?? null, error }
      },
      then: (resolve: (v: unknown) => void) => resolve(run()),
    }
    return q
  }
  return {
    from,
    tables,
    rpcCalls,
    rpc: async (name: string, args: Row) => {
      rpcCalls.push({ name, args })
      return { data: opts.rpc?.[name]?.(args) ?? null, error: null }
    },
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: { id, email: "ada@example.ng" } }, error: null }) } },
  }
}
