import { beforeEach, describe, expect, it } from 'vitest';
import { defaultPageSettings, defaultSectionConfig, type LayoutElement, type PageDTO, type SectionDTO } from '@gc/shared-types';
import { resizeRect, snapMove, snapTargets } from './geometry';
import { layoutIssues } from './issues';
import { useEditor } from './store';
import { makeHeading, makeSection, makeShape, makeText } from './elements';
import { contactLine, fillTokens, resolveColor, tokenValues } from '../renderer/tokens';
import { estimateSectionHeight, generateLayout } from '../renderer/generate';
import { safeArea } from '../renderer/geometry';
import { emptyMenuData, type MenuData } from '../renderer/menuData';
import { defaultThemeConfig } from '@gc/shared-types';

const A4 = { w: 210, h: 297 };
const settings = { ...defaultPageSettings }; // margins 12/12/14/12, binding 10
const el = (over: Partial<LayoutElement>) => ({ ...makeText({ x: 40, y: 40, w: 50, h: 10 }), ...over }) as LayoutElement;

describe('snapping and resizing', () => {
  const targets = snapTargets({ w: A4.w, h: A4.h }, safeArea(settings, 1), []);
  it('snaps the centre of a moving box to the page centre within the threshold', () => {
    const { rect, guides } = snapMove({ x: 79, y: 100, w: 50, h: 20 }, targets, 3); // centre at 104 -> 105
    expect(rect.x).toBe(80);
    expect(guides).toContainEqual({ axis: 'x', at: 105 });
  });
  it('does not snap when nothing is close enough', () => {
    const { rect, guides } = snapMove({ x: 63.3, y: 91.1, w: 40, h: 20 }, targets, 1);
    expect(rect).toEqual({ x: 63.3, y: 91.1, w: 40, h: 20 });
    expect(guides).toHaveLength(0);
  });
  it('keeps the aspect ratio when resizing a corner', () => {
    const { rect } = resizeRect({ x: 10, y: 10, w: 40, h: 20 }, 'se', 20, 0, { keepAspect: true, minSize: 2, threshold: 0 });
    expect(rect.w / rect.h).toBeCloseTo(2);
    expect(rect.w).toBe(60);
  });
  it('resizing from the west edge moves x and never collapses below the minimum', () => {
    const grow = resizeRect({ x: 50, y: 10, w: 40, h: 20 }, 'w', -10, 0, { keepAspect: false, minSize: 2, threshold: 0 }).rect;
    expect(grow).toMatchObject({ x: 40, w: 50 });
    const crush = resizeRect({ x: 50, y: 10, w: 40, h: 20 }, 'w', 500, 0, { keepAspect: false, minSize: 2, threshold: 0 }).rect;
    expect(crush.w).toBe(2);
    expect(crush.x).toBe(88); // right edge stays put
  });
});

describe('print issues', () => {
  it('flags content that leaves the page', () => {
    const issues = layoutIssues([el({ id: 'a', x: 190, w: 40 })], settings, 1, {});
    expect(issues.map((i) => i.id)).toContain('out:a');
    expect(issues.find((i) => i.id === 'out:a')!.level).toBe('error');
  });
  it('flags the binding zone on the correct side for odd and even pages', () => {
    const left = el({ id: 'l', x: 5, w: 40 });
    const right = el({ id: 'r', x: 150, w: 55 });
    expect(layoutIssues([left], settings, 1, {}).some((i) => i.id === 'bind:l')).toBe(true); // odd page: binding on the left
    expect(layoutIssues([left], settings, 2, {}).some((i) => i.id === 'bind:l')).toBe(false); // even page: binding on the right
    expect(layoutIssues([right], settings, 2, {}).some((i) => i.id === 'bind:r')).toBe(true);
    expect(layoutIssues([right], settings, 1, {}).some((i) => i.id === 'bind:r')).toBe(false);
  });
  it('flags sections whose content is taller than their box, and overlapping sections', () => {
    const a = makeSection(1, { id: 'a', x: 25, y: 20, w: 150, h: 60 });
    const b = makeSection(2, { id: 'b', x: 25, y: 75, w: 150, h: 60 });
    const issues = layoutIssues([a, b], settings, 1, { a: 90, b: 40 });
    expect(issues.some((i) => i.id === 'over:a')).toBe(true);
    expect(issues.some((i) => i.id.startsWith('overlap:'))).toBe(true);
    const ok = layoutIssues([{ ...a, h: 60 }, { ...b, y: 90 }], settings, 1, { a: 55, b: 40 });
    expect(ok).toEqual([]);
  });
  it('ignores hidden elements', () => {
    expect(layoutIssues([el({ id: 'h', x: 400, hidden: true })], settings, 1, {})).toEqual([]);
  });
});

