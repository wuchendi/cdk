/** SPAs served from one origin, longest prefix first. */
const SPAS = ['/shop', '/admin']

/** The `index.html` that answers a client route. */
export function spaIndex(path: string) {
  const prefix = SPAS.find((p) => path === p || path.startsWith(`${p}/`))
  return `${prefix ?? ''}/index.html`
}
