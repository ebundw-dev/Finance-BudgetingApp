import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// neon-serverless (websocket, stateful) rather than neon-http: the
// accounting engine needs real interactive transactions (SELECT ... FOR
// UPDATE followed by a conditional UPDATE/INSERT), which the stateless
// HTTP driver cannot do.
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export const db = drizzle(pool, { schema });
