// Renders canon lines one per block, character-exact. Every line carries
// data-canon-line so tests can compare the DOM against the source.
export function CanonLines({ lines, className }: { lines: readonly string[]; className?: string }) {
  return (
    <>
      {lines.map((line, i) => (
        <p className={className ? `canon-line ${className}` : 'canon-line'} data-canon-line key={i}>
          {line}
        </p>
      ))}
    </>
  )
}
