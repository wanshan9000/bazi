import { defineTool } from '@deepseek-ai/dsh-tools'
import { OPTIONAL_BIRTH_PARAMS, chartFromArgs } from '../birth.js'

// analyzeFengshui 的 layout 只认固定英文键（living/master/kitchen/study/door/bedDir），
// 房间只有这四种固定角色；把用户报的中文房间名映射到对应键，未识别的名字会被忽略。
const ROOM_NAME_TO_KEY = { 客厅: 'living', 主卧: 'master', 卧室: 'master', 厨房: 'kitchen', 书房: 'study' }

export function makeFengshuiTool(E) {
  return defineTool({
    name: 'fengshui',
    description: '八宅风水 + 五行房间布局分析。用户描述户型（大门朝向、各房间方位）并问风水、财位、煞气、摆件时调用。',
    parameters: {
      door: { type: 'string', required: true, description: '大门朝向：东/南/西/北/东南/东北/西南/西北' },
      rooms: { type: 'array', items: { type: 'object', properties: { name: { type: 'string', required: true }, dir: { type: 'string', required: true } }, additionalProperties: false }, description: '房间列表，如 [{name:"主卧",dir:"北"}]。房间角色限客厅/主卧/卧室/厨房/书房，其余名字会被忽略' },
      ...OPTIONAL_BIRTH_PARAMS,
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) {
      const layout = { door: args.door }
      for (const r of args.rooms || []) {
        const key = ROOM_NAME_TO_KEY[r.name]
        if (key) layout[key] = r.dir
      }
      const chart = args.year && args.month && args.day && args.gender ? chartFromArgs(E, args) : null
      const res = E.analyzeFengshui({ layout, birthInfo: chart })
      const segs = [`【风水布局分析】门向${args.door}`, `喜用神：${res.favorable.join('、')}｜忌神：${res.avoid.join('、')}`]
      if (res.luckyDirs?.length) segs.push(`四吉方：${res.luckyDirs.join('、')}`)
      if (res.rooms?.length) { segs.push('', '【逐空间分析】'); for (const r of res.rooms) segs.push(`${r.name}（${r.dir}，五行${r.wuxing}）：${r.score}分。${r.tips.join('；')}`) }
      if (res.overall) segs.push('', `【总评】${res.overall}`)
      return segs.join('\n')
    },
  })
}
