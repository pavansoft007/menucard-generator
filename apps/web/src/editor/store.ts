import { create } from 'zustand';
import type { LayoutElement, PageDTO, PageSettings } from '@gc/shared-types';
import { newId } from './elements';

/** The part of the document that undo / redo covers. */
interface Doc {
  elements: LayoutElement[];
  settings: PageSettings;
  themeId: number | null;
}
export interface PageMeta {
  title: string;
  subtitle: string | null;
  pageType: PageDTO['pageType'];
  isActive: boolean;
}
export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

const HISTORY_LIMIT = 100;
const COALESCE_MS = 900;

interface EditorState extends Doc {
  pageId: number | null;
  meta: PageMeta;
  selection: string[];
  zoom: number;
  fit: boolean;
  snap: boolean;
  guides: boolean;
  past: Doc[];
  future: Doc[];
  rev: number; // bumps on every change; autosave watches it
  savedRev: number;
  status: SaveStatus;
  saveError: string | null;
  measured: Record<string, number>; // section element id -> natural content height (mm)
  editingText: string | null;

  load: (page: PageDTO, elements: LayoutElement[]) => void;
  select: (ids: string[], additive?: boolean) => void;
  setZoom: (z: number) => void;
  setFit: (f: boolean) => void;
  toggle: (k: 'snap' | 'guides') => void;
  setMeasured: (id: string, h: number) => void;
  setEditingText: (id: string | null) => void;

  /** Discrete change: one undo step. `coalesce` merges rapid edits of the same field into one step. */
  apply: (fn: (d: Doc) => Doc, coalesce?: string) => void;
  /** Continuous gesture (drag / resize / rotate): live updates, one undo step on end. */
  beginGesture: () => void;
  live: (fn: (d: Doc) => Doc) => void;
  endGesture: () => void;

  addElements: (els: LayoutElement[], select?: boolean) => void;
  patch: (ids: string[], patch: Partial<LayoutElement> | ((e: LayoutElement) => Partial<LayoutElement>), coalesce?: string) => void;
  remove: (ids: string[]) => void;
  duplicate: (ids: string[]) => void;
  reorderZ: (ids: string[], mode: 'front' | 'back' | 'forward' | 'backward') => void;
  setSettings: (patch: Partial<PageSettings>, coalesce?: string) => void;
  setThemeId: (id: number | null) => void;
  setMeta: (patch: Partial<PageMeta>) => void;
  replaceElements: (els: LayoutElement[]) => void;
  undo: () => void;
  redo: () => void;
  markSaving: () => void;
  markSaved: (rev: number) => void;
  markError: (msg: string) => void;
}

const doc = (s: EditorState): Doc => ({ elements: s.elements, settings: s.settings, themeId: s.themeId });
let pending: Doc | null = null;
let lastKey = '';
let lastAt = 0;

const normalizeZ = (els: LayoutElement[]) => [...els].sort((a, b) => a.z - b.z).map((e, i) => ({ ...e, z: i + 1 }));

