// Self-hosted fonts: the editor, live preview and PDF export all load the exact same files,
// so what you see is what gets printed (no dependency on Google Fonts / network at export time).
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/playfair-display/400-italic.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/oswald/400.css';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/oswald/700.css';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/lora/400.css';
import '@fontsource/lora/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

import '@fontsource/pacifico/400.css';
import '@fontsource/lobster/400.css';
import '@fontsource/dancing-script/400.css';
import '@fontsource/dancing-script/700.css';
import '@fontsource/abril-fatface/400.css';
import '@fontsource/anton/400.css';
import '@fontsource/dm-serif-display/400.css';
import '@fontsource/dm-serif-display/400-italic.css';
import '@fontsource/righteous/400.css';
import '@fontsource/permanent-marker/400.css';
import '@fontsource/kaushan-script/400.css';

export const BUNDLED_FONTS = ['Playfair Display', 'Poppins', 'Oswald', 'Montserrat', 'Bebas Neue', 'Cinzel', 'Lora', 'Inter', 'Pacifico', 'Lobster', 'Dancing Script', 'Abril Fatface', 'Anton', 'DM Serif Display', 'Righteous', 'Permanent Marker', 'Kaushan Script'] as const;
