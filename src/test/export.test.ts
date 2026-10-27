import { describe, expect, it} from 'vitest'
import { createVault} from '../lib/domain'
import { buildDemoVault, hasDemoData} from '../lib/demo'
import { buildMarkdownExport, buildPlainExport} from '../lib/export'
import { computeGraphLayout} from '../lib/graph'

describe('明文导出', () => {
it('示例数据能完整导出为 JSON 与 Markdown', () => {
const vault = buildDemoVault(createVault())
const plain = buildPlainExport(vault)
expect(plain.format).toBe('xinlu-plain-export')
expect(plain.anchors).toHaveLength(6)
expect(plain.heartlines).toHaveLength(4)
expect(plain.persons).toContain('外婆')
expect(plain.anchors[0].summary).toContain('手擀面')

const markdown = buildMarkdownExport(vault)
expect(markdown).toContain('# 心络 · 我的记忆')
expect(markdown).toContain('高考出分那天')
expect(markdown).toContain('')
})

it('空资料导出不报错', () => {
const plain = buildPlainExport(createVault())
expect(plain.anchors).toHaveLength(0)
expect(buildMarkdownExport(createVault())).toContain('共 0 枚心锚')
})
})

describe('示例数据', () => {
it('载入后有 6 枚心锚、4 条心线且图谱连通', () => {
const vault = buildDemoVault(createVault())
expect(hasDemoData(vault)).toBe(true)
expect(vault.anchors.filter((anchor) => anchor.status === 'active')).toHaveLength(6)
expect(vault.heartlines).toHaveLength(4)
expect(vault.persons.map((person) => person.name)).toContain('外婆')
})
})

describe('图谱布局', () => {
it('结果确定、坐标在画布内', () => {
const nodes = [
{ id: 'a', weight: 2},
{ id: 'b', weight: 1},
{ id: 'c', weight: 1},
{ id: 'd', weight: 0},
]
const edges = [
{ a: 'a', b: 'b'},
{ a: 'a', b: 'c'},
]
const first = computeGraphLayout(nodes, edges, 840, 620)
const second = computeGraphLayout(nodes, edges, 840, 620)
expect(first.size).toBe(4)
for (const point of first.values()) {
expect(point.x).toBeGreaterThanOrEqual(56)
expect(point.x).toBeLessThanOrEqual(840 - 56)
expect(point.y).toBeGreaterThanOrEqual(56)
expect(point.y).toBeLessThanOrEqual(620 - 56)
}
expect([...first.entries()]).toEqual([...second.entries()])
})

it('单节点居中、空输入返回空', () => {
expect(computeGraphLayout([], []).size).toBe(0)
const single = computeGraphLayout([{ id: 'x', weight: 0}], [], 800, 600)
expect(single.get('x')).toEqual({ x: 400, y: 300})
})
})
