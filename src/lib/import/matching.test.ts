import { describe, expect, it } from "vitest";
import { buildImportPreview, type ExistingTransactionSignature, type ImportPayeeInfo } from "./matching";
import type { NormalizedImportRow } from "./csv";

function row(overrides: Partial<NormalizedImportRow> = {}): NormalizedImportRow {
  return {
    rowIndex: 0,
    date: "2026-09-05",
    payeeRaw: "Netflix",
    amount: "15.99",
    direction: "debit",
    ...overrides,
  };
}

describe("buildImportPreview", () => {
  it("suggests a category from a matching payee's lastCategoryId", () => {
    const payees: ImportPayeeInfo[] = [{ name: "netflix", lastCategoryId: "cat-subscriptions" }];
    const [preview] = buildImportPreview([row()], payees, []);
    expect(preview.suggestedCategoryId).toBe("cat-subscriptions");
    expect(preview.payeeKey).toBe("netflix");
  });

  it("fuzzy-matches payee casing/whitespace against the stored normalized name", () => {
    const payees: ImportPayeeInfo[] = [{ name: "netflix", lastCategoryId: "cat-subscriptions" }];
    const [preview] = buildImportPreview([row({ payeeRaw: "  NETFLIX  " })], payees, []);
    expect(preview.suggestedCategoryId).toBe("cat-subscriptions");
  });

  it("leaves suggestedCategoryId null when no payee matches", () => {
    const [preview] = buildImportPreview([row({ payeeRaw: "Some New Merchant" })], [], []);
    expect(preview.suggestedCategoryId).toBeNull();
  });

  it("leaves suggestedCategoryId null when the matching payee has never been categorized", () => {
    const payees: ImportPayeeInfo[] = [{ name: "netflix", lastCategoryId: null }];
    const [preview] = buildImportPreview([row()], payees, []);
    expect(preview.suggestedCategoryId).toBeNull();
  });

  it("flags a row matching an existing transaction on date+amount+payee as a duplicate", () => {
    const existing: ExistingTransactionSignature[] = [
      { date: "2026-09-05", amount: "15.99", payeeKey: "netflix" },
    ];
    const [preview] = buildImportPreview([row()], [], existing);
    expect(preview.isDuplicate).toBe(true);
  });

  it("fuzzy-matches the duplicate check on payee casing/whitespace too", () => {
    const existing: ExistingTransactionSignature[] = [
      { date: "2026-09-05", amount: "15.99", payeeKey: "netflix" },
    ];
    const [preview] = buildImportPreview([row({ payeeRaw: "NETFLIX" })], [], existing);
    expect(preview.isDuplicate).toBe(true);
  });

  it("does not flag a duplicate when the amount differs", () => {
    const existing: ExistingTransactionSignature[] = [
      { date: "2026-09-05", amount: "9.99", payeeKey: "netflix" },
    ];
    const [preview] = buildImportPreview([row()], [], existing);
    expect(preview.isDuplicate).toBe(false);
  });

  it("does not flag a duplicate when the date differs", () => {
    const existing: ExistingTransactionSignature[] = [
      { date: "2026-08-05", amount: "15.99", payeeKey: "netflix" },
    ];
    const [preview] = buildImportPreview([row()], [], existing);
    expect(preview.isDuplicate).toBe(false);
  });

  it("does not flag a duplicate when the payee differs", () => {
    const existing: ExistingTransactionSignature[] = [
      { date: "2026-09-05", amount: "15.99", payeeKey: "spotify" },
    ];
    const [preview] = buildImportPreview([row()], [], existing);
    expect(preview.isDuplicate).toBe(false);
  });

  it("passes through an already-errored row unchanged, without a suggestion or duplicate flag", () => {
    const errored = row({ date: null, amount: null, direction: null, error: "Unrecognized date" });
    const payees: ImportPayeeInfo[] = [{ name: "netflix", lastCategoryId: "cat-subscriptions" }];
    const existing: ExistingTransactionSignature[] = [
      { date: "2026-09-05", amount: "15.99", payeeKey: "netflix" },
    ];
    const [preview] = buildImportPreview([errored], payees, existing);
    expect(preview.suggestedCategoryId).toBeNull();
    expect(preview.isDuplicate).toBe(false);
    expect(preview.payeeKey).toBeNull();
    expect(preview.error).toBe("Unrecognized date");
  });
});
