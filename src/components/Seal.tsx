// The seal (sello-carta): a brutalist, imperfectly stamped solid rectangle
// with the Roman numeral in negative. The numeral is real text in Archivo.
// Fragments 1–21 carry I–XXI; fragment 22 carries 0. The lone seal at the
// end of the journey carries no numeral. A blind impression (the tally)
// is the same shape without ink or numeral.
export function Seal({ numeral, blind = false }: { numeral?: string; blind?: boolean }) {
  return (
    <span className={blind ? 'seal seal--blind' : 'seal'} data-blind={blind ? '' : undefined}>
      <span className="seal__ink" aria-hidden="true" />
      {numeral !== undefined && !blind ? (
        <span className="seal__numeral" data-seal>
          {numeral}
        </span>
      ) : null}
    </span>
  )
}
