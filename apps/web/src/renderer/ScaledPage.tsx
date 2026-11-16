import type { ReactNode } from 'react';
import { MM_PX } from './tokens';

/** Lays a millimetre-sized page out at `zoom`: the wrapper takes the scaled size, the page is scaled with a transform. */
export function ScaledPage({ widthMm, heightMm, zoom, children, shadow = true }: { widthMm: number; heightMm: number; zoom: number; children: ReactNode; shadow?: boolean }) {
  return (
    <div style={{ width: widthMm * MM_PX * zoom, height: heightMm * MM_PX * zoom, flex: 'none', boxShadow: shadow ? '0 2px 16px rgba(0,0,0,.45)' : undefined }}>
      <div style={{ width: `${widthMm}mm`, height: `${heightMm}mm`, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  );
}
