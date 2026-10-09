import { canon } from '../content/canon'
import signatureUrl from '../assets/signature.svg'

// The author's real signature, traced once from paper (scripts/trace-signature.mjs).
// Rendered as an image whose accessible name is the author's name from the canon.
export function Signature({ className }: { className?: string }) {
  return <img className={className} src={signatureUrl} alt={canon.author} draggable={false} />
}
