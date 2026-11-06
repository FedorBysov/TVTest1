export type Route = 'overview' | 'console' | 'scenarios' | 'session' | 'help'

const routes: readonly Route[] = ['overview', 'console', 'scenarios', 'session', 'help']

export function routeFromHash(hash: string): Route {
  const value = hash.replace(/^#\/?/, '').split('?')[0]
  return routes.find((route) => route === value) ?? 'overview'
}

export function routeHref(route: Route): string {
  return `#/${route}`
}
