// A lámina is decorative: empty alt, never a caption, never explained.
export function Lamina({ src, className }: { src: string; className: string }) {
  return <img className={className} src={src} alt="" decoding="async" draggable={false} />
}
