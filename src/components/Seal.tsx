// The seal (sello-carta): a brutalist, imperfectly stamped solid rectangle
// with the Roman numeral in negative. The numeral is real text in Archivo.
// Fragments 1–21 carry I–XXI; fragment 22 carries 0.
export function Seal({ numeral }: { numeral: string }) {
  return (
    <span className="seal">
      <span className="seal__ink" aria-hidden="true" />
      <span className="seal__numeral" data-seal>
        {numeral}
      </span>
    </span>
  )
}
