import { CURRENT_CYCLE } from '../app/cycle'
import { copy } from '../content/copy.es'

// Reached only through the lone seal. Contribution link and email sign-up arrive in Phase 7.
// All text here is author copy (or its TODO-AUTHOR placeholder).
export function Colofon() {
  const c = copy.colofon
  return (
    <div className="colofon">
      <p className="colofon__heading">{c.heading}</p>
      <p>{c.made}</p>
      <p>{c.credits}</p>
      <p data-cycle={CURRENT_CYCLE}>{c.cycle.replace('{cycle}', String(CURRENT_CYCLE))}</p>
      <p>{c.contribution}</p>
      <p>{c.email}</p>
      <p>
        <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer">
          {c.linkedinLabel}
        </a>
      </p>
    </div>
  )
}
