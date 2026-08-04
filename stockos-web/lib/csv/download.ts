/** Browser-side CSV download helper (shared by Reports + bulk export). */
export function downloadCSV(
  filename: string,
  headers: string[],
  rows: string[][],
): void {
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
