import { describe, it, expect, vi } from 'vitest'
import { computeMarqueeHits } from '@/components/FolderTree'

function makeEl(
  pathStr: string,
  rect: { left: number; top: number; right: number; bottom: number }
) {
  const el = document.createElement('div')
  el.setAttribute('data-path', pathStr)
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
    width: rect.right - rect.left, height: rect.bottom - rect.top,
    x: rect.left, y: rect.top, toJSON: () => {},
  } as DOMRect)
  return el
}

function makeContainer(children: HTMLElement[]) {
  const container = document.createElement('div') as HTMLDivElement
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, right: 400, bottom: 600,
    width: 400, height: 600, x: 0, y: 0, toJSON: () => {},
  } as DOMRect)
  children.forEach(c => container.appendChild(c))
  return container
}

describe('computeMarqueeHits', () => {
  it('returns paths of elements that intersect the marquee', () => {
    // el1 sits at relative y 10–30, el2 at y 40–60
    const container = makeContainer([
      makeEl('0', { left: 10, top: 10, right: 200, bottom: 30 }),
      makeEl('1', { left: 10, top: 40, right: 200, bottom: 60 }),
    ])
    const rect = container.getBoundingClientRect()
    // Marquee covers y 0–35 — hits el1 only
    const hits = computeMarqueeHits({ x1: 0, y1: 0, x2: 300, y2: 35 }, container, rect)
    expect(hits).toEqual(['0'])
  })

  it('returns multiple paths when marquee covers several elements', () => {
    const container = makeContainer([
      makeEl('0', { left: 10, top: 10, right: 200, bottom: 30 }),
      makeEl('1', { left: 10, top: 40, right: 200, bottom: 60 }),
    ])
    const rect = container.getBoundingClientRect()
    const hits = computeMarqueeHits({ x1: 0, y1: 0, x2: 300, y2: 65 }, container, rect)
    expect(hits).toEqual(['0', '1'])
  })

  it('returns empty array when marquee misses all elements', () => {
    const container = makeContainer([
      makeEl('0', { left: 10, top: 100, right: 200, bottom: 130 }),
    ])
    const rect = container.getBoundingClientRect()
    const hits = computeMarqueeHits({ x1: 0, y1: 0, x2: 50, y2: 5 }, container, rect)
    expect(hits).toEqual([])
  })
})