describe('editor history', () => {
  const page = { id: 1, title: 'P', subtitle: null, pageType: 'content', themeId: null, isActive: true, settings, layout: { version: 1, elements: [] } } as unknown as PageDTO;
  beforeEach(() => useEditor.getState().load(page, []));

  it('undoes and redoes element changes and tracks the dirty revision', () => {
    const s = useEditor.getState();
    s.addElements([makeText()]);
    expect(useEditor.getState().elements).toHaveLength(1);
    expect(useEditor.getState().status).toBe('dirty');
    useEditor.getState().undo();
    expect(useEditor.getState().elements).toHaveLength(0);
    useEditor.getState().redo();
    expect(useEditor.getState().elements).toHaveLength(1);
  });
  it('merges rapid edits of the same field into one undo step', () => {
    useEditor.getState().addElements([makeText()]);
    const id = useEditor.getState().elements[0]!.id;
    for (const c of ['H', 'He', 'Hel', 'Hell', 'Hello']) useEditor.getState().patch([id], { content: c } as Partial<LayoutElement>, `${id}:content`);
    expect((useEditor.getState().elements[0] as { content: string }).content).toBe('Hello');
    useEditor.getState().undo(); // one step back = before "H"
    expect((useEditor.getState().elements[0] as { content: string }).content).toBe('Your text here');
  });
  it('a drag is a single undo step however many live updates it had', () => {
    useEditor.getState().addElements([makeText({ x: 10, y: 10 })]);
    const id = useEditor.getState().elements[0]!.id;
    const before = useEditor.getState().past.length;
    useEditor.getState().beginGesture();
    for (let x = 11; x <= 30; x++) useEditor.getState().live((d) => ({ ...d, elements: d.elements.map((e) => (e.id === id ? { ...e, x } : e)) }));
    useEditor.getState().endGesture();
    expect(useEditor.getState().past.length).toBe(before + 1);
    useEditor.getState().undo();
    expect(useEditor.getState().elements[0]!.x).toBe(10);
  });
  it('a no-op gesture adds no history', () => {
    useEditor.getState().addElements([makeText()]);
    const before = useEditor.getState().past.length;
    useEditor.getState().beginGesture();
    useEditor.getState().endGesture();
    expect(useEditor.getState().past.length).toBe(before);
  });
  it('removes, duplicates and re-orders layers', () => {
    useEditor.getState().addElements([makeText({ name: 'A' }), makeText({ name: 'B' }), makeText({ name: 'C' })], false);
    const [a, b, c] = useEditor.getState().elements.map((e) => e.id) as [string, string, string];
    useEditor.getState().reorderZ([a], 'front');
    const order = [...useEditor.getState().elements].sort((x, y) => x.z - y.z).map((e) => e.name);
    expect(order).toEqual(['B', 'C', 'A']);
    useEditor.getState().reorderZ([c], 'back');
    expect([...useEditor.getState().elements].sort((x, y) => x.z - y.z).map((e) => e.name)).toEqual(['C', 'B', 'A']);
    useEditor.getState().duplicate([b]);
    expect(useEditor.getState().elements).toHaveLength(4);
    useEditor.getState().remove([a, b]);
    expect(useEditor.getState().elements.map((e) => e.name)).toEqual(['C', 'B copy']);
  });
  it('new edits clear the redo stack and saving clears the dirty state', () => {
    useEditor.getState().addElements([makeText()]);
    useEditor.getState().undo();
    expect(useEditor.getState().future).toHaveLength(1);
    useEditor.getState().addElements([makeShape('rect')]);
    expect(useEditor.getState().future).toHaveLength(0);
    const rev = useEditor.getState().rev;
    useEditor.getState().markSaved(rev);
    expect(useEditor.getState().status).toBe('saved');
    useEditor.getState().addElements([makeText()]);
    useEditor.getState().markSaved(rev); // an older save completing must not hide newer changes
    expect(useEditor.getState().status).toBe('dirty');
  });
});

