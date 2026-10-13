// Every visitor-facing string that is not part of the canon lives here.
// Values starting with "TODO-AUTHOR:" are placeholders the author must
// replace. Agents never write literary or visitor-facing copy; a suggestion
// may be left in a comment next to the key.
//
// Note: "TODO-AUTHOR" placeholders are rendered literally in Phase 1 so
// they are visible in the browser and in screen readers. Replace before
// launch.

export const copy = {
  a11y: {
    /** Label of the single focusable control that advances the journey. */
    advance: 'Avanzar',
    /** Label of the control that travels back to the previous place (territory). */
    back: 'Volver',
    /** Label of the seal when it becomes the button that opens the Colofón. */
    sealToColofon: 'Colofón',
  },
  meta: {
    /** <meta name="description"> (injected at build time, see vite.config.ts). DRAFT: see below. */
    description: 'Los veintidós microrrelatos de Códice del tiempo roto, de Edmundo Spohr, en un territorio de tinta para recorrer.',
  },
  // DRAFT copy for the Colofón and the description, proposed by the agent at the author's
  // request (2026-10-13) as a placeholder the author will rewrite. Not final author copy.
  colofon: {
    heading: 'Colofón',
    made: 'El territorio es tinta: se dibuja en el navegador, se mueve con el dedo y se desgasta con cada visita. Lo que todos dejan se acumula hasta que el territorio estalla y vuelve a empezar como otro mundo. Ningún texto de esta obra fue generado por una máquina.',
    credits: 'Textos, concepto y dirección: Edmundo Spohr. Tipografías: Archivo y Spectral.',
    /** Use {cycle} where the current cycle number goes. */
    cycle: 'Ciclo {cycle}.',
    /** Phase 7: free contribution line (link to VITE_DONATION_URL). Empty: not shown. */
    contribution: '',
    /** Phase 7: optional email line and consent text. Empty: not shown. */
    email: '',
    /** The author's LinkedIn: label as shown, and the URL (author-provided). */
    linkedinLabel: 'Edmundo Spohr en LinkedIn',
    linkedinUrl: 'https://www.linkedin.com/in/edmundo-spohr/',
  },
} as const

export type Copy = typeof copy
