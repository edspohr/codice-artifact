import { CanonLines } from '../components/CanonLines'

export function EpigraphView({ lines }: { lines: readonly string[] }) {
  return (
    <div className="epigraph" data-canon="epigraph">
      <CanonLines lines={lines} />
    </div>
  )
}
