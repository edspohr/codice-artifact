import { CURRENT_CYCLE } from '../app/cycle'
import { copy } from '../content/copy.es'

// Reached only through the lone seal. Contribution link and email sign-up arrive in Phase 7.
// All text here is author copy (or its TODO-AUTHOR placeholder).
export function Colofon() {
  const c = copy.colofon
  return (
    <div className="colofon">
      {c.heading ? <p className="colofon__heading">{c.heading}</p> : null}
      <p>{c.made}</p>
      <p>{c.credits}</p>
      <p data-cycle={CURRENT_CYCLE}>{c.cycle.replace('{cycle}', String(CURRENT_CYCLE))}</p>
      {c.contribution ? <p>{c.contribution}</p> : null}
      {c.email ? <p>{c.email}</p> : null}
      <p>
        <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer">
          {c.linkedinLabel}
        </a>
      </p>
    </div>
  )
}
