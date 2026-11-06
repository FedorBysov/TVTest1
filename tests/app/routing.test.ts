import { describe, expect, it } from 'vitest'
import { routeFromHash, routeHref } from '../../src/app/routing'

describe('hash routing for a GitHub Pages project path', () => {
  it('recognizes every requested section without needing server rewrites', () => {
    expect((['overview', 'console', 'scenarios', 'session', 'help'] as const).map(routeHref)).toEqual([
      '#/overview', '#/console', '#/scenarios', '#/session', '#/help',
    ])
    expect(routeFromHash('#/scenarios')).toBe('scenarios')
    expect(routeFromHash('#/session')).toBe('session')
  })

  it('returns to overview for an absent or unknown route', () => {
    expect(routeFromHash('')).toBe('overview')
    expect(routeFromHash('#/unknown')).toBe('overview')
    expect(routeFromHash('#/console?zone=systems')).toBe('console')
  })
})
