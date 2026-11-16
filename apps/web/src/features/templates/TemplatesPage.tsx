import { Link as RouterLink } from 'react-router-dom';
import { Box, Card, CardContent, Chip, Link, Typography } from '@mui/material';
import type { CardTemplate } from '@gc/shared-types';
import { CARD_TEMPLATE_LABELS, ComboCard, ItemCard, type CardOptions } from '../../renderer/cards';
import { themeFor, useMenuData } from '../../renderer/menuData';
import { MM_PX } from '../../renderer/tokens';
import { ErrorAlert, ListSkeleton, PageHeader } from '../../components/common';
import { Tab, Tabs } from '@mui/material';
import { useState } from 'react';
import PageDesigns from './PageDesigns';

const DESCRIPTIONS: Record<CardTemplate, string> = {
  premium: 'Large food image, name, description, quantity and price. The workhorse card.',
  'image-left': 'Image on the left, details on the right – good for two-column pages.',
  'image-top': 'Large image on top with the details underneath.',
  'compact-list': 'Small image, name and description with the price aligned right – dense lists.',
  featured: 'Premium double border, bestseller ribbon and a large price badge for hero items.',
  combo: 'Shows the included items, the combo price and the saving. Uses the combos assigned to a section.',
  'hero-ribbon': 'Folded ribbon title over a large photo with stacked gold price pills – the classic fast-food menu card.',
  poster: 'Full-bleed photo with the name and price pills laid over a dark gradient.',
  'circle-photo': 'Round photo with an accent ring beside the name, description and prices.',
};

/** The reusable card designs. Pick one per section in the Page Builder / editor (Templates tab). */
function CardStyles() {
  const { data, isLoading, error, refetch } = useMenuData();
  const theme = themeFor(data, null);
  const item = data.items.find((i) => i.isActive);
  const combo = data.combos.find((c) => c.isActive);
  const o: CardOptions = { theme, mode: 'preview', showDescription: true, showPrice: true, showQuantity: true, priceStyle: 'badge', imagePosition: 'top' };
  const cardMm = 64;
  const scale = 300 / (cardMm * MM_PX);

  return (
    <>
      {isLoading ? <ListSkeleton rows={3} height={200} /> : error ? <ErrorAlert error={error} onRetry={() => refetch()} /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(CARD_TEMPLATE_LABELS) as CardTemplate[]).map((t) => {
            const uses = data.sections.filter((s) => s.config.cardTemplate === t);
            return (
              <Card key={t} variant="outlined">
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Typography fontWeight={700} flex={1}>{CARD_TEMPLATE_LABELS[t]}</Typography>
                    <Chip size="small" variant="outlined" label={`${uses.length} section${uses.length === 1 ? '' : 's'}`} />
                  </div>
                  <Box sx={{ bgcolor: theme.colors.background, borderRadius: 1.5, p: 1.5, overflow: 'hidden', height: 230 }}>
                    <div style={{ width: `${cardMm}mm`, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                      {t === 'combo' ? (combo ? <ComboCard combo={combo} o={o} /> : <span style={{ color: theme.colors.text, fontSize: '8pt' }}>Create a combo to preview this template.</span>) : item ? <ItemCard item={item} template={t} o={o} /> : <span style={{ color: theme.colors.text, fontSize: '8pt' }}>Add a menu item to preview this template.</span>}
                    </div>
                  </Box>
                  <Typography variant="body2" color="text.secondary">{DESCRIPTIONS[t]}</Typography>
                  {uses.length > 0 && <Typography variant="caption" color="text.secondary">Used by: {uses.map((s) => s.title).join(', ')}</Typography>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Typography variant="body2" color="text.secondary" mt={3}>
        Apply a template from the <Link component={RouterLink} to="/pages">page designer</Link> (Templates tab) or per section under <Link component={RouterLink} to="/sections">Menu Sections</Link>.
      </Typography>
    </>
  );
}

/** Menu Templates: complete page designs (theme + background + frame + cards) and the individual card styles. */
export default function TemplatesPage() {
  const [tab, setTab] = useState(0);
  const { data, isLoading, error, refetch } = useMenuData();
  return (
    <>
      <PageHeader title="Menu Templates" subtitle="Premium ready-made designs for your whole menu, and the reusable card styles they are built from." />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Page designs (24)" />
        <Tab label="Card styles" />
      </Tabs>
      {tab === 0 ? (isLoading ? <ListSkeleton rows={3} height={220} /> : error ? <ErrorAlert error={error} onRetry={() => refetch()} /> : <PageDesigns data={data} />) : <CardStyles />}
    </>
  );
}
