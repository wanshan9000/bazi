export default function BaziGuideEditorial({ editorial, language }) {
  const english = language === 'en'
  const copy = english
    ? {
        index: '05 / EDITORIAL & METHOD',
        title: 'How this guide is edited',
        byline: 'Author and editorial byline',
        published: 'Published',
        updated: 'Updated',
        method: 'Terminology and calendar convention',
        sources: 'References and public texts',
        sourceNote: 'Public text',
        bibliographyNote: 'Bibliography',
        responsibility: 'Published by Genki. The byline identifies editorial responsibility and does not claim academic or professional credentials.',
      }
    : {
        index: '05 / 编辑与口径',
        title: '编辑、口径与参考',
        byline: '作者与编辑署名',
        published: '发布日期',
        updated: '更新日期',
        method: '术语与历法口径',
        sources: '参考书目与公开资料',
        sourceNote: '公开文本',
        bibliographyNote: '参考书目',
        responsibility: '发布机构：元氣满满。该署名用于标明本页编辑责任，不代表学术或其他专业资质。',
      }

  return (
    <section className="bazi-guide-section bazi-guide-editorial">
      <p className="bazi-guide-index">{copy.index}</p>
      <div>
        <h2>{copy.title}</h2>
        <p className="bazi-guide-editorial-note"><strong>{copy.byline}{english ? ': ' : '：'}</strong>{editorial.byline}{english ? '. ' : '。'}{copy.responsibility}</p>
        <dl className="bazi-guide-editorial-meta">
          <div><dt>{copy.published}</dt><dd>{editorial.datePublished}</dd></div>
          <div><dt>{copy.updated}</dt><dd>{editorial.dateModified}</dd></div>
          <div><dt>{copy.method}</dt><dd>{english ? editorial.method.en : editorial.method.zh}</dd></div>
        </dl>
        <h3>{copy.sources}</h3>
        <ul className="bazi-guide-sources">
          {editorial.sources.map(source => (
            <li key={source.title}>
              {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title}
              <span>{source.url ? copy.sourceNote : copy.bibliographyNote}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
