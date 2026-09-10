import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { allocationRules, categories } from "@/db/schema";

export interface RuleSetRowWithCategory {
  id: string;
  categoryId: string;
  categoryName: string;
  percentage: string;
  sortOrder: number;
}

export async function listRuleSetNames(userId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ ruleName: allocationRules.ruleName })
    .from(allocationRules)
    .where(eq(allocationRules.userId, userId));
  return rows.map((r) => r.ruleName).sort();
}

export async function getRuleSet(
  userId: string,
  ruleName: string
): Promise<RuleSetRowWithCategory[]> {
  return db
    .select({
      id: allocationRules.id,
      categoryId: allocationRules.categoryId,
      categoryName: categories.name,
      percentage: allocationRules.percentage,
      sortOrder: allocationRules.sortOrder,
    })
    .from(allocationRules)
    .innerJoin(categories, eq(allocationRules.categoryId, categories.id))
    .where(and(eq(allocationRules.userId, userId), eq(allocationRules.ruleName, ruleName)))
    .orderBy(asc(allocationRules.sortOrder));
}
