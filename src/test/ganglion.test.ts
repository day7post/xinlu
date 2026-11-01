import { describe, expect, it } from 'vitest'
import { computeGanglionLayout } from '../lib/ganglion'

const nodes = (...entries: Array<[string, number]>) =>
  entries.map(([id, weight]) => ({ id, weight }))
const edges = (...pairs: Array<[string, string]>) => pairs.map(([a, b]) => ({ a, b }))

describe('脉络布局 computeGanglionLayout', () => {
  it('空输入返回空布局', () => {
    const layout = computeGanglionLayout([], [])
    expect(layout.points.size).toBe(0)
    expect(layout.rootId).toBeNull()
  })

  it('连接最多的心锚成为中央核并位于中心', () => {
    const layout = computeGanglionLayout(
      nodes(['hub', 3], ['a', 1], ['b', 1], ['c', 1]),
      edges(['hub', 'a'], ['hub', 'b'], ['hub', 'c']),
      840,
      620,
    )
    expect(layout.rootId).toBe('hub')
    expect(layout.points.get('hub')).toEqual({ x: 420, y: 310 })
    expect(layout.depthOf.get('a')).toBe(1)
    expect(layout.parentOf.get('b')).toBe('hub')
  })

  it('链式关系从核向两侧分叉生长，树边数等于节点数减一', () => {
    const layout = computeGanglionLayout(
      nodes(['n1', 1], ['n2', 2], ['n3', 2], ['n4', 1]),
      edges(['n1', 'n2'], ['n2', 'n3'], ['n3', 'n4']),
    )
    expect(layout.rootId).toBe('n2')
    expect(layout.parentOf.size).toBe(3)
    expect(layout.parentOf.get('n4')).toBe('n3')
    expect(layout.depthOf.get('n4')).toBe(2)
    expect(Math.max(...layout.depthOf.values())).toBe(2)
  })

  it('所有节点都有坐标且落在画布内，同一输入两次结果一致', () => {
    const input = nodes(['x', 2], ['y', 2], ['z', 1], ['w', 0], ['v', 1])
    const inputEdges = edges(['x', 'y'], ['y', 'z'], ['x', 'v'])
    const first = computeGanglionLayout(input, inputEdges, 840, 620)
    const second = computeGanglionLayout(input, inputEdges, 840, 620)
    expect(first.points.size).toBe(5)
    for (const point of first.points.values()) {
      expect(point.x).toBeGreaterThanOrEqual(0)
      expect(point.x).toBeLessThanOrEqual(840)
      expect(point.y).toBeGreaterThanOrEqual(0)
      expect(point.y).toBeLessThanOrEqual(620)
    }
    expect([...first.points.entries()]).toEqual([...second.points.entries()])
  })

  it('孤立心锚放在外圈且没有父节点', () => {
    const layout = computeGanglionLayout(
      nodes(['a', 1], ['b', 1], ['solo', 0]),
      edges(['a', 'b']),
    )
    expect(layout.points.has('solo')).toBe(true)
    expect(layout.parentOf.has('solo')).toBe(false)
    expect(layout.depthOf.get('solo')).toBe(99)
  })

  it('第二个连通分量自成一簇，不挂到主核上', () => {
    const layout = computeGanglionLayout(
      nodes(['m1', 2], ['m2', 1], ['m3', 1], ['s1', 1], ['s2', 1]),
      edges(['m1', 'm2'], ['m1', 'm3'], ['s1', 's2']),
    )
    expect(layout.rootId).toBe('m1')
    expect(layout.parentOf.get('s2')).toBe('s1')
    expect(layout.points.size).toBe(5)
  })
})
