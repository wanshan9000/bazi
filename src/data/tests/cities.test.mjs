import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CITY_COUNT, PROVINCES, findCity } from '../cities.js'

test('出生地城市库覆盖省级地区与地级市、自治州、地区', () => {
  assert.equal(PROVINCES.length, 34)
  assert.ok(CITY_COUNT >= 360)
  for (const [province, city] of [['河北', '保定'], ['四川', '阿坝'], ['贵州', '黔东南'], ['新疆', '伊犁']]) {
    const place = findCity(province, city)
    assert.ok(place, `${province}应包含${city}`)
    assert.equal(typeof place.lon, 'number')
  }
})
