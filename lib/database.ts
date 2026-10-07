import postgres from "postgres";

type SqlValue = string | number | boolean | null | Date | Uint8Array;
type Executor = Pick<ReturnType<typeof postgres>, "unsafe">;

const globalForPostgres = globalThis as typeof globalThis & {
  postgresClient?: ReturnType<typeof postgres>;
};

export function client() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");

  globalForPostgres.postgresClient ??= postgres(url, {
    max: 1,
    prepare: false,
  });
  return globalForPostgres.postgresClient;
}

function postgresPlaceholders(query: string) {
  let result = "";
  let parameter = 0;
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < query.length; i++) {
    const char = query[i];
    if (quote) {
      result += char;
      if (char === quote) {
        if (query[i + 1] === quote) result += query[++i];
        else quote = null;
      }
    } else if (char === "'" || char === '"') {
      quote = char;
      result += char;
    } else if (char === "?") {
      result += `$${++parameter}`;
    } else {
      result += char;
    }
  }

  return result;
}

function normalizeDatabaseError(error: unknown): never {
  if (error && typeof error === "object" && "code" in error) {
    const code = error.code;
    const detail = error instanceof Error ? error.message : "Database constraint failed";
    if (code === "23505") throw new Error(`UNIQUE constraint failed: ${detail}`, { cause: error });
    if (code === "23503") throw new Error(`FOREIGN KEY constraint failed: ${detail}`, { cause: error });
  }
  throw error;
}

class Statement {
  private values: SqlValue[] = [];

  constructor(private readonly query: string) {}

  bind(...values: (SqlValue | undefined)[]) {
    this.values = values.map((value) => value === undefined ? null : value);
    return this;
  }

  async all<T>(executor: Executor = client()) {
    try {
      const results = await executor.unsafe<T[]>(postgresPlaceholders(this.query), this.values);
      return { results: Array.from(results) };
    } catch (error) {
      normalizeDatabaseError(error);
    }
  }

  async first<T>(executor: Executor = client()): Promise<T | null> {
    const { results } = await this.all<T>(executor);
    return results[0] ?? null;
  }

  async run(executor: Executor = client()) {
    try {
      const results = await executor.unsafe(postgresPlaceholders(this.query), this.values);
      return { meta: { changes: results.count ?? results.length } };
    } catch (error) {
      normalizeDatabaseError(error);
    }
  }
}

export function database() {
  return {
    prepare(query: string) {
      return new Statement(query);
    },
    async batch(statements: Statement[]) {
      return client().begin(async (transaction) => {
        const results = [];
        for (const statement of statements) results.push(await statement.run(transaction));
        return results;
      });
    },
  };
}
