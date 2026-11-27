import { useCallback, useRef, useState, type DragEvent } from 'react';

export const MAX_TEXT_FILE_BYTES = 5 * 1024 * 1024; // 5 MB client-side memory guard
export const SUPPORTED_FILE_PATTERN = /\.(txt|csv)$/i;

export type FileValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Pure client-side guard validating file extension (.txt / .csv) and size
 * before reading file contents into browser memory.
 */
export function validateIngestedFile(
  file: Pick<File, 'name' | 'size'>
): FileValidationResult {
  if (!SUPPORTED_FILE_PATTERN.test(file.name)) {
    return { ok: false, error: 'Only .txt and .csv files are supported.' };
  }
  if (file.size > MAX_TEXT_FILE_BYTES) {
    return {
      ok: false,
      error: 'File exceeds the 5 MB client-side limit. Please split or trim the file.',
    };
  }
  return { ok: true };
}

function isFileDrag(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}

interface UseFileIngestionOptions {
  onLoadText: (content: string, fileName: string) => void;
}

/**
 * Manages local `.txt`/`.csv` file validation, FileReader/File.text ingestion,
 * and full-viewport drag-and-drop listeners strictly inside browser memory.
 */
export function useFileIngestion({ onLoadText }: UseFileIngestionOptions) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const handleFile = useCallback(
    async (file: File) => {
      const check = validateIngestedFile(file);
      if (!check.ok) {
        setError(check.error);
        return;
      }
      try {
        const content = await file.text();
        setError(null);
        onLoadText(content, file.name);
      } catch {
        setError('Could not read file.');
      }
    },
    [onLoadText]
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onDragEnter = useCallback((e: DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }, []);

  const onDragOver = useCallback((e: DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
  }, []);

  const onDragLeave = useCallback((e: DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setDragging(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void handleFile(f);
    },
    [handleFile]
  );

  return {
    dragging,
    error,
    setError,
    fileInputRef,
    handleFile,
    openFilePicker,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
  };
}
