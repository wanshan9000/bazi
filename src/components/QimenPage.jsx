import { useEffect, useMemo, useRef, useState } from 'react';
import { castQimen } from '../engine/qimen';
import { buildQimenReport } from '../engine/reports';
import ReportView from './ReportView';
import ReportLock from './ReportLock.jsx';
import UpgradePrompt from './UpgradePrompt.jsx';
import { loadQuota, incQimen, FREE_LIMIT, isQimenOverLimit } from '../engine/freeQuota.js';
import { consumeCredit } from '../data/users.js';
import { getMonthlyCredits, planByKey, nextPlanKey } from '../engine/membership.js';

const SHICHEN = [
  { value: '子时 (23-01点)', start: 23, end: 1 },
  { value: '丑时 (01-03点)', start: 1, end: 3 },
  { value: '寅时 (03-05点)', start: 3, end: 5 },
  { value: '卯时 (05-07点)', start: 5, end: 7 },
  { value: '辰时 (07-09点)', start: 7, end: 9 },
  { value: '巳时 (09-11点)', start: 9, end: 11 },
  { value: '午时 (11-13点)', start: 11, end: 13 },
  { value: '未时 (13-15点)', start: 13, end: 15 },
  { value: '申时 (15-17点)', start: 15, end: 17 },
  { value: '酉时 (17-19点)', start: 17, end: 19 },
  { value: '戌时 (19-21点)', start: 19, end: 21 },
  { value: '亥时 (21-23点)', start: 21, end: 23 },
];

const HOUR_MAP = { 子: 0, 丑: 2, 寅: 4, 卯: 6, 辰: 8, 巳: 10, 午: 12, 未: 14, 申: 16, 酉: 18, 戌: 20, 亥: 22 };

function getShichenLabel(hour) {
  const h = Number(hour);
  const found = SHICHEN.find((s) => {
    if (s.start < s.end) return h >= s.start && h < s.end;
    return h >= s.start || h < s.end; // 跨日（子时）
  });
  return found ? found.value : SHICHEN[0].value;
}

function nowParts() {
  const d = new Date();
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
  };
}

