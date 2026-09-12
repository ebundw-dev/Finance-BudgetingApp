"use client";

import { useActionState, useMemo, useState } from "react";
import { buildImportRows, parseCsv, type AmountMode, type ColumnMapping } from "@/lib/import/csv";
import { getImportPreviewAction, importTransactionsAction, type ImportSummary } from "@/lib/import/actions";
import type { ImportPreviewRow } from "@/lib/import/matching";
import { ImportPreviewTable, type EditableImportRow } from "@/components/ImportPreviewTable";
import { SubmitButton } from "@/components/SubmitButton";
import { Card } from "@/components/Card";
import {
  buttonPrimary,
  buttonSecondary,
  checkboxRow,
  checkbox as checkboxClass,
  errorBanner,
  field,
  label as labelClass,
  select as selectClass,
  successBanner,
} from "@/lib/ui";

export interface ImportAccount {
  id: string;
  name: string;
  type: string;
}

export interface ImportCategory {
  id: string;
  name: string;
}

type Step = "upload" | "mapping" | "preview" | "done";

// A thin wrapper whose only job is giving "Start another import" a clean
// way to reset every piece of state below (including the two
// useActionState hooks, which expose no reset function of their own) --
// remounting via `key` is simpler than threading a manual reset through
// every field.
export function ImportWizard(props: { accounts: ImportAccount[]; categories: ImportCategory[] }) {
  const [resetKey, setResetKey] = useState(0);
  return <ImportWizardInner key={resetKey} {...props} onStartOver={() => setResetKey((k) => k + 1)} />;
}

function guessColumn(headers: string[], keywords: string[], fallback: number): number {
  const found = headers.findIndex((h) => keywords.some((k) => h.includes(k)));
  return found >= 0 ? found : fallback;
}

