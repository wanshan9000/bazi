import { useLocale } from '../i18n.jsx'

const EFFECTIVE_DATE = '2026年9月16日'

function serviceContact() {
  const email = import.meta.env.VITE_CONTACT_EMAIL || ''
  return email || '请通过网站公示的联系渠道提交'
}

function operatorName() {
  return import.meta.env.VITE_LEGAL_ENTITY || '元氣滿滿产品运营方'
}

const TERMS = [
  ['一、协议的适用与接受', [
    '本《用户协议》适用于您访问、注册、使用元氣滿滿网站、移动端网页及其提供的排盘、报告、元氣 Agent、黄历、塔罗、内容阅读与会员服务。请在使用前仔细阅读。您点击同意、注册账号、购买会员或继续使用服务，即表示已理解并接受本协议。',
    '如您不同意本协议的任何内容，请停止注册或使用相关服务。我们会在法律允许的范围内更新本协议；重要变更将以站内公告、弹窗或其他合理方式提示，更新后的协议自公布或载明日期起生效。'
  ]],
  ['二、服务性质与使用边界', [
    '本服务将传统文化、命理排盘规则与人工智能生成能力用于文化学习、娱乐参考和个人思考。八字、紫微、奇门、称骨、黄历、塔罗、风水、姓名等结果，以及元氣 Agent 的解释，均不构成医疗、心理、法律、投资、婚恋、就业、财务或其他专业意见，亦不构成对未来结果的承诺或保证。',
    '请基于自身判断作出重要决定；涉及健康、财产、人身安全、法律责任或其他重大事项时，应咨询具备相应资质的专业人士。我们不鼓励任何利用结果实施歧视、迷信营销、违法活动或伤害他人的行为。'
  ]],
  ['三、账号与使用规则', [
    '您应提供真实、准确、完整且及时更新的注册信息，并妥善保管账号、密码和验证码。账号仅限本人使用；因您保管不当、向他人泄露或授权他人使用造成的损失，由您自行承担。发现异常登录或账号被盗，请尽快通过站内公示渠道联系我们。',
    '您不得以爬虫、脚本、外挂、批量注册、逆向工程、干扰服务、绕过访问或计费限制等方式使用服务；不得上传、发布或传播违法、有害、侵权、欺诈、侮辱、骚扰或侵犯他人隐私的内容。违反本规则时，我们可依风险程度采取提示、限制功能、暂停或终止账号等措施。'
  ]],
  ['四、积分、会员与付费服务', [
    '平台以积分作为部分 AI 深读与元氣 Agent 服务的结算单位，积分与模型实际 Token 消耗存在换算关系。不同会员档位对应不同可用模块、月度积分或次数权益，具体以购买页、订单页和当时展示的规则为准。',
    '付费前请核对服务内容、价格、有效期、自动续费提示（如适用）及退款说明。除法律法规另有规定或平台另有明确承诺外，已消耗的积分、已完成生成或已实际交付的数字化服务通常不支持退换。因系统故障导致未交付而已扣除的权益，可向客服提交订单或时间信息申请核查。'
  ]],
  ['五、AI 生成内容与用户输入', [
    '元氣 Agent 的回复由规则、工具和第三方大模型共同生成，可能出现不完整、延迟、错误或不符合您预期的内容。请自行核对关键信息，不要将回复视为事实、专业结论或紧急处置依据。',
    '您应确保对所提交的出生资料、命盘资料、问题、图片或其他内容拥有合法权利，并已取得涉及他人的必要授权。您保留对合法输入内容享有的权利；为提供、维护、安全保障及改进服务所必需的范围内，您授权我们处理这些内容。未经您的授权，我们不会将可识别的个人命盘内容公开展示。'
  ]],
  ['六、知识产权', [
    '网站的软件、界面、标识、排版、数据库、原创内容及相关知识产权归我们或相应权利人所有。除个人、非商业、合理使用外，未经书面许可，不得复制、转载、镜像、出售、出租、传播或用于训练、建立竞争性服务。',
    '引用第三方公开资料、传统典籍或用户生成内容的权利归属，以相应法律和权利声明为准。若您认为站内内容侵犯您的合法权利，可通过公示渠道提交权属证明和具体链接，我们将依法处理。'
  ]],
  ['七、服务变更、中断与终止', [
    '我们会尽力维持服务稳定，但因网络、设备维护、第三方服务、不可抗力、监管要求或安全事件，服务可能出现中断、延迟、变更或停止。我们会在合理范围内提前通知可预见的重要维护；紧急安全处置除外。',
    '在法律允许的范围内，我们可基于业务调整、合规或安全原因调整服务内容；涉及未使用付费权益的，将依适用法律及公示规则处理。您可随时停止使用服务，并可按隐私政策行使删除账号或数据的权利。'
  ]],
  ['八、责任限制', [
    '在法律允许的最大范围内，服务按“现状”和“可用性”提供。对于因您依据命理或 AI 内容作出决定、网络环境、第三方原因、您违反本协议或不可抗力导致的损失，我们不承担超出法律规定范围的责任。',
    '任何依法不得排除或限制的责任，不受本条影响。'
  ]],
  ['九、法律适用与争议解决', [
    '本协议的订立、履行、解释及争议解决适用中华人民共和国大陆地区法律。发生争议时，双方应先友好协商；协商不成的，可向有管辖权的人民法院提起诉讼。'
  ]],
]

