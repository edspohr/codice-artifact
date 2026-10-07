import type { Movement } from '../content/canon'

// The movement title, in Archivo, uppercased by CSS only. Each word is
// wrapped so the per-word mix (Tierra, Cielo) can be styled; the DOM text
// stays exactly the canon title, spaces included.
export function MovementTitle({ movement }: { movement: Movement }) {
  const words = movement.title.split(' ')
  return (
    <h1 className="movement-title" data-canon="movement-title">
      {words.map((word, i) => (
        <span key={i}>
          {i > 0 ? ' ' : null}
          <span className="movement-title__word">{word}</span>
        </span>
      ))}
    </h1>
  )
}
