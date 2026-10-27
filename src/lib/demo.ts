import type { AnchorContent, HeartlineType, VaultData } from '../types'
import {
  commitAnchor,
  createDraftInVault,
  createHeartlineInVault,
  getActiveAnchorItems,
  updateAnchorContent,
  upsertPersons,
} from './domain'
import { createId } from './id'

export const DEMO_TAG = '示例'

export function hasDemoData(data: VaultData): boolean {
  return getActiveAnchorItems(data).some((item) => item.revision.content.tags.includes(DEMO_TAG))
}

interface DemoAnchorSpec {
  key: string
  content: AnchorContent
}

function emotion(label: string, intensity?: number, note?: string) {
  return { id: createId('emotion'), label, intensity, note }
}

function content(partial: Partial<AnchorContent>): AnchorContent {
  return {
    form: 'note',
    summary: '',
    text: '',
    memoryTime: { precision: 'unknown' },
    tags: [DEMO_TAG],
    emotionsThen: [],
    emotionsNow: [],
    mediaIds: [],
    ...partial,
  }
}

const DEMO_ANCHORS: DemoAnchorSpec[] = [
  {
    key: 'score',
    content: content({
      summary: '高考出分那天',
      text: '查分页面刷了三次才打开。看到分数的时候手有点抖，先截了图，才给家里打电话。',
      memoryTime: { precision: 'month', month: '2026-06' },
      tags: [DEMO_TAG, '转折'],
      emotionsThen: [emotion('期待', 4), emotion('害怕', 3)],
      emotionsNow: [emotion('释然', 4)],
    }),
  },
  {
    key: 'train',
    content: content({
      summary: '第一次独自坐高铁去上大学',
      text: '妈妈在站台上挥手，车开出去很远还能看见。行李箱里塞了她包的饺子，到学校那晚就吃完了。',
      memoryTime: { precision: 'month', month: '2026-09' },
      tags: [DEMO_TAG, '离家'],
      emotionsThen: [emotion('孤独', 3), emotion('期待', 4)],
      emotionsNow: [emotion('平静', 4)],
    }),
  },
  {
    key: 'dorm',
    content: content({
      summary: '和室友的第一次夜聊',
      text: '熄灯之后从高中聊到想学的专业，聊到凌晨一点多。忽然觉得，接下来四年不会太难熬。',
      memoryTime: { precision: 'month', month: '2026-09' },
      tags: [DEMO_TAG, '朋友'],
      emotionsThen: [emotion('开心', 4)],
      emotionsNow: [emotion('感激', 3)],
    }),
  },
  {
    key: 'parade',
    content: content({
      form: 'scene',
      summary: '军训结营那天的合影',
      text: '站完最后一遍军姿，全班在操场边挤着拍了一张合影。晒黑了一圈，笑得倒是很整齐。',
      memoryTime: { precision: 'month', month: '2026-10' },
      tags: [DEMO_TAG, '集体'],
      emotionsThen: [emotion('开心', 5)],
      emotionsNow: [emotion('开心', 4)],
    }),
  },
  {
    key: 'noodles',
    content: content({
      summary: '小时候外婆做的手擀面',
      text: '外婆擀面的时候总哼一段听不懂的调子。面下锅，我就搬个小板凳坐在灶台边等第一碗。',
      memoryTime: { precision: 'year', year: 2016 },
      tags: [DEMO_TAG, '家人'],
      emotionsThen: [emotion('开心', 5)],
      emotionsNow: [emotion('感激', 5), emotion('孤独', 2)],
    }),
  },
  {
    key: 'midautumn',
    content: content({
      summary: '中秋夜在宿舍想起那碗面',
      text: '食堂的月饼吃了一半，忽然想起外婆的面。给她打了个视频，她说等放假回来再给我做。',
      memoryTime: { precision: 'month', month: '2026-10' },
      tags: [DEMO_TAG, '家人'],
      emotionsThen: [emotion('孤独', 3)],
      emotionsNow: [emotion('平静', 4)],
    }),
  },
]

const DEMO_LINES: {
  a: string
  b: string
  type: HeartlineType
  note: string
  persons?: string[]
}[] = [
  { a: 'score', b: 'train', type: 'cause', note: '那个分数，决定了这趟车开往哪座城市。' },
  { a: 'train', b: 'dorm', type: 'time', note: '同一个九月，先离家，再安顿下来。' },
  { a: 'noodles', b: 'midautumn', type: 'person', note: '一碗面，隔了十年又想起来。', persons: ['外婆'] },
  { a: 'parade', b: 'midautumn', type: 'time', note: '同在十月，一个热闹，一个安静。' },
]

/** Builds a new vault with fictional demo anchors and lines appended. Pure: input is not mutated. */
export function buildDemoVault(current: VaultData): VaultData {
  let vault = current
  const ids = new Map<string, string>()
  for (const spec of DEMO_ANCHORS) {
    const draft = createDraftInVault(vault)
    vault = draft.vault
    vault = updateAnchorContent(vault, draft.anchorId, () => spec.content)
    const committed = commitAnchor(vault, draft.anchorId, 'session')
    vault = committed.vault
    ids.set(spec.key, draft.anchorId)
  }
  for (const line of DEMO_LINES) {
    const anchorAId = ids.get(line.a)
    const anchorBId = ids.get(line.b)
    if (!anchorAId || !anchorBId) continue
    let personIds: string[] = []
    if (line.persons && line.persons.length > 0) {
      const upserted = upsertPersons(vault, line.persons)
      vault = upserted.vault
      personIds = upserted.personIds
    }
    const created = createHeartlineInVault(vault, {
      anchorAId,
      anchorBId,
      type: line.type,
      personIds,
      note: line.note,
    })
    vault = created.vault
  }
  return vault
}