describe('tokens and colours', () => {
  const restaurant = { id: 1, name: 'GOLDEN CRUNCH', tagline: 'CRISPY', phone1: '98765', phone2: null, address: 'Near Karam Mill', city: 'Anakapalli', pincode: '531001', instagram: 'gold.encrunch', facebook: null, website: null, gstNumber: null, footerText: null, primaryLogo: null, updatedAt: '' };
  const values = tokenValues(restaurant, { title: 'Page 1', subtitle: null }, 3, 5);
  it('fills tokens from the database values and blanks unknown ones', () => {
    expect(fillTokens('{{restaurant.name}} – p{{ page.number }}/{{page.total}} {{nope}}', values)).toBe('GOLDEN CRUNCH – p3/5 ');
  });
  it('formats instagram handles and the contact line', () => {
    expect(values['restaurant.instagram']).toBe('@gold.encrunch');
    expect(tokenValues({ ...restaurant, instagram: 'https://www.instagram.com/gold.encrunch/' }, { title: '', subtitle: null }, 1, 1)['restaurant.instagram']).toBe('@gold.encrunch');
    expect(contactLine(values)).toBe('Near Karam Mill, Anakapalli – 531001  •  98765  •  @gold.encrunch');
  });
  it('resolves theme references and literal colours', () => {
    expect(resolveColor('theme:accent', defaultThemeConfig)).toBe('#F5B51B');
    expect(resolveColor('#ABCDEF', defaultThemeConfig)).toBe('#ABCDEF');
    expect(resolveColor(null, defaultThemeConfig)).toBeUndefined();
  });
});

describe('layout generation', () => {
  const section = (id: number, title: string): SectionDTO => ({ id, pageId: 1, title, subtitle: null, description: null, displayOrder: id, image: null, backgroundId: null, categoryIds: [], itemIds: [], comboIds: [], config: defaultSectionConfig });
  const data: MenuData = { ...emptyMenuData };
  const base = { title: 'Page', subtitle: null, settings };

  it('stacks sections inside the safe area without overlap, respecting the binding side', () => {
    const els = generateLayout({ ...base, pageType: 'content' }, [section(1, 'A'), section(2, 'B'), section(3, 'C')], data, 1);
    const area = safeArea(settings, 1);
    expect(els).toHaveLength(3);
    els.forEach((e) => {
      expect(e.x).toBeGreaterThanOrEqual(area.left - 0.01);
      expect(e.x + e.w).toBeLessThanOrEqual(area.left + area.width + 0.01);
    });
    for (let i = 1; i < els.length; i++) expect(els[i]!.y).toBeGreaterThanOrEqual(els[i - 1]!.y + els[i - 1]!.h);
    // even page: the binding strip is on the right, so content shifts left
    const even = generateLayout({ ...base, pageType: 'content' }, [section(1, 'A')], data, 2)[0]!;
    expect(even.x).toBeLessThan(els[0]!.x);
  });
  it('builds brand text for cover and back pages from tokens (not hardcoded names)', () => {
    const cover = generateLayout({ ...base, pageType: 'cover' }, [], data, 1);
    expect(cover.some((e) => e.type === 'text' && e.content === '{{restaurant.name}}')).toBe(true);
    expect(cover.some((e) => e.type === 'text' && e.content === '{{restaurant.tagline}}')).toBe(true);
    const back = generateLayout({ ...base, pageType: 'back' }, [], data, 2);
    expect(back.some((e) => e.type === 'text' && e.content.includes('{{restaurant.fullAddress}}'))).toBe(true);
  });
  it('estimates taller boxes for taller card templates', () => {
    const s = section(1, 'S');
    const wide = estimateSectionHeight({ ...s, config: { ...s.config, columns: 1, cardTemplate: 'compact-list' } }, data, 176);
    const featured = estimateSectionHeight({ ...s, config: { ...s.config, cardTemplate: 'featured' } }, data, 176);
    expect(featured).toBeGreaterThan(wide);
    expect(makeHeading().role).toBe('heading');
  });
});
