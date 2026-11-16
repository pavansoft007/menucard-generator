import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pageInputSchema, type LayoutElement, type PageSettings } from '@gc/shared-types';
import { keys, pageService } from '../services/menuService';
import { useEditor } from './store';

const SAVE_DELAY = 1500; // ms after the last change
const RETRY_DELAY = 5000;
export const draftKey = (pageId: number) => `gc-draft-${pageId}`;

export interface Draft {
  savedAt: number;
  elements: LayoutElement[];
  settings: PageSettings;
  themeId: number | null;
}

export const readDraft = (pageId: number): Draft | null => {
  try {
    const raw = localStorage.getItem(draftKey(pageId));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
};
export const clearDraft = (pageId: number) => {
  try { localStorage.removeItem(draftKey(pageId)); } catch { /* storage unavailable */ }
};

/**
 * Saves the open page automatically: debounced PUT, a local draft copy on every change (survives a refresh or
 * crash), a warning when leaving with unsaved work, and a `flush` for "save now" / switching pages.
 */
export function useAutosave() {
  const qc = useQueryClient();
  const save = useMutation({ mutationFn: ({ id, input }: { id: number; input: Parameters<typeof pageService.update>[1] }) => pageService.update(id, input) });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const draftTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inFlight = useRef<Promise<void> | null>(null);
  const saveRef = useRef(save.mutateAsync);
  saveRef.current = save.mutateAsync;

  const run = useCallback(async (): Promise<void> => {
    if (inFlight.current) await inFlight.current; // never overlap two saves of the same page
    const s = useEditor.getState();
    if (s.pageId === null || s.rev === s.savedRev) return;
    const rev = s.rev;
    const pageId = s.pageId;
    const parsed = pageInputSchema.safeParse({
      title: s.meta.title,
      subtitle: s.meta.subtitle,
      pageType: s.meta.pageType,
      themeId: s.themeId,
      isActive: s.meta.isActive,
      settings: s.settings,
      layout: { version: 1, elements: s.elements, ...(s.elements.length === 0 ? { blank: true } : {}) },
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      s.markError(`${first?.path.join('.') ?? 'page'}: ${first?.message ?? 'invalid value'}`);
      return;
    }
    s.markSaving();
    const task = (async () => {
      try {
        await saveRef.current({ id: pageId, input: parsed.data });
        useEditor.getState().markSaved(rev);
        if (useEditor.getState().rev === rev) clearDraft(pageId);
        qc.invalidateQueries({ queryKey: keys.pages });
      } catch (e) {
        useEditor.getState().markError(e instanceof Error ? e.message : 'Could not save');
        clearTimeout(timer.current);
        timer.current = setTimeout(() => void run(), RETRY_DELAY);
      }
    })();
    inFlight.current = task;
    await task;
    inFlight.current = null;
  }, [qc]);

  useEffect(() => {
    return useEditor.subscribe((s, prev) => {
      if (s.rev === prev.rev || s.pageId === null) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void run(), SAVE_DELAY);
      clearTimeout(draftTimer.current);
      draftTimer.current = setTimeout(() => {
        const cur = useEditor.getState();
        if (cur.pageId === null || cur.rev === cur.savedRev) return;
        try {
          localStorage.setItem(draftKey(cur.pageId), JSON.stringify({ savedAt: Date.now(), elements: cur.elements, settings: cur.settings, themeId: cur.themeId } satisfies Draft));
        } catch { /* quota / private mode: autosave to the server still works */ }
      }, 300);
    });
  }, [run]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      const s = useEditor.getState();
      if (s.rev !== s.savedRev) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      clearTimeout(timer.current);
      void run(); // leaving the editor: push any pending change out
    };
  }, [run]);

  return { flush: run };
}
