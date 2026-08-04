'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { parseCSV } from '@/lib/csv/parse';

export interface CsvPreviewIssue {
  row: number;
  level: 'error' | 'warning';
  message: string;
}

export interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Called after file parse with raw rows for caller validation. */
  onParsed: (rows: Record<string, string>[], headers: string[]) => {
    issues: CsvPreviewIssue[];
    summary?: string;
    /** Rows that would be written (valid). */
    validCount: number;
  };
  onConfirm: () => Promise<void> | void;
  confirming?: boolean;
  /** Extra controls under the preview (e.g. apply-after-import checkbox). */
  extraControls?: React.ReactNode;
  templateHint?: string;
  onDownloadTemplate?: () => void;
}

export function CsvImportDialog({
  open,
  onOpenChange,
  title,
  description,
  onParsed,
  onConfirm,
  confirming,
  extraControls,
  templateHint,
  onDownloadTemplate,
}: CsvImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [issues, setIssues] = useState<CsvPreviewIssue[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [validCount, setValidCount] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);

  function resetPreview() {
    setFileName(null);
    setIssues([]);
    setSummary(null);
    setValidCount(0);
    setParseError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setParseError(null);
    try {
      const text = await file.text();
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0) {
        setParseError('Empty or invalid CSV');
        setIssues([]);
        setValidCount(0);
        setSummary(null);
        setFileName(file.name);
        return;
      }
      const result = onParsed(rows, headers);
      setFileName(file.name);
      setIssues(result.issues);
      setSummary(result.summary ?? null);
      setValidCount(result.validCount);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Failed to parse CSV');
      setIssues([]);
      setValidCount(0);
    }
  }

  const errorCount = issues.filter((i) => i.level === 'error').length;
  const canConfirm = validCount > 0 && errorCount === 0 && !parseError;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetPreview();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {onDownloadTemplate ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onDownloadTemplate}>
                Download template
              </Button>
              {templateHint ? (
                <p className="text-xs text-muted-foreground">{templateHint}</p>
              ) : null}
            </div>
          ) : null}

          <div>
            <Label htmlFor="csv-file">CSV file</Label>
            <input
              id="csv-file"
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="mt-1 block w-full text-sm"
              onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
            />
            {fileName ? (
              <p className="mt-1 text-xs text-muted-foreground">Selected: {fileName}</p>
            ) : null}
          </div>

          {parseError ? (
            <p className="text-sm text-destructive">{parseError}</p>
          ) : null}

          {summary ? <p className="text-sm">{summary}</p> : null}

          {issues.length > 0 ? (
            <div className="max-h-48 overflow-auto rounded-md border border-border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-2 py-1.5">Row</th>
                    <th className="px-2 py-1.5">Level</th>
                    <th className="px-2 py-1.5">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.slice(0, 100).map((issue, idx) => (
                    <tr key={`${issue.row}-${idx}`} className="border-t border-border/60">
                      <td className="px-2 py-1 font-mono">{issue.row}</td>
                      <td className="px-2 py-1">
                        <span
                          className={
                            issue.level === 'error'
                              ? 'text-destructive'
                              : 'text-amber-700 dark:text-amber-400'
                          }
                        >
                          {issue.level}
                        </span>
                      </td>
                      <td className="px-2 py-1">{issue.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {issues.length > 100 ? (
                <p className="border-t border-border px-2 py-1 text-xs text-muted-foreground">
                  Showing first 100 of {issues.length} issues
                </p>
              ) : null}
            </div>
          ) : null}

          {extraControls}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetPreview();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canConfirm || confirming}
            onClick={() => void onConfirm()}
          >
            <Upload className="h-4 w-4" />
            {confirming ? 'Importing…' : `Confirm import (${validCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
