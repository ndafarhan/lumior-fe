import { Link } from 'react-router'

export function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 px-3 text-lg font-semibold">
      <img src="/favicon.svg" alt="" className="size-7" />
      Lumior
    </Link>
  )
}