function ImportWizardInner({
  accounts,
  categories,
  onStartOver,
}: {
  accounts: ImportAccount[];
  categories: ImportCategory[];
  onStartOver: () => void;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<string[][]>([]);

  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [dateColumn, setDateColumn] = useState(0);
  const [payeeColumn, setPayeeColumn] = useState(1);
  const [amountMode, setAmountMode] = useState<AmountMode>("single");
  const [amountColumn, setAmountColumn] = useState(2);
  const [debitColumn, setDebitColumn] = useState(2);
  const [creditColumn, setCreditColumn] = useState(3);

  const [previewRows, previewFormAction] = useActionState<ImportPreviewRow[] | null, FormData>(
    getImportPreviewAction,
    null
  );
  const [editableRows, setEditableRows] = useState<EditableImportRow[]>([]);
  // Tracks which previewRows result editableRows was last derived from, so
  // that derivation happens once per fresh action result (adjusted during
  // render, React's documented alternative to a setState-in-effect for
  // "derive state from a prop/other state when it changes") rather than on
  // every render, which would clobber the user's own checkbox/category edits.
  const [seenPreviewRows, setSeenPreviewRows] = useState<ImportPreviewRow[] | null>(null);

  const [summary, importFormAction] = useActionState<ImportSummary | null, FormData>(
    importTransactionsAction,
    null
  );

  if (previewRows && previewRows !== seenPreviewRows) {
    setSeenPreviewRows(previewRows);
    setEditableRows(
      previewRows.map((row) => ({
        ...row,
        included: !row.error && !row.isDuplicate,
        categoryId: row.suggestedCategoryId ?? "",
      }))
    );
    setStep("preview");
  }

  if (summary && step !== "done") {
    setStep("done");
  }

  const headerRow = csvRows[0] ?? [];
  const columnOptions = headerRow.map((header, index) => ({
    value: index,
    label: hasHeaderRow ? header.trim() || `Column ${index + 1}` : `Column ${index + 1}`,
  }));

  function handleFile(file: File) {
    setFileError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setFileError("This file has no rows.");
        return;
      }
      setCsvRows(rows);
      setFileName(file.name);

      const headers = rows[0].map((h) => h.toLowerCase());
      setDateColumn(guessColumn(headers, ["date"], 0));
      setPayeeColumn(guessColumn(headers, ["description", "payee", "merchant", "name"], Math.min(1, rows[0].length - 1)));
      const debitGuess = headers.findIndex((h) => h.includes("debit"));
      const creditGuess = headers.findIndex((h) => h.includes("credit"));
      if (debitGuess >= 0 && creditGuess >= 0) {
        setAmountMode("debitCredit");
        setDebitColumn(debitGuess);
        setCreditColumn(creditGuess);
      } else {
        setAmountMode("single");
        setAmountColumn(guessColumn(headers, ["amount"], Math.min(2, rows[0].length - 1)));
      }
    };
    reader.onerror = () => setFileError("Could not read this file.");
    reader.readAsText(file);
  }

  const mapping: ColumnMapping = useMemo(
    () => ({ hasHeaderRow, dateColumn, payeeColumn, amountMode, amountColumn, debitColumn, creditColumn }),
    [hasHeaderRow, dateColumn, payeeColumn, amountMode, amountColumn, debitColumn, creditColumn]
  );

  const normalizedRows = useMemo(() => buildImportRows(csvRows, mapping), [csvRows, mapping]);

  function toggleIncluded(index: number, included: boolean) {
    setEditableRows((prev) => prev.map((row, i) => (i === index ? { ...row, included } : row)));
  }
  function changeCategory(index: number, categoryId: string) {
    setEditableRows((prev) => prev.map((row, i) => (i === index ? { ...row, categoryId } : row)));
  }

  const includedRows = editableRows.filter((r) => r.included);
  const excludedCount = editableRows.length - includedRows.length;
  const duplicateFlaggedCount = editableRows.filter((r) => r.isDuplicate).length;
  const hasMissingCategory = includedRows.some((r) => r.direction === "debit" && !r.categoryId);

  const finalRowsJson = JSON.stringify(
    includedRows.map((r) => ({
      date: r.date,
      payeeRaw: r.payeeRaw,
      amount: r.amount,
      direction: r.direction,
      categoryId: r.categoryId || null,
      isDuplicate: r.isDuplicate,
    }))
  );

  return (
    <div>
      {step === "upload" ? (
        <Card>
          <div className={field}>
            <label htmlFor="accountId" className={labelClass}>
              Import into account
            </label>
            <select
              id="accountId"
              className={selectClass}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.type})
                </option>
              ))}
            </select>
            <p className="text-text-muted mt-1 text-xs">
              Every row in this file will post to this one account.
            </p>
          </div>

          <div className={field}>
            <label htmlFor="csvFile" className={labelClass}>
              CSV file
            </label>
            <input
              id="csvFile"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-accent/12 file:px-4 file:py-2 file:text-sm file:font-medium file:text-accent hover:file:bg-accent/20"
            />
            {fileName ? <p className="text-text-muted mt-1 text-xs">Loaded {fileName}.</p> : null}
          </div>

          {fileError ? (
            <p role="alert" className={errorBanner}>
              {fileError}
            </p>
          ) : null}

          <button
            type="button"
            className={buttonPrimary}
            disabled={csvRows.length === 0 || !accountId}
            onClick={() => setStep("mapping")}
          >
            Continue
          </button>
        </Card>
      ) : null}

      {step === "mapping" ? (
        <Card>
          <label className={checkboxRow}>
            <input
              type="checkbox"
              className={checkboxClass}
              checked={hasHeaderRow}
              onChange={(e) => setHasHeaderRow(e.target.checked)}
            />
            First row is a header row
          </label>

          <div className={field}>
            <label className={labelClass}>Date column</label>
            <select
              className={selectClass}
              value={dateColumn}
              onChange={(e) => setDateColumn(Number(e.target.value))}
            >
              {columnOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className={field}>
            <label className={labelClass}>Payee / description column</label>
            <select
              className={selectClass}
              value={payeeColumn}
              onChange={(e) => setPayeeColumn(Number(e.target.value))}
            >
              {columnOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <label className={checkboxRow}>
            <input
              type="checkbox"
              className={checkboxClass}
              checked={amountMode === "debitCredit"}
              onChange={(e) => setAmountMode(e.target.checked ? "debitCredit" : "single")}
            />
            Separate debit/credit columns (instead of one signed amount column)
          </label>

          {amountMode === "single" ? (
            <div className={field}>
              <label className={labelClass}>Amount column</label>
              <select
                className={selectClass}
                value={amountColumn}
                onChange={(e) => setAmountColumn(Number(e.target.value))}
              >
                {columnOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-text-muted mt-1 text-xs">
                Negative = expense, positive = income.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className={field}>
                <label className={labelClass}>Debit column</label>
                <select
                  className={selectClass}
                  value={debitColumn}
                  onChange={(e) => setDebitColumn(Number(e.target.value))}
                >
                  {columnOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={field}>
                <label className={labelClass}>Credit column</label>
                <select
                  className={selectClass}
                  value={creditColumn}
                  onChange={(e) => setCreditColumn(Number(e.target.value))}
                >
                  {columnOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" className={buttonSecondary} onClick={() => setStep("upload")}>
              Back
            </button>
            <form action={previewFormAction}>
              <input type="hidden" name="accountId" value={accountId} />
              <input type="hidden" name="rowsJson" value={JSON.stringify(normalizedRows)} />
              <SubmitButton className={buttonPrimary} pendingLabel="Loading preview…">
                Preview {normalizedRows.length} row{normalizedRows.length === 1 ? "" : "s"}
              </SubmitButton>
            </form>
          </div>
        </Card>
      ) : null}

      {step === "preview" ? (
        <div>
          <p className="text-text-secondary mb-4 text-sm">
            {editableRows.length} row{editableRows.length === 1 ? "" : "s"} parsed
            {duplicateFlaggedCount > 0 ? `, ${duplicateFlaggedCount} flagged as possible duplicates` : ""}
            . Uncheck any row to exclude it, or fix its category before importing.
          </p>

          <Card padded={false} className="mb-6 overflow-x-auto">
            <ImportPreviewTable
              rows={editableRows}
              categories={categories}
              onToggleIncluded={toggleIncluded}
              onCategoryChange={changeCategory}
            />
          </Card>

          {hasMissingCategory ? (
            <p role="alert" className={errorBanner}>
              Every included expense row needs a category before you can import.
            </p>
          ) : null}

          <div className="flex gap-2">
            <button type="button" className={buttonSecondary} onClick={() => setStep("mapping")}>
              Back
            </button>
            <form action={importFormAction}>
              <input type="hidden" name="accountId" value={accountId} />
              <input type="hidden" name="rowsJson" value={finalRowsJson} />
              <input type="hidden" name="excludedCount" value={excludedCount} />
              <SubmitButton
                className={buttonPrimary}
                pendingLabel="Importing…"
                disabled={includedRows.length === 0 || hasMissingCategory}
              >
                Import {includedRows.length} transaction{includedRows.length === 1 ? "" : "s"}
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : null}

      {step === "done" && summary ? (
        <Card>
          <p role="status" className={successBanner}>
            Import complete.
          </p>
          <ul className="space-y-1 text-sm text-text">
            <li>{summary.imported} imported</li>
            <li>{summary.excluded} skipped or excluded</li>
            <li>{summary.duplicatesIncluded} flagged as a possible duplicate but included</li>
            {summary.failed.length > 0 ? <li className="text-danger">{summary.failed.length} failed to post</li> : null}
          </ul>
          {summary.failed.length > 0 ? (
            <ul className="border-border mt-3 space-y-1 border-t pt-3 text-xs text-text-secondary">
              {summary.failed.map((f, i) => (
                <li key={i}>
                  {f.payee}: {f.message}
                </li>
              ))}
            </ul>
          ) : null}
          <button type="button" className={`${buttonSecondary} mt-4`} onClick={onStartOver}>
            Start another import
          </button>
        </Card>
      ) : null}
    </div>
  );
}
