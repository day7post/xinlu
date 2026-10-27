export interface GraphNodeInput {
  id: string
  weight: number
}

export interface GraphEdgeInput {
  a: string
  b: string
}

export interface GraphPoint {
  x: number
  y: number
}

function hashSeed(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

/**
 * Deterministic force-directed layout (Fruchterman-Reingold).
 * Same input always produces the same layout, so the graph does not
 * jump around between visits. Pure function: safe to unit test.
 */
export function computeGraphLayout(
  nodes: GraphNodeInput[],
  edges: GraphEdgeInput[],
  width = 840,
  height = 620,
  iterations = 320,
): Map<string, GraphPoint> {
  const result = new Map<string, GraphPoint>()
  if (nodes.length === 0) return result
  if (nodes.length === 1) {
    result.set(nodes[0].id, { x: width / 2, y: height / 2 })
    return result
  }

  const padding = 56
  const centerX = width / 2
  const centerY = height / 2
  const positions = new Map<string, { x: number; y: number }>()
  const sorted = [...nodes].sort((left, right) => left.id.localeCompare(right.id))
  sorted.forEach((node, index) => {
    const angle = (index / sorted.length) * Math.PI * 2 + hashSeed(node.id) * 0.6
    const radius = Math.min(width, height) * (0.22 + hashSeed(`${node.id}:r`) * 0.14)
    positions.set(node.id, {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius * (height / width),
    })
  })

  const validEdges = edges.filter((edge) => positions.has(edge.a) && positions.has(edge.b) && edge.a !== edge.b)
  const area = width * height
  const k = Math.sqrt(area / nodes.length) * 0.72
  let temperature = Math.min(width, height) / 8

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const displacement = new Map<string, { x: number; y: number }>()
    for (const node of sorted) displacement.set(node.id, { x: 0, y: 0 })

    // Repulsion between every pair of nodes.
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const a = positions.get(sorted[i].id)!
        const b = positions.get(sorted[j].id)!
        let dx = a.x - b.x
        let dy = a.y - b.y
        let distance = Math.sqrt(dx * dx + dy * dy)
        if (distance < 0.01) {
          dx = hashSeed(`${sorted[i].id}:${sorted[j].id}`) - 0.5
          dy = hashSeed(`${sorted[j].id}:${sorted[i].id}`) - 0.5
          distance = Math.max(0.01, Math.sqrt(dx * dx + dy * dy))
        }
        const force = (k * k) / distance
        const fx = (dx / distance) * force
        const fy = (dy / distance) * force
        const da = displacement.get(sorted[i].id)!
        const db = displacement.get(sorted[j].id)!
        da.x += fx
        da.y += fy
        db.x -= fx
        db.y -= fy
      }
    }

    // Attraction along edges.
    for (const edge of validEdges) {
      const a = positions.get(edge.a)!
      const b = positions.get(edge.b)!
      const dx = a.x - b.x
      const dy = a.y - b.y
      const distance = Math.max(0.01, Math.sqrt(dx * dx + dy * dy))
      const force = (distance * distance) / k
      const fx = (dx / distance) * force
      const fy = (dy / distance) * force
      const da = displacement.get(edge.a)!
      const db = displacement.get(edge.b)!
      da.x -= fx
      da.y -= fy
      db.x += fx
      db.y += fy
    }

    // Apply with cooling, plus a gentle pull to the centre.
    for (const node of sorted) {
      const point = positions.get(node.id)!
      const disp = displacement.get(node.id)!
      disp.x += (centerX - point.x) * 0.012
      disp.y += (centerY - point.y) * 0.012
      const length = Math.max(0.01, Math.sqrt(disp.x * disp.x + disp.y * disp.y))
      const step = Math.min(length, temperature)
      point.x += (disp.x / length) * step
      point.y += (disp.y / length) * step
      point.x = Math.min(width - padding, Math.max(padding, point.x))
      point.y = Math.min(height - padding, Math.max(padding, point.y))
    }
    temperature *= 1 - iteration / iterations * 0.9 + 0.1 / iterations
    if (temperature < 0.5) temperature = 0.5
  }

  for (const node of nodes) {
    const point = positions.get(node.id)
    if (point) result.set(node.id, { x: Math.round(point.x), y: Math.round(point.y) })
  }
  return result
}