const PRIVACY = [
  ['一、我们处理哪些信息', [
    '为注册和保障账号安全，我们可能处理昵称、账号、绑定邮箱或手机号、加密后的密码凭证、登录时间、设备与浏览器基础信息、IP 地址及必要的安全日志。',
    '为提供排盘、报告和咨询服务，我们会在您主动填写或上传时处理出生日期、时辰、性别、地点、问题描述、命盘结果、收藏和报告记录、对话内容及您选择提交的其他资料。出生资料、命盘和对话通常属于敏感或高度私密的信息，请仅提交提供服务所必需的内容。',
    '为完成交易和权益核验，我们可能处理订单号、会员档位、积分余额、支付状态与必要的售后记录。实际支付信息由具备相应资质的支付服务商按其规则处理，我们不会保存完整的银行卡或支付密码信息。'
  ]],
  ['二、信息的使用目的', [
    '我们仅在必要范围内使用信息：创建和保护账号；生成您请求的排盘、报告和 AI 回复；结算积分、提供会员权益与售后；保存您主动选择留存的记录；排查故障、反欺诈、保障系统安全，以及在去标识化或汇总后改进产品体验。',
    '未经您的单独同意，我们不会将您的个人信息用于与本服务无关的营销，也不会出售您的个人信息。'
  ]],
  ['三、第三方服务与对外提供', [
    '为实现 AI 回复、短信、支付、云服务或安全防护，我们可能使用第三方服务提供商。仅在完成相应功能所需的最小范围内向其传输必要信息，并要求其履行保密与安全义务。AI 服务请求会发送至当前启用的模型服务提供商；请避免在问题中填写身份证号、银行卡号、精确住址、医疗记录等非必要敏感信息。',
    '除非获得您的明确同意、为履行法定义务、应主管机关或司法机关依法要求，或为保护您、他人及平台的重大合法权益，我们不会向无关第三方提供可识别的个人信息。发生合并、分立、收购或资产转让时，如涉及个人信息转移，我们会依法告知并要求承接方继续受本政策约束。'
  ]],
  ['四、存储、保留与安全', [
    '信息将在提供服务所需的期限内保存；法律法规要求保存或为处理争议、防范风险所必需的，将在相应期限内保留。达到目的后，我们会删除、匿名化或依法采取其他处理方式。',
    '我们采取访问控制、传输加密、密码加密存储、日志审计和最小权限等合理安全措施，但互联网环境并非绝对安全。请不要通过公开留言、共享设备或他人账号提交敏感信息。发生可能影响您权益的安全事件时，我们将依法采取补救并按要求通知。'
  ]],
  ['五、Cookie、本地存储与权限', [
    '网站会使用 Cookie、localStorage 或类似技术保存登录状态、语言偏好、匿名体验额度和页面设置，以保障功能正常运行。您可在浏览器中清除或限制相关数据，但部分功能可能无法正常使用。',
    '如网页在您授权后调用相机、相册、定位或通知等能力，仅用于您主动发起的扫码、上传、地点选择或提醒功能；您可在浏览器或设备设置中随时关闭授权。'
  ]],
  ['六、您的权利', [
    '您有权查询、更正、补充、删除自己的个人信息，撤回授权，注销账号，获取个人信息处理说明，或就隐私问题投诉、举报。您可先在账号页面自行操作；无法自助完成时，可通过下方联系渠道提出请求。',
    '为保护账号安全，我们可能在处理请求前核验您的身份。注销账号后，除法律法规要求保留的信息外，我们将停止提供服务并删除或匿名化相关个人信息；已完成的交易、依法必须留存的记录及无法与个人重新关联的匿名数据不受影响。'
  ]],
  ['七、未成年人保护', [
    '如您未满 14 周岁，请在监护人同意和指导下使用服务，并由监护人阅读本政策。我们不会在明知的情况下收集与未成年人服务无关的信息；监护人认为未成年人未经同意提供信息的，可联系我们申请删除或采取其他处理措施。'
  ]],
  ['八、政策更新与联系我们', [
    '我们可能因服务变化、法律法规或安全要求更新本政策。重大变更会以显著方式提示；继续使用更新后的服务，表示您理解更新内容。有关个人信息处理的意见、建议或权利请求，请通过网站公示联系渠道联系我们。'
  ]],
]

