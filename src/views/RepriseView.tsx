import { CanonLines } from '../components/CanonLines'

// After the dissolution: the first lines of fragment 1, in italics.
export function RepriseView({ lines }: { lines: readonly string[] }) {
  return (
    <div className="reprise" data-canon="reprise">
      <CanonLines lines={lines} />
    </div>
  )
}
