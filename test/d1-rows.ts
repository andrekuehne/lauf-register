// Counting the database rows a request reads, from D1's own counters
// (`meta.rows_read`, what the Workers Free plan's daily limit counts).

/**
 * `db`, counting the rows every query through it reads; `rowsRead()` is the
 * sum so far. The queries themselves run unchanged against the real database.
 * A way of querying that reports no count fails instead of going uncounted.
 */
export function countingRowsRead(db: D1Database): { db: D1Database; rowsRead: () => number } {
  let total = 0;
  const addRowsRead = <T extends { meta: { rows_read: number } }>(result: T): T => {
    // Rather fail than count nothing, should D1 ever stop reporting it.
    if (typeof result.meta.rows_read !== "number") throw new Error("D1 reported no rows_read");
    total += result.meta.rows_read;
    return result;
  };
  // db.batch() takes only D1's own statements, not the counting stand-ins.
  const ownStatements = new WeakMap<D1PreparedStatement, D1PreparedStatement>();
  const countingStatement = (statement: D1PreparedStatement): D1PreparedStatement => {
    const standIn = new Proxy(statement, {
      get(target, property) {
        switch (property) {
          case "bind":
            return (...values: unknown[]) => countingStatement(target.bind(...values));
          case "all":
            return async () => addRowsRead(await target.all());
          case "run":
            return async () => addRowsRead(await target.run());
          case "first":
            // first() reports no counters, so it reads through all(): the same query, the same rows read.
            return async (column?: string) => {
              const row = addRowsRead(await target.all<Record<string, unknown>>()).results[0];
              return row === undefined ? null : column === undefined ? row : (row[column] ?? null);
            };
          default:
            return passThroughExcept(target, property, ["raw"]);
        }
      },
    });
    ownStatements.set(standIn, statement);
    return standIn;
  };
  const countingDb = new Proxy(db, {
    get(target, property) {
      switch (property) {
        case "prepare":
          return (sql: string) => countingStatement(target.prepare(sql));
        case "batch":
          return async (statements: D1PreparedStatement[]) =>
            (await target.batch(statements.map((s) => ownStatements.get(s) ?? s))).map(addRowsRead);
        default:
          return passThroughExcept(target, property, ["exec", "withSession"]);
      }
    },
  });
  return { db: countingDb, rowsRead: () => total };
}

/** `target`'s property as it is, except the `uncounted` methods: calling one of those fails. */
function passThroughExcept(target: object, property: string | symbol, uncounted: string[]) {
  if (typeof property === "string" && uncounted.includes(property)) {
    return () => {
      throw new Error(`${property}() isn't counted: count it in test/d1-rows.ts before using it`);
    };
  }
  const value = Reflect.get(target, property);
  return typeof value === "function" ? value.bind(target) : value;
}
