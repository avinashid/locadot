/**
 * The locadot mark: a padlock on a blue tile, its body the "dot". Served as the favicon and used by the
 * sidebar and sign-in page (.logo background). assets/logo.svg is the same drawing for the README.
 */
export const LOGO_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
  `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
  `<stop offset="0" stop-color="#4f8ff7"/><stop offset=".55" stop-color="#2563eb"/><stop offset="1" stop-color="#1e4fd6"/>` +
  `</linearGradient></defs>` +
  `<rect width="64" height="64" rx="15" fill="url(#g)"/>` +
  `<path d="M23.5 30v-6.5a8.5 8.5 0 0 1 17 0V30" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>` +
  `<rect x="15" y="28" width="34" height="24" rx="6" fill="#fff"/>` +
  `<circle cx="32" cy="40" r="5" fill="#2563eb"/>` +
  `</svg>`;

export const LOGO_DATA_URI = `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`;
