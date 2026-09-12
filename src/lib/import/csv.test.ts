import { describe, expect, it } from "vitest";
import {
  buildImportRows,
  parseCsv,
  parseImportAmount,
  parseImportDate,
  type ColumnMapping,
} from "./csv";

describe("parseCsv", () => {
  it("parses a simple comma-separated grid", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields containing commas", () => {
    expect(parseCsv('Date,Description,Amount\n09/05/2026,"Grocery, Store",-84.32')).toEqual([
      ["Date", "Description", "Amount"],
      ["09/05/2026", "Grocery, Store", "-84.32"],
    ]);
  });

  it("handles escaped double quotes inside a quoted field", () => {
    expect(parseCsv('a\n"say ""hi"""')).toEqual([["a"], ['say "hi"']]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("handles a quoted field containing an embedded newline", () => {
    expect(parseCsv('a,b\n"line1\nline2",2')).toEqual([
      ["a", "b"],
      ["line1\nline2", "2"],
    ]);
  });

  it("drops blank lines", () => {
    expect(parseCsv("a,b\n1,2\n\n3,4\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });
});

describe("parseImportDate", () => {
  it("parses ISO dates", () => {
    expect(parseImportDate("2026-09-05")).toBe("2026-09-05");
  });

  it("parses US-style MM/DD/YYYY dates", () => {
    expect(parseImportDate("09/05/2026")).toBe("2026-09-05");
  });

  it("zero-pads single-digit month/day in US format", () => {
    expect(parseImportDate("9/5/2026")).toBe("2026-09-05");
  });

  it("rejects an invalid calendar date", () => {
    expect(parseImportDate("02/30/2026")).toBeNull();
    expect(parseImportDate("13/01/2026")).toBeNull();
  });

  it("rejects unrecognized formats rather than guessing", () => {
    expect(parseImportDate("5 Sept 2026")).toBeNull();
    expect(parseImportDate("")).toBeNull();
  });
});

describe("parseImportAmount", () => {
  it("parses a plain positive number", () => {
    expect(parseImportAmount("84.32")).toBe(84.32);
  });

  it("parses a negative number", () => {
    expect(parseImportAmount("-84.32")).toBe(-84.32);
  });

  it("strips a leading dollar sign and thousands commas", () => {
    expect(parseImportAmount("$1,234.56")).toBe(1234.56);
  });

  it("treats parentheses as negative", () => {
    expect(parseImportAmount("(15.99)")).toBe(-15.99);
  });

  it("rejects non-numeric text", () => {
    expect(parseImportAmount("N/A")).toBeNull();
    expect(parseImportAmount("")).toBeNull();
  });
});

const singleAmountMapping: ColumnMapping = {
  hasHeaderRow: true,
  dateColumn: 0,
  payeeColumn: 1,
  amountMode: "single",
  amountColumn: 2,
};

const debitCreditMapping: ColumnMapping = {
  hasHeaderRow: true,
  dateColumn: 0,
  payeeColumn: 1,
  amountMode: "debitCredit",
  debitColumn: 2,
  creditColumn: 3,
};

describe("buildImportRows", () => {
  it("classifies a negative single-amount row as debit", () => {
    const rows = buildImportRows(
      [
        ["Date", "Description", "Amount"],
        ["09/05/2026", "Grocery Store", "-84.32"],
      ],
      singleAmountMapping
    );
    expect(rows).toEqual([
      { rowIndex: 0, date: "2026-09-05", payeeRaw: "Grocery Store", amount: "84.32", direction: "debit" },
    ]);
  });

  it("classifies a positive single-amount row as credit", () => {
    const rows = buildImportRows(
      [
        ["Date", "Description", "Amount"],
        ["09/08/2026", "Paycheck Deposit", "2400.00"],
      ],
      singleAmountMapping
    );
    expect(rows[0]).toMatchObject({ direction: "credit", amount: "2400.00" });
  });

  it("classifies a populated debit column as debit and a populated credit column as credit", () => {
    const rows = buildImportRows(
      [
        ["Date", "Description", "Debit", "Credit"],
        ["09/05/2026", "Grocery Store", "84.32", ""],
        ["09/08/2026", "Paycheck Deposit", "", "2400.00"],
      ],
      debitCreditMapping
    );
    expect(rows[0]).toMatchObject({ direction: "debit", amount: "84.32" });
    expect(rows[1]).toMatchObject({ direction: "credit", amount: "2400.00" });
  });

  it("flags a row with an unrecognized date as an error instead of guessing", () => {
    const rows = buildImportRows(
      [
        ["Date", "Description", "Amount"],
        ["not-a-date", "Grocery Store", "-84.32"],
      ],
      singleAmountMapping
    );
    expect(rows[0].error).toContain("Unrecognized date");
    expect(rows[0].amount).toBeNull();
  });

  it("flags a row with a missing payee", () => {
    const rows = buildImportRows(
      [
        ["Date", "Description", "Amount"],
        ["09/05/2026", "  ", "-84.32"],
      ],
      singleAmountMapping
    );
    expect(rows[0].error).toContain("Missing payee");
  });

  it("flags a row with both debit and credit empty as a missing amount", () => {
    const rows = buildImportRows(
      [
        ["Date", "Description", "Debit", "Credit"],
        ["09/05/2026", "Grocery Store", "", ""],
      ],
      debitCreditMapping
    );
    expect(rows[0].error).toContain("Missing or invalid amount");
  });

  it("skips the header row only when hasHeaderRow is true", () => {
    const rows = buildImportRows(
      [["09/05/2026", "Grocery Store", "-84.32"]],
      { ...singleAmountMapping, hasHeaderRow: false }
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].payeeRaw).toBe("Grocery Store");
  });
});
