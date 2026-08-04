'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

type Props = {
  /** Existing remote URL (edit flow). */
  currentUrl?: string | null;
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  label?: string;
};

export function ItemImageField({
  currentUrl,
  file,
  onFileChange,
  disabled,
  label = 'Product image (optional)',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shown = preview ?? currentUrl ?? null;

  function pick(next: File | null) {
    setError(null);
    if (!next) {
      onFileChange(null);
      return;
    }
    if (!ACCEPT.split(',').includes(next.type)) {
      setError('Use JPEG, PNG, WebP, or GIF');
      return;
    }
    if (next.size > MAX_BYTES) {
      setError('Image must be 5 MB or smaller');
      return;
    }
    onFileChange(next);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[#334155]">{label}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="group relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] transition hover:border-[#1E90FF] hover:bg-[#EFF6FF] disabled:opacity-50"
          title="Upload product image"
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown}
              alt="Product preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex flex-col items-center gap-1 text-[#94A3B8]">
              <ImagePlus className="h-6 w-6" />
              <span className="text-[11px] font-medium">Upload</span>
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1 space-y-2 text-sm text-[#64748B]">
          <p>JPEG, PNG, WebP, or GIF · max 5 MB. Shows in the inventory Image column.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="rounded-md border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50"
            >
              {shown ? 'Change image' : 'Choose image'}
            </button>
            {(file || currentUrl) && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  pick(null);
                  if (inputRef.current) inputRef.current.value = '';
                }}
                className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#64748B] hover:text-red-600 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
          {file ? (
            <p className="truncate text-xs text-[#334155]">{file.name}</p>
          ) : null}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        disabled={disabled}
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