function englishContent(kind) {
  if (kind === 'terms') return [
    ['1. Acceptance and scope', ['These Terms apply to Genki services, including charting, reports, AI consultation, almanac, tarot, content, and membership features. By registering, purchasing, or continuing to use the service, you accept these Terms and later updates notified through the site.']],
    ['2. Nature of the service', ['Genki combines traditional-culture content, charting rules, and AI-generated responses for learning, entertainment, and personal reflection. Results are not medical, psychological, legal, financial, employment, relationship, or other professional advice, and are not a guarantee of future outcomes.', 'Do not use any result as the sole basis for a material decision. Seek a qualified professional for health, safety, legal, or financial matters.']],
    ['3. Accounts and acceptable use', ['Keep your account credentials confidential and provide accurate registration information. You may not share your account, automate access, scrape, reverse engineer, bypass quotas or billing, interfere with the service, infringe rights, or submit unlawful, abusive, or privacy-invasive content. We may restrict or terminate accounts that create a security, legal, or platform risk.']],
    ['4. Credits, membership and AI responses', ['Some features use credits, which are settled against actual model Token usage. Membership entitlements, price, validity, renewals if applicable, and refund terms are those shown on the purchase and order pages. Delivered digital services and consumed credits are generally non-refundable unless required by law or expressly stated otherwise.', 'AI output can be delayed, incomplete, or inaccurate. Verify important information independently.']],
    ['5. Your content and intellectual property', ['You must have the rights and any necessary permissions for information you submit, including another person’s birth details. You retain rights in lawful inputs; you authorize processing only as necessary to provide, secure, and improve the service. Our software, interface, branding, original materials, and databases may not be copied or commercially reused without permission.']],
    ['6. Changes, liability, and disputes', ['Service availability may be affected by maintenance, networks, third-party providers, security events, force majeure, or legal requirements. To the extent permitted by law, the service is provided “as is” and “as available”; nothing here limits liability that cannot legally be excluded. These Terms are governed by the laws of mainland China, and disputes should first be resolved through good-faith discussion.']],
  ]
  return [
    ['1. Information we process', ['We process account and security data such as nickname, account, bound email or phone, encrypted password credentials, login time, device/browser basics, IP address, and security logs. When you choose to use charting or consultation features, we process the birth details, location, questions, chart and report results, saved records, conversations, and other materials you submit.', 'Birth details, charts, and conversations can be highly private. Please submit only what is necessary for the service.']],
    ['2. Why we use it', ['We use information to create and secure accounts, generate requested charts and AI replies, settle credits and membership, retain records you choose to save, provide support, prevent fraud, and improve the product using de-identified or aggregated data where appropriate. We do not sell personal information or use it for unrelated marketing without separate consent.']],
    ['3. Service providers and sharing', ['We may use AI model, cloud, SMS, payment, and security providers. Necessary data is shared with them only to provide the relevant function and under confidentiality and security obligations. Do not include unnecessary sensitive data such as ID, bank, precise address, or medical records in AI prompts.', 'We disclose identifiable personal information only with your consent, where required by law or lawful authority, or to protect significant lawful rights and safety.']],
    ['4. Storage, security, and your choices', ['Information is retained only for as long as needed for the stated purposes or as required by law. We use reasonable safeguards including access control, encryption in transit, encrypted credential storage, and audit logging. No internet system is absolutely secure.', 'You may request access, correction, deletion, withdrawal of consent, account cancellation, or an explanation of processing through the account area or the contact channel below. We may verify identity before acting.']],
    ['5. Cookies, minors, and updates', ['Cookies and local storage preserve sign-in state, language preferences, anonymous trial quota, and settings. You can clear them in your browser, though some features may stop working. Users under 14 should use the service with a guardian’s consent and guidance.', 'We will notify material policy changes through reasonable site notices.']],
  ]
}

