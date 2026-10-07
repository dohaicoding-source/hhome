import { drizzle } from "drizzle-orm/postgres-js";
import { client } from "@/lib/database";
import * as schema from "./schema";

export function getDb() {
  return drizzle(client(), { schema });
}