export default function QimenPage({ user, onRequireLogin, onUpgrade, onUserChange }) {
  const reportRef = useRef(null);
  const initial = useMemo(() => {
    const n = nowParts();
    return {
      year: String(n.year),
      month: String(n.month),
      day: String(n.day),
      shichen: getShichenLabel(n.hour),
      question: '',
    };
  }, []);

  const [form, setForm] = useState(initial);
  const [stage, setStage] = useState('form'); // form | report
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // 积分不足时展示升级卡。这个 state 此前漏声明，而渲染分支里直接读 `insufficient`，
  // ES 模块是严格模式 → 已登录用户一打开奇门页就 ReferenceError 整页白屏。
  const [insufficient, setInsufficient] = useState(false);
  // 游客免费配额（奇门 10 次含 10），注册会员不计数
  const [qimenUsed, setQimenUsed] = useState(0);
  useEffect(() => { setQimenUsed(loadQuota().qimen || 0) }, []);
  const qimenLocked = !user && isQimenOverLimit(qimenUsed);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const useNow = () => {
    const n = nowParts();
    setForm((p) => ({
      ...p,
      year: String(n.year),
      month: String(n.month),
      day: String(n.day),
      shichen: getShichenLabel(n.hour),
    }));
  };

  const submit = async (e) => {
    e?.preventDefault();
    setError('');
    // 游客配额检查：免费 10 次用尽后必须先注册/登录
    if (!user && qimenLocked) {
      onRequireLogin && onRequireLogin('qimen')
      return
    }
    if (!form.year || !form.month || !form.day) {
      setError('请填写完整的年、月、日');
      return;
    }
    // 先过计费闸门，再排盘。此前是「先排好盘、setReport，再扣分」——
    // 扣分失败时报告其实已经生成并塞进 state，只是没切到 report 阶段；
    // 顺序反了既容易漏，也让「不足」这条路径依赖后续分支才不被看到。
    if (user) {
      const res = await consumeCredit(user.id, 'qimen.reading')
      if (!res.ok) {
        if (res.reason === 'insufficient') {
          setError('本月积分不足，升级到更高档位可继续起盘解读')
          setInsufficient(true)
        } else {
          setError(res.msg || '扣减积分失败，请稍后再试')
        }
        return
      }
      setInsufficient(false)
      if (res.user) onUserChange && onUserChange(res.user)
    } else {
      setQimenUsed(incQimen())
    }
    setLoading(true);
    try {
      const match = form.shichen.match(/^(.)时/);
      const zhi = match ? match[1] : '午';
      const hour = HOUR_MAP[zhi] ?? 12;
      const date = new Date(
        Number(form.year),
        Number(form.month) - 1,
        Number(form.day),
        hour,
        0,
        0,
      );
      const chart = castQimen(date);
      const sub = form.question?.trim()
        ? `问事：${form.question.trim()}｜${form.year}-${form.month}-${form.day} ${zhi}时`
        : `${form.year}-${form.month}-${form.day} ${zhi}时`;
      const rpt = buildQimenReport(chart, date, form.question || '');
      if (rpt && rpt.sub !== undefined) rpt.sub = sub;
      setReport(rpt);
      setStage('report');
      setTimeout(() => {
        document.getElementById('qimen-report-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } catch (err) {
      console.error(err);
      setError('排盘失败：' + (err?.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 回到排盘页重新起局
  const backToForm = () => {
    setStage('form');
    setReport(null);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReportShare = () => reportRef.current?.share?.();

  // 阶段一：排盘页
  if (stage === 'form') {
    return (
      <section className="qimen-page qimen-entry-form">
        <header className="qimen-hero">
          <h1 className="qimen-hero-title">奇门遁甲</h1>
          <p className="qimen-hero-sub">问事起局 · 洞察时机 · 找到你的行动方向</p>
        </header>
        {user && insufficient ? (
          <div className="qimen-board" style={{ padding: '24px' }}>
            <UpgradePrompt
              featureName="奇门遁甲完整解读"
              cost={5}
              remaining={getMonthlyCredits(user)}
              planLabel={planByKey(user.plan).name}
              onUpgrade={onUpgrade ? () => onUpgrade(nextPlanKey(user.plan)) : null}
              onClose={() => setInsufficient(false)}
            />
          </div>
        ) : qimenLocked ? (
          <div className="qimen-board" style={{ padding: '24px' }}>
            <ReportLock
              user={user}
              onRequireLogin={onRequireLogin}
              backView="qimen"
              icon="◈"
              eyebrow="奇门遁甲 · 游客免费 10 次"
              title="免费 10 次起盘已用完"
              desc="游客每起 1 次盘计 1 次免费配额，累计 10 次后需注册/登录成为会员，即可继续无限制起盘解读。"
              note={`已累计起盘 ${qimenUsed} 次 · 注册/登录后即可继续使用`}
            />
          </div>
        ) : (
        <div className="qimen-board">
          <header className="qb-header">
            <h2 className="qb-title">
              <span className="qb-title-spark" aria-hidden>✦</span>
              <span>起奇门遁甲局</span>
              <span className="qb-title-spark" aria-hidden>✦</span>
            </h2>
            <p className="qb-sub">填写起局时间，查看当下机缘与行动方向</p>
          </header>
          {!user && (
            <p className="quota-hint">
              游客免费 <b>{FREE_LIMIT}</b> 次起盘 · 已用 <b>{qimenUsed}</b> / {FREE_LIMIT}{qimenLocked ? ' · 已用完 · 登录后可继续' : ''}
            </p>
          )}
          {user && (
            <p className="quota-hint">
              {planByKey(user.plan).name}会员 · 每次起盘消耗 <b>5</b> 积分 · 本月剩余 <b>{getMonthlyCredits(user)}</b>
            </p>
          )}

          <button type="button" className="qb-now" onClick={useNow} title="使用当前时间">
            <span className="qb-now-icon" aria-hidden>◷</span>
            <span>使用当前时间</span>
          </button>

          <form className="qb-form" onSubmit={submit}>
            <div className="qb-row">
              <div className="qb-col">
                <label className="qb-label">年 / 月</label>
                <div className="qb-grid">
                  <input
                    className="qb-input"
                    type="number"
                    min="1900"
                    max="2100"
                    value={form.year}
                    onChange={(e) => update('year', e.target.value)}
                    placeholder="2026"
                  />
                  <input
                    className="qb-input"
                    type="number"
                    min="1"
                    max="12"
                    value={form.month}
                    onChange={(e) => update('month', e.target.value)}
                    placeholder="8"
                  />
                </div>
              </div>
            </div>

            <div className="qb-row">
              <div className="qb-col">
                <label className="qb-label">日 / 时</label>
                <div className="qb-grid">
                  <input
                    className="qb-input"
                    type="number"
                    min="1"
                    max="31"
                    value={form.day}
                    onChange={(e) => update('day', e.target.value)}
                    placeholder="29"
                  />
                  <select
                    className="qb-input qb-select"
                    value={form.shichen}
                    onChange={(e) => update('shichen', e.target.value)}
                  >
                    {SHICHEN.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="qb-row">
              <div className="qb-col">
                <label className="qb-label">想问的事（可选）</label>
                <textarea
                  className="qb-textarea"
                  rows={3}
                  value={form.question}
                  onChange={(e) => update('question', e.target.value)}
                  placeholder="如：近期事业是否有突破？出行/谈判方位建议？留空则进行综合运势解读"
                />
              </div>
            </div>

            {error && <div className="qb-error">{error}</div>}

            <button type="submit" className="qb-launch" disabled={loading}>
              <span className="qb-launch-icon" aria-hidden>≡</span>
              <span>{loading ? '正在排盘…' : '起盘排局'}</span>
            </button>
          </form>
        </div>
        )}
      </section>
    );
  }

  // 阶段二：报告页
  return (
    <section className="qimen-page qimen-report-page">
      <div id="qimen-report-anchor" />
      <header className="qimen-report-page-title">
        <h1>奇门遁甲</h1>
        <p>问事起局 · 洞察时机 · 找到你的行动方向</p>
      </header>
      <div className="rise">
        <div className="card chart-card zw-head qimen-report-head">
          <div className="zw-head-actions">
            <button className="zw-head-btn" onClick={handleReportShare} title="分享到社交" aria-label="分享到社交">↗</button>
          </div>
          <div className="chart-head">
            <div className="name" style={{ fontSize: 19 }}>
              <span>奇门遁甲 · 用事报告</span>
              <button type="button" className="qimen-report-recast" onClick={backToForm}>重新排盘</button>
            </div>
            <div className="sub">
              {report?.meta?.juLabel || '奇门起局'} · {report?.meta?.shiChen || '时家奇门'} · 宜取 {report?.meta?.goodPos || '吉'} 方
            </div>
          </div>
        </div>
        {report && <div style={{ marginTop: 16 }}><ReportView ref={reportRef} report={report} hideLead /></div>}
      </div>
    </section>
  );
}