export default function LegalPage({ type = 'terms', onBack }) {
  const { locale } = useLocale()
  const isTerms = type === 'terms'
  const isEnglish = locale === 'en'
  const title = isTerms
    ? (isEnglish ? 'Terms of Service' : locale === 'zh-TW' ? '使用者協議' : '用户协议')
    : (isEnglish ? 'Privacy Policy' : '隐私政策')
  const content = isEnglish ? englishContent(type) : (isTerms ? TERMS : PRIVACY)
  const entity = operatorName()
  const contact = serviceContact()

  return (
    <section className="legal-page page-shell">
      <button className="page-back" onClick={onBack} aria-label={isEnglish ? 'Back' : '返回'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        <span>{isEnglish ? 'Back' : '返回'}</span>
      </button>
      <header className="legal-hero">
        <p className="legal-kicker">GENKI · {isEnglish ? 'LEGAL INFORMATION' : '服务与数据说明'}</p>
        <h1>{title}</h1>
        <p>{isEnglish ? `Effective date: September 16, 2026` : `生效日期：${EFFECTIVE_DATE} · 最近更新：${EFFECTIVE_DATE}`}</p>
      </header>

      <aside className="legal-summary">
        <span className="legal-summary-mark" aria-hidden="true">✦</span>
        <p>{isEnglish
          ? 'Please read this document before using the service. Important decisions should not rely solely on traditional-culture or AI generated content.'
          : '请在使用服务前完整阅读本文件。传统文化与 AI 生成内容仅供参考，重大决定请基于独立判断并咨询专业人士。'}</p>
      </aside>

      <article className="legal-document">
        <div className="legal-meta">
          <span>{isEnglish ? 'Operator' : '运营方'}：{entity}</span>
          <span>{isEnglish ? 'Contact' : '联系渠道'}：{contact}</span>
        </div>
        {content.map(([heading, paragraphs]) => (
          <section className="legal-section" key={heading}>
            <h2>{heading}</h2>
            {paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          </section>
        ))}
      </article>
    </section>
  )
}
