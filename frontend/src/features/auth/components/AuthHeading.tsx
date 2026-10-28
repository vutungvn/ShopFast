type AuthHeadingProps = {
  title: string
  description: string
}

export function AuthHeading({ title, description }: AuthHeadingProps) {
  return (
    <header>
      {/* React 19 tự đưa <title> lên <head> */}
      <title>{`${title} · ShopFast`}</title>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">{title}</h1>
      <p className="mt-1.5 text-slate-500">{description}</p>
    </header>
  )
}
