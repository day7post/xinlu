import type { GraphEdgeInput, GraphNodeInput, GraphPoint } from './graph'

export interface GanglionLayout {
  /** Absolute position of every laid-out node, in viewBox coordinates. */
  points: Map<string, GraphPoint>
  /** Tree (branch) edges: child id -> parent id. Non-tree edges are cross-links. */
  parentOf: Map<string, string>
  /** Depth from the component root; the root ("核") has depth 0. */
  depthOf: Map<string, number>
  /** Root of the largest component, shown as the central nucleus. */
  rootId: string | null
  /** Centre of the largest component, used to draw the faint ring guides. */
  center: GraphPoint
  /** Ring radii of the largest component, outermost last. */
  rings: number[]
}

function hashSeed(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

interface ComponentTree {
  root: string
  parentOf: Map<string, string>
  depthOf: Map<string, number>
  childrenOf: Map<string, string[]>
  maxDepth: number
}

/**
 * Deterministic "ganglion" layout: every connected component becomes a
 * branching cluster — the most-connected anchor is the nucleus and the
 * rest grow outward along BFS branches, like veins on paper （络）.
 * Pure function with no randomness beyond id hashes: same input, same map.
 */
export function computeGanglionLayout(
  nodes: GraphNodeInput[],
  edges: GraphEdgeInput[],
  width = 840,
  height = 620,
): GanglionLayout {
  const points = new Map<string, GraphPoint>()
  const parentOf = new Map<string, string>()
  const depthOf = new Map<string, number>()
  const center = { x: width / 2, y: height / 2 }
  const empty: GanglionLayout = { points, parentOf, depthOf, rootId: null, center, rings: [] }
  if (nodes.length === 0) return empty

  const ids = new Set(nodes.map((node) => node.id))
  const weight = new Map(nodes.map((node) => [node.id, node.weight]))
  const adjacency = new Map<string, string[]>()
  for (const id of ids) adjacency.set(id, [])
  const seenEdges = new Set<string>()
  for (const edge of edges) {
    if (!ids.has(edge.a) || !ids.has(edge.b) || edge.a === edge.b) continue
    const key = edge.a < edge.b ? `${edge.a}|${edge.b}` : `${edge.b}|${edge.a}`
    if (seenEdges.has(key)) continue
    seenEdges.add(key)
    adjacency.get(edge.a)!.push(edge.b)
    adjacency.get(edge.b)!.push(edge.a)
  }
  // Deterministic neighbour order: heavier (more connected) branches first.
  for (const list of adjacency.values()) {
    list.sort((a, b) => (weight.get(b) ?? 0) - (weight.get(a) ?? 0) || a.localeCompare(b))
  }

  // Connected components, in deterministic order.
  const visited = new Set<string>()
  const components: string[][] = []
  for (const id of [...ids].sort((a, b) => a.localeCompare(b))) {
    if (visited.has(id)) continue
    const component: string[] = []
    const queue = [id]
    visited.add(id)
    while (queue.length > 0) {
      const current = queue.shift()!
      component.push(current)
      for (const next of adjacency.get(current)!) {
        if (!visited.has(next)) {
          visited.add(next)
          queue.push(next)
        }
      }
    }
    components.push(component)
  }
  components.sort((a, b) => {
    const weightOf = (component: string[]) =>
      Math.max(...component.map((id) => weight.get(id) ?? 0))
    return b.length - a.length || weightOf(b) - weightOf(a) || a[0].localeCompare(b[0])
  })

  const buildTree = (component: string[]): ComponentTree => {
    const root = [...component].sort(
      (a, b) => (weight.get(b) ?? 0) - (weight.get(a) ?? 0) || a.localeCompare(b),
    )[0]
    const treeParent = new Map<string, string>()
    const treeDepth = new Map<string, number>([[root, 0]])
    const childrenOf = new Map<string, string[]>()
    const queue = [root]
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const next of adjacency.get(current)!) {
        if (next === root || treeDepth.has(next)) continue
        treeDepth.set(next, (treeDepth.get(current) ?? 0) + 1)
        treeParent.set(next, current)
        const siblings = childrenOf.get(current) ?? []
        siblings.push(next)
        childrenOf.set(current, siblings)
        queue.push(next)
      }
    }
    const maxDepth = Math.max(0, ...treeDepth.values())
    return { root, parentOf: treeParent, depthOf: treeDepth, childrenOf, maxDepth }
  }

  const leafCount = (tree: ComponentTree, id: string): number => {
    const children = tree.childrenOf.get(id) ?? []
    if (children.length === 0) return 1
    return children.reduce((sum, child) => sum + leafCount(tree, child), 0)
  }

  const placeTree = (
    tree: ComponentTree,
    origin: GraphPoint,
    maxRadius: number,
    startAngle: number,
    sweep: number,
  ): number[] => {
    const ringGap = tree.maxDepth > 0 ? maxRadius / tree.maxDepth : 0
    const rings: number[] = []
    for (let depth = 1; depth <= tree.maxDepth; depth += 1) rings.push(ringGap * depth)
    const place = (id: string, from: number, to: number) => {
      const depth = tree.depthOf.get(id) ?? 0
      const angle = (from + to) / 2 + (hashSeed(`${id}:a`) - 0.5) * (to - from) * 0.18
      const radius = depth * ringGap * (0.92 + hashSeed(`${id}:r`) * 0.16)
      points.set(id, {
        x: Math.round(origin.x + Math.cos(angle) * radius),
        y: Math.round(origin.y + Math.sin(angle) * radius),
      })
      const children = tree.childrenOf.get(id) ?? []
      const totalLeaves = children.reduce((sum, child) => sum + leafCount(tree, child), 0)
      let cursor = from
      for (const child of children) {
        const share = ((to - from) * leafCount(tree, child)) / Math.max(1, totalLeaves)
        place(child, cursor, cursor + share)
        cursor += share
      }
    }
    points.set(tree.root, { x: Math.round(origin.x), y: Math.round(origin.y) })
    const rootChildren = tree.childrenOf.get(tree.root) ?? []
    const totalLeaves = rootChildren.reduce((sum, child) => sum + leafCount(tree, child), 0)
    let cursor = startAngle
    for (const child of rootChildren) {
      const share = (sweep * leafCount(tree, child)) / Math.max(1, totalLeaves)
      place(child, cursor, cursor + share)
      cursor += share
    }
    for (const [child, parent] of tree.parentOf) parentOf.set(child, parent)
    for (const [id, depth] of tree.depthOf) depthOf.set(id, depth)
    return rings
  }

  const outerRadius = Math.min(width, height) / 2
  const mainComponent = components[0]
  const mainTree = buildTree(mainComponent)
  const mainIsSingle = mainComponent.length === 1
  const mainRings = mainIsSingle
    ? []
    : placeTree(mainTree, center, outerRadius - 96, -Math.PI / 2, Math.PI * 2)

  // Smaller clusters orbit the main one; isolated anchors rest on an outer ring.
  const satellites = components.slice(1).filter((component) => component.length > 1)
  satellites.forEach((component, index) => {
    const tree = buildTree(component)
    const angle = -Math.PI / 2 + (index + 1) * 2.399963 // golden angle keeps clusters apart
    const distance = outerRadius * 0.66
    const origin = {
      x: Math.min(width - 110, Math.max(110, center.x + Math.cos(angle) * distance)),
      y: Math.min(height - 110, Math.max(110, center.y + Math.sin(angle) * distance * 0.82)),
    }
    placeTree(tree, origin, Math.min(96, outerRadius * 0.34), angle + Math.PI / 2, Math.PI * 2)
  })

  const isolated = components.flat().filter((id) => (adjacency.get(id) ?? []).length === 0)
  const ringRadius = outerRadius - 40
  isolated.forEach((id, index) => {
    if (points.has(id)) return
    const angle = -Math.PI / 2 + (index / Math.max(1, isolated.length)) * Math.PI * 2 + hashSeed(id) * 0.3
    points.set(id, {
      x: Math.round(center.x + Math.cos(angle) * ringRadius),
      y: Math.round(center.y + Math.sin(angle) * ringRadius * (height / width)),
    })
    depthOf.set(id, 99)
  })
  if (mainIsSingle && isolated.length === 0) {
    points.set(mainTree.root, { x: Math.round(center.x), y: Math.round(center.y) })
    depthOf.set(mainTree.root, 0)
  }

  return { points, parentOf, depthOf, rootId: mainTree.root, center, rings: mainRings }
}
