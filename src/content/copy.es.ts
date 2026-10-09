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
    /** <meta name="description">. Not rendered until the author fills it in. */
    description: 'TODO-AUTHOR: one-sentence description for the document head, without explaining the fragments',
  },
  colofon: {
    // Suggestion: a heading is optional; the Colofón may open with the text directly.
    heading: 'TODO-AUTHOR: Colofón heading, or empty',
    made: 'TODO-AUTHOR: how the artifact was made',
    credits: 'TODO-AUTHOR: credits',
    /** Use {cycle} where the current cycle number goes. */
    cycle: 'TODO-AUTHOR: sentence that states the current cycle number, with {cycle} as placeholder',
    contribution: 'TODO-AUTHOR: free contribution line (Phase 7, link to VITE_DONATION_URL)',
    email: 'TODO-AUTHOR: optional email line and consent text (Phase 7)',
    /** The author's LinkedIn: label as shown, and the URL (author-provided). */
    linkedinLabel: 'TODO-AUTHOR: visible label for the LinkedIn link',
    linkedinUrl: 'https://www.linkedin.com/in/edmundo-spohr/',
  },
} as const

export type Copy = typeof copy
