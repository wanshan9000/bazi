import { useEffect, useRef } from 'react'

// 星空背景：闪烁星辰 + 偶发流星
export default function StarField() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    // getContext 可以返回 null：canvas 被禁用、显存耗尽、无头环境等。
    // 不判空的话，下面的动画循环每一帧都会抛 "clearRect of null" ——
    // 一个纯装饰的背景层能把整页的控制台刷满，甚至压垮性能。
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null
    if (!ctx) return
    let raf = 0
    let w = 0, h = 0
    const stars = []
    let meteors = []

    const resize = () => {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
      init()
    }

    const init = () => {
      stars.length = 0
      const count = Math.min(140, Math.floor((w * h) / 14000))
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.3 + 0.3,
          base: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.02 + 0.004,
          hue: Math.random() < 0.22 ? '201,162,39' : '255,255,255'
        })
      }
    }

    const spawnMeteor = () => {
      meteors.push({
        x: Math.random() * w * 0.7 + w * 0.2,
        y: Math.random() * h * 0.25,
        vx: -(Math.random() * 3 + 2.5),
        vy: Math.random() * 1.4 + 1,
        life: 1
      })
    }

    let lastMeteor = 0
    const draw = (t) => {
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(s.base + t * s.speed))
        ctx.globalAlpha = tw * 0.9
        ctx.fillStyle = `rgba(${s.hue},1)`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // 流星
      if (t - lastMeteor > 6000 && Math.random() < 0.5) {
        spawnMeteor()
        lastMeteor = t
      }
      meteors = meteors.filter(m => m.life > 0)
      for (const m of meteors) {
        m.x += m.vx
        m.y += m.vy
        m.life -= 0.012
        const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 8, m.y - m.vy * 8)
        grad.addColorStop(0, `rgba(232,201,106,${Math.max(0, m.life)})`)
        grad.addColorStop(1, 'rgba(232,201,106,0)')
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(m.x, m.y)
        ctx.lineTo(m.x - m.vx * 8, m.y - m.vy * 8)
        ctx.stroke()
      }

      raf = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} className="starfield" />
}
