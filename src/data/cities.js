/**
 * 中国主要城市经纬度（真太阳时换算用）
 * lon = 东经（度），lat = 北纬（度）
 * 数据为城市市政府/主城区所在经纬度（近似值，供命理换算足够）
 */

export const PROVINCES = [
  {
    name: '北京', cities: [
      { name: '北京', lon: 116.41, lat: 39.9 },
    ],
  },
  {
    name: '上海', cities: [
      { name: '上海', lon: 121.47, lat: 31.23 },
    ],
  },
  {
    name: '天津', cities: [
      { name: '天津', lon: 117.2, lat: 39.13 },
    ],
  },
  {
    name: '重庆', cities: [
      { name: '重庆', lon: 106.55, lat: 29.56 },
    ],
  },
  {
    name: '河北', cities: [
      { name: '石家庄', lon: 114.51, lat: 38.04 },
      { name: '唐山', lon: 118.18, lat: 39.63 },
      { name: '保定', lon: 115.46, lat: 38.87 },
      { name: '邯郸', lon: 114.54, lat: 36.63 },
    ],
  },
  {
    name: '山西', cities: [
      { name: '太原', lon: 112.55, lat: 37.87 },
      { name: '大同', lon: 113.3, lat: 40.08 },
      { name: '运城', lon: 111.0, lat: 35.03 },
    ],
  },
  {
    name: '内蒙古', cities: [
      { name: '呼和浩特', lon: 111.75, lat: 40.84 },
      { name: '包头', lon: 109.84, lat: 40.66 },
      { name: '赤峰', lon: 118.89, lat: 42.26 },
    ],
  },
  {
    name: '辽宁', cities: [
      { name: '沈阳', lon: 123.43, lat: 41.8 },
      { name: '大连', lon: 121.61, lat: 38.91 },
      { name: '鞍山', lon: 122.99, lat: 41.11 },
    ],
  },
  {
    name: '吉林', cities: [
      { name: '长春', lon: 125.32, lat: 43.9 },
      { name: '吉林市', lon: 126.55, lat: 43.84 },
      { name: '延吉', lon: 129.51, lat: 42.9 },
    ],
  },
  {
    name: '黑龙江', cities: [
      { name: '哈尔滨', lon: 126.53, lat: 45.8 },
      { name: '齐齐哈尔', lon: 123.95, lat: 47.34 },
      { name: '大庆', lon: 125.1, lat: 46.59 },
    ],
  },
  {
    name: '江苏', cities: [
      { name: '南京', lon: 118.78, lat: 32.04 },
      { name: '苏州', lon: 120.58, lat: 31.3 },
      { name: '无锡', lon: 120.3, lat: 31.57 },
      { name: '徐州', lon: 117.28, lat: 34.26 },
      { name: '南通', lon: 120.89, lat: 32.0 },
    ],
  },
  {
    name: '浙江', cities: [
      { name: '杭州', lon: 120.15, lat: 30.28 },
      { name: '宁波', lon: 121.55, lat: 29.87 },
      { name: '温州', lon: 120.7, lat: 28.0 },
      { name: '金华', lon: 119.65, lat: 29.08 },
      { name: '嘉兴', lon: 120.76, lat: 30.75 },
    ],
  },
  {
    name: '安徽', cities: [
      { name: '合肥', lon: 117.28, lat: 31.86 },
      { name: '芜湖', lon: 118.38, lat: 31.33 },
      { name: '安庆', lon: 117.05, lat: 30.53 },
      { name: '阜阳', lon: 115.81, lat: 32.89 },
    ],
  },
  {
    name: '福建', cities: [
      { name: '福州', lon: 119.3, lat: 26.08 },
      { name: '厦门', lon: 118.09, lat: 24.48 },
      { name: '泉州', lon: 118.67, lat: 24.87 },
      { name: '漳州', lon: 117.65, lat: 24.51 },
    ],
  },
  {
    name: '江西', cities: [
      { name: '南昌', lon: 115.86, lat: 28.68 },
      { name: '赣州', lon: 114.93, lat: 25.85 },
      { name: '九江', lon: 115.97, lat: 29.71 },
    ],
  },
  {
    name: '山东', cities: [
      { name: '济南', lon: 117.12, lat: 36.65 },
      { name: '青岛', lon: 120.38, lat: 36.07 },
      { name: '烟台', lon: 121.44, lat: 37.46 },
      { name: '临沂', lon: 118.35, lat: 35.05 },
      { name: '潍坊', lon: 119.16, lat: 36.71 },
    ],
  },
  {
    name: '河南', cities: [
      { name: '郑州', lon: 113.62, lat: 34.75 },
      { name: '洛阳', lon: 112.45, lat: 34.62 },
      { name: '开封', lon: 114.3, lat: 34.8 },
      { name: '南阳', lon: 112.53, lat: 32.99 },
    ],
  },
  {
    name: '湖北', cities: [
      { name: '武汉', lon: 114.3, lat: 30.59 },
      { name: '宜昌', lon: 111.28, lat: 30.69 },
      { name: '襄阳', lon: 112.12, lat: 32.01 },
      { name: '荆州', lon: 112.24, lat: 30.33 },
    ],
  },
  {
    name: '湖南', cities: [
      { name: '长沙', lon: 112.94, lat: 28.23 },
      { name: '衡阳', lon: 112.57, lat: 26.9 },
      { name: '岳阳', lon: 113.13, lat: 29.37 },
      { name: '常德', lon: 111.7, lat: 29.03 },
    ],
  },
  {
    name: '广东', cities: [
      { name: '广州', lon: 113.26, lat: 23.13 },
      { name: '深圳', lon: 114.06, lat: 22.55 },
      { name: '珠海', lon: 113.55, lat: 22.27 },
      { name: '汕头', lon: 116.68, lat: 23.35 },
      { name: '佛山', lon: 113.12, lat: 23.02 },
      { name: '东莞', lon: 113.75, lat: 23.02 },
      { name: '湛江', lon: 110.36, lat: 21.27 },
      { name: '潮州', lon: 116.62, lat: 23.66 },
    ],
  },
  {
    name: '广西', cities: [
      { name: '南宁', lon: 108.37, lat: 22.82 },
      { name: '桂林', lon: 110.29, lat: 25.27 },
      { name: '柳州', lon: 109.42, lat: 24.33 },
      { name: '梧州', lon: 111.28, lat: 23.48 },
    ],
  },
  {
    name: '海南', cities: [
      { name: '海口', lon: 110.2, lat: 20.04 },
      { name: '三亚', lon: 109.51, lat: 18.25 },
    ],
  },
  {
    name: '四川', cities: [
      { name: '成都', lon: 104.07, lat: 30.57 },
      { name: '绵阳', lon: 104.68, lat: 31.47 },
      { name: '南充', lon: 106.11, lat: 30.84 },
      { name: '宜宾', lon: 104.64, lat: 28.75 },
      { name: '泸州', lon: 105.44, lat: 28.87 },
    ],
  },
  {
    name: '贵州', cities: [
      { name: '贵阳', lon: 106.63, lat: 26.65 },
      { name: '遵义', lon: 106.93, lat: 27.73 },
      { name: '六盘水', lon: 104.83, lat: 26.59 },
    ],
  },
  {
    name: '云南', cities: [
      { name: '昆明', lon: 102.83, lat: 24.88 },
      { name: '大理', lon: 100.23, lat: 25.6 },
      { name: '曲靖', lon: 103.8, lat: 25.49 },
      { name: '丽江', lon: 100.23, lat: 26.86 },
    ],
  },
  {
    name: '西藏', cities: [
      { name: '拉萨', lon: 91.11, lat: 29.66 },
      { name: '日喀则', lon: 88.88, lat: 29.27 },
    ],
  },
  {
    name: '陕西', cities: [
      { name: '西安', lon: 108.94, lat: 34.34 },
      { name: '宝鸡', lon: 107.14, lat: 34.36 },
      { name: '延安', lon: 109.49, lat: 36.6 },
      { name: '汉中', lon: 107.02, lat: 33.07 },
    ],
  },
  {
    name: '甘肃', cities: [
      { name: '兰州', lon: 103.83, lat: 36.06 },
      { name: '天水', lon: 105.72, lat: 34.58 },
      { name: '酒泉', lon: 98.49, lat: 39.73 },
    ],
  },
  {
    name: '青海', cities: [
      { name: '西宁', lon: 101.78, lat: 36.62 },
      { name: '格尔木', lon: 94.9, lat: 36.4 },
    ],
  },
  {
    name: '宁夏', cities: [
      { name: '银川', lon: 106.23, lat: 38.49 },
    ],
  },
  {
    name: '新疆', cities: [
      { name: '乌鲁木齐', lon: 87.62, lat: 43.83 },
      { name: '喀什', lon: 75.99, lat: 39.47 },
      { name: '伊宁', lon: 81.32, lat: 43.91 },
    ],
  },
  {
    name: '台湾', cities: [
      { name: '台北', lon: 121.5, lat: 25.03 },
      { name: '高雄', lon: 120.31, lat: 22.62 },
      { name: '台中', lon: 120.68, lat: 24.14 },
    ],
  },
  {
    name: '香港', cities: [
      { name: '香港', lon: 114.17, lat: 22.28 },
    ],
  },
  {
    name: '澳门', cities: [
      { name: '澳门', lon: 113.54, lat: 22.19 },
    ],
  },
]

// 默认省份/城市（广东·广州，便于快速起盘）
export const DEFAULT_PLACE = { province: '广东', city: '广州' }

export function findCity(provinceName, cityName) {
  const p = PROVINCES.find((x) => x.name === provinceName)
  if (!p) return null
  return p.cities.find((c) => c.name === cityName) || null
}
