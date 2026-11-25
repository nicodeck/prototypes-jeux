// De petites icônes au trait, en SVG, pour les marchandises et les habitants.
const svg = (corps: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${corps}</svg>`;

export const ICONES = {
  denarii: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5.5" stroke-width="0.8"/><path d="M10 9.5c0-1 1-1.5 2-1.5s2 .6 2 1.5-1 1.3-2 1.6-2 .8-2 1.8.9 1.6 2 1.6 2-.5 2-1.4M12 7v1M12 15v1"/>'),
  habitants: svg('<circle cx="12" cy="7" r="3"/><path d="M6 20c0-4 2.7-7 6-7s6 3 6 7"/>'),
  bois: svg('<ellipse cx="7" cy="15" rx="3" ry="3"/><ellipse cx="7" cy="15" rx="1" ry="1"/><path d="M7 12h11a3 3 0 0 1 0 6H7"/><ellipse cx="13" cy="8" rx="2.4" ry="2.4"/><path d="M13 5.6h6a2.4 2.4 0 0 1 0 4.8h-6"/>'),
  marbre: svg('<path d="M4 9l8-4 8 4-8 4z"/><path d="M4 9v7l8 4 8-4V9"/><path d="M12 13v7"/><path d="M7 11.5l2 3" stroke-width="0.8"/>'),
  poisson: svg('<path d="M3 12c3-4 8-5 12-3l4-3v12l-4-3c-4 2-9 1-12-3z"/><circle cx="7.5" cy="11" r=".8" fill="currentColor"/>'),
  ble: svg('<path d="M12 21V8"/><path d="M12 8c-2-1-2-4 0-5 2 1 2 4 0 5z"/><path d="M12 12c-2.5-.5-3.5-3-2-4.5M12 12c2.5-.5 3.5-3 2-4.5M12 16c-2.5-.5-3.5-3-2-4.5M12 16c2.5-.5 3.5-3 2-4.5"/>'),
  farine: svg('<path d="M8 6c0-1 1.5-2 4-2s4 1 4 2l2 12c0 1.5-2.5 2.5-6 2.5S6 19.5 6 18z"/><path d="M8.5 6.5c1 .6 2.2.8 3.5.8s2.5-.2 3.5-.8"/>'),
  pain: svg('<path d="M4 14c0-4 3.6-7 8-7s8 3 8 7c0 2-1.5 3-3 3H7c-1.5 0-3-1-3-3z"/><path d="M8 10l1.5 2.5M12 9.5v3M16 10l-1.5 2.5"/>'),
  olives: svg('<ellipse cx="9" cy="14" rx="3" ry="4" transform="rotate(-20 9 14)"/><ellipse cx="15.5" cy="15" rx="2.7" ry="3.6" transform="rotate(15 15.5 15)"/><path d="M10 9.5c1-3 3-5 7-6M13 7c1.5 0 3 .5 4 1.5"/>'),
  huile: svg('<path d="M9 3h6M10 3v3c-3 1-5 4-5 8 0 4 3 7 7 7s7-3 7-7c0-4-2-7-5-8V3"/><path d="M5 11c-2 0-2 3 0 3M19 11c2 0 2 3 0 3"/>'),
  raisin: svg('<circle cx="10" cy="10" r="2"/><circle cx="14" cy="10" r="2"/><circle cx="12" cy="13.5" r="2"/><circle cx="8" cy="13.5" r="2"/><circle cx="16" cy="13.5" r="2"/><circle cx="10" cy="17" r="2"/><circle cx="14" cy="17" r="2"/><path d="M12 8V4c1-1 3-1 4 0"/>'),
  vin: svg('<path d="M7 4h10c0 5-2 8-5 8s-5-3-5-8z"/><path d="M12 12v7M8.5 20h7"/><path d="M7.5 7h9" stroke-width="0.8"/>'),
  route: svg('<path d="M8 3L5 21M16 3l3 18M12 4v3M12 10v3M12 16v4"/>'),
  demolir: svg('<path d="M4 20h16"/><path d="M6 20v-6l3-2 2 3 3-5 4 3v7"/><path d="M14 4l2 2M18 3l-1 3M20 7l-3 0"/>'),
  pause: svg('<path d="M9 6v12M15 6v12"/>'),
  lecture: svg('<path d="M8 5l10 7-10 7z"/>'),
  son: svg('<path d="M4 10v4h3l5 4V6L7 10z"/><path d="M16 9c1.5 1.5 1.5 4.5 0 6M18.5 7c2.8 2.8 2.8 7.2 0 10"/>'),
  muet: svg('<path d="M4 10v4h3l5 4V6L7 10z"/><path d="M16 9l5 6M21 9l-5 6"/>'),
  cinema: svg('<rect x="3" y="6" width="13" height="12" rx="1.5"/><path d="M16 10l5-3v10l-5-3"/>'),
  soleil: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>'),
  voile: svg('<circle cx="9" cy="9" r="3"/><path d="M9 3.5v1.5M3.5 9H5M5.2 5.2l1 1M12.8 5.2l-1 1"/><path d="M8 18h10a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.5 1.5A3 3 0 0 0 8 18z"/>'),
  nuages: svg('<path d="M6 19h11a4 4 0 0 0 0-8 6 6 0 0 0-11.4 1.8A3.2 3.2 0 0 0 6 19z"/>'),
  pluie: svg('<path d="M6 15h11a4 4 0 0 0 0-8 6 6 0 0 0-11.4 1.8A3.2 3.2 0 0 0 6 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>'),
  orage: svg('<path d="M6 14h11a4 4 0 0 0 0-8 6 6 0 0 0-11.4 1.8A3.2 3.2 0 0 0 6 14z"/><path d="M12 14l-2 4h3l-2 4"/>'),
  lune: svg('<path d="M18 15.5A7.5 7.5 0 0 1 8.5 6a7.5 7.5 0 1 0 9.5 9.5z"/>'),
  temple: svg('<path d="M3 9l9-5 9 5z"/><path d="M5 9v9M9 9v9M15 9v9M19 9v9M3 18h18M2 21h20"/>'),
  maison: svg('<path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>'),
  atelier: svg('<path d="M3 20V10l5 3V10l5 3V10l5 3V5h3v15z"/><path d="M7 16h2M12 16h2"/>'),
  service: svg('<path d="M4 20h16M5 20V10M9 20V10M15 20V10M19 20V10M3 10h18M6 10l6-5 6 5"/>'),
} as const;

export type NomIcone = keyof typeof ICONES;