export const useEditor = create<EditorState>((set, get) => ({
  pageId: null,
  meta: { title: '', subtitle: null, pageType: 'content', isActive: true },
  elements: [],
  settings: undefined as unknown as PageSettings,
  themeId: null,
  selection: [],
  zoom: 1,
  fit: true,
  snap: true,
  guides: true,
  past: [],
  future: [],
  rev: 0,
  savedRev: 0,
  status: 'saved',
  saveError: null,
  measured: {},
  editingText: null,

  load: (page, elements) => {
    pending = null;
    lastKey = '';
    set({
      pageId: page.id,
      meta: { title: page.title, subtitle: page.subtitle, pageType: page.pageType, isActive: page.isActive },
      elements,
      settings: page.settings,
      themeId: page.themeId,
      selection: [],
      past: [],
      future: [],
      rev: 0,
      savedRev: 0,
      status: 'saved',
      saveError: null,
      measured: {},
      editingText: null,
    });
  },

  select: (ids, additive) => set((s) => ({ selection: additive ? [...new Set([...s.selection, ...ids])].filter((i) => !(s.selection.includes(i) && ids.includes(i))) : ids })),
  setZoom: (z) => set({ zoom: Math.min(4, Math.max(0.1, z)), fit: false }),
  setFit: (f) => set({ fit: f }),
  toggle: (k) => set((s) => ({ [k]: !s[k] }) as Pick<EditorState, 'snap' | 'guides'>),
  setMeasured: (id, h) => set((s) => (s.measured[id] === h ? s : { measured: { ...s.measured, [id]: h } })),
  setEditingText: (id) => set({ editingText: id }),

  apply: (fn, coalesce) => {
    const s = get();
    const now = Date.now();
    const merge = coalesce && coalesce === lastKey && now - lastAt < COALESCE_MS;
    const before = doc(s);
    const after = fn(before);
    if (after === before) return;
    lastKey = coalesce ?? '';
    lastAt = now;
    set({
      ...after,
      past: merge ? s.past : [...s.past, before].slice(-HISTORY_LIMIT),
      future: [],
      rev: s.rev + 1,
      status: 'dirty',
    });
  },

  beginGesture: () => {
    pending = doc(get());
  },
  live: (fn) => {
    const s = get();
    const after = fn(doc(s));
    set({ ...after, rev: s.rev + 1, status: 'dirty' });
  },
  endGesture: () => {
    const s = get();
    if (pending && (pending.elements !== s.elements || pending.settings !== s.settings)) {
      set({ past: [...s.past, pending].slice(-HISTORY_LIMIT), future: [] });
    }
    pending = null;
    lastKey = '';
  },

  addElements: (els, select = true) => {
    get().apply((d) => {
      const top = d.elements.reduce((m, e) => Math.max(m, e.z), 0);
      const added = els.map((e, i) => ({ ...e, id: newId(), z: top + 1 + (e.z || 0) + i }));
      if (select) setTimeout(() => get().select(added.map((a) => a.id)), 0);
      return { ...d, elements: [...d.elements, ...added] };
    });
  },

  patch: (ids, patch, coalesce) =>
    get().apply((d) => {
      const set_ = new Set(ids);
      return { ...d, elements: d.elements.map((e) => (set_.has(e.id) ? ({ ...e, ...(typeof patch === 'function' ? patch(e) : patch) } as LayoutElement) : e)) };
    }, coalesce),

  remove: (ids) => {
    get().apply((d) => ({ ...d, elements: d.elements.filter((e) => !ids.includes(e.id)) }));
    set((s) => ({ selection: s.selection.filter((i) => !ids.includes(i)), editingText: null }));
  },

  duplicate: (ids) => {
    const copies = get().elements.filter((e) => ids.includes(e.id)).map((e) => ({ ...e, x: e.x + 4, y: e.y + 4, name: e.name ? `${e.name} copy` : null, locked: false }));
    if (copies.length) get().addElements(copies);
  },

  reorderZ: (ids, mode) =>
    get().apply((d) => {
      const sorted = normalizeZ(d.elements);
      const sel = new Set(ids);
      let list = sorted;
      if (mode === 'front') list = [...sorted.filter((e) => !sel.has(e.id)), ...sorted.filter((e) => sel.has(e.id))];
      else if (mode === 'back') list = [...sorted.filter((e) => sel.has(e.id)), ...sorted.filter((e) => !sel.has(e.id))];
      else {
        list = [...sorted];
        const order = mode === 'forward' ? [...list.keys()].reverse() : [...list.keys()];
        for (const i of order) {
          const j = mode === 'forward' ? i + 1 : i - 1;
          if (sel.has(list[i]!.id) && list[j] && !sel.has(list[j]!.id)) [list[i], list[j]] = [list[j]!, list[i]!];
        }
      }
      return { ...d, elements: list.map((e, i) => ({ ...e, z: i + 1 })) };
    }),

  setSettings: (patch, coalesce) => get().apply((d) => ({ ...d, settings: { ...d.settings, ...patch } }), coalesce ?? `settings:${Object.keys(patch).join(',')}`),
  setThemeId: (themeId) => get().apply((d) => ({ ...d, themeId })),
  setMeta: (patch) => set((s) => ({ meta: { ...s.meta, ...patch }, rev: s.rev + 1, status: 'dirty' })),
  replaceElements: (els) => get().apply((d) => ({ ...d, elements: normalizeZ(els) })),

  undo: () => {
    const s = get();
    const prev = s.past[s.past.length - 1];
    if (!prev) return;
    lastKey = '';
    set({ ...prev, past: s.past.slice(0, -1), future: [doc(s), ...s.future].slice(0, HISTORY_LIMIT), rev: s.rev + 1, status: 'dirty', selection: s.selection.filter((id) => prev.elements.some((e) => e.id === id)), editingText: null });
  },
  redo: () => {
    const s = get();
    const next = s.future[0];
    if (!next) return;
    lastKey = '';
    set({ ...next, future: s.future.slice(1), past: [...s.past, doc(s)].slice(-HISTORY_LIMIT), rev: s.rev + 1, status: 'dirty', selection: s.selection.filter((id) => next.elements.some((e) => e.id === id)), editingText: null });
  },

  markSaving: () => set({ status: 'saving' }),
  markSaved: (rev) => set((s) => ({ savedRev: rev, status: s.rev === rev ? 'saved' : 'dirty', saveError: null })),
  markError: (msg) => set({ status: 'error', saveError: msg }),
}));
