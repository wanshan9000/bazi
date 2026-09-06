#!/usr/bin/env bash
# 元气/灵枢 一键部署到 47.97.48.115（bazi.keyfocus.cn）。在本机仓库根目录执行：
#   deploy/deploy.sh                 部署当前 HEAD 的已提交内容（未提交改动不会上）
#   deploy/deploy.sh --ref <git-ref> 部署指定分支/标签/提交
#   deploy/deploy.sh --skip-install  依赖没变时跳过 npm ci
#   deploy/deploy.sh --skip-tests    跳过发布前的回归测试（不建议）
#
# 流程：git archive → 服务器 STAGE_DIR 里 npm ci + npm run build（含引擎打包）+ agent:setup
#       → 停服务 → rsync 进 APP_DIR（保留运行时数据）→ dist 同步到 WEB_DIR → 装 unit 重启
#       → 本机回环验活 → 装 Caddy 站点片段并 reload → 公网验活。
# 构建全部在 STAGE_DIR 完成，构建失败时线上目录未被碰过。
#
# 首次部署前置（服务器上手工一次）：/etc/bazi/env，模板见 deploy/env.example。
# 账号、目录、unit、Caddy 片段都由本脚本幂等补齐。
# pipefail 必不可少：下面的远端命令大量使用 `... | tail -N` 收敛日志，
# 没有 pipefail 时管道的退出码取自 tail（永远是 0），npm run build / agent:setup
# 失败会被静默吞掉，一路走到「部署成功」。
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-47.97.48.115}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/relly_keyfocushub.pem}"
DEPLOY_REF="${DEPLOY_REF:-HEAD}"
DOMAIN="${DOMAIN:-bazi.keyfocus.cn}"
APP_DIR="${APP_DIR:-/opt/bazi}"
STAGE_DIR="${STAGE_DIR:-/opt/bazi-staging}"
WEB_DIR="${WEB_DIR:-/var/www/bazi}"
STATE_DIR="${STATE_DIR:-/var/lib/bazi}"
SERVICE="${SERVICE:-bazi}"
SERVICE_USER="${SERVICE_USER:-bazi}"
ENV_FILE="${ENV_FILE:-/etc/bazi/env}"
# 与 deploy/bazi.service 里 Environment=PORT 保持一致，验活才打得到。
PORT="${PORT:-8793}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"

SKIP_INSTALL=0
SKIP_TESTS=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-install) SKIP_INSTALL=1; shift ;;
    --skip-tests) SKIP_TESTS=1; shift ;;
    --ref) DEPLOY_REF="${2:?--ref 需要一个 git ref}"; shift 2 ;;
    -h|--help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
remote() { ssh -i "$DEPLOY_KEY" -o BatchMode=yes -o ConnectTimeout=15 "$DEPLOY_USER@$DEPLOY_HOST" "$@"; }

# 运行时数据：rsync --delete 时既不覆盖也不删除（--exclude 同时保护接收端）。
KEEP=(
  --exclude=/server/data
  --exclude=/server/dsh/home/sessions
  --exclude=/server/dsh/home/storages
  --exclude=/server/dsh/home/.anonymous-user-id
  --exclude=/server/dsh/skills/_admin
)

COMMIT="$(git rev-parse --short "$DEPLOY_REF")"
SUBJECT="$(git log -1 --format=%s "$DEPLOY_REF")"

log "预检 · $DEPLOY_REF ($COMMIT) $SUBJECT → $DEPLOY_USER@$DEPLOY_HOST"
remote true || die "连不上服务器"
remote "test -s $ENV_FILE" || die "服务器缺少 ${ENV_FILE}，按 deploy/env.example 先创建"
remote "grep -q '^DEEPSEEK_API_KEY=.\+' $ENV_FILE" || die "$ENV_FILE 里 DEEPSEEK_API_KEY 为空"
remote "command -v node >/dev/null && command -v rsync >/dev/null && command -v caddy >/dev/null" || die "服务器缺 node/rsync/caddy"
remote "getent group $SERVICE_USER >/dev/null || groupadd --system $SERVICE_USER
        getent passwd $SERVICE_USER >/dev/null || useradd --system --gid $SERVICE_USER --home-dir $STATE_DIR --shell /usr/sbin/nologin $SERVICE_USER
        install -d -o $SERVICE_USER -g $SERVICE_USER -m 0750 $STATE_DIR
        chown root:$SERVICE_USER $ENV_FILE && chmod 0640 $ENV_FILE"

log "上传源码到 $STAGE_DIR"
git archive --format=tar "$DEPLOY_REF" | remote "rm -rf $STAGE_DIR && mkdir -p $STAGE_DIR && tar -x -C $STAGE_DIR"

if [[ $SKIP_INSTALL -eq 1 ]]; then
  log "复用 $APP_DIR/node_modules（--skip-install）"
  remote "test -d $APP_DIR/node_modules && cp -a $APP_DIR/node_modules $STAGE_DIR/node_modules" || die "线上没有 node_modules，去掉 --skip-install"
else
  log "npm ci（${NPM_REGISTRY}，日志 /root/bazi-npmci.log）"
  remote "cd $STAGE_DIR && npm ci --no-audit --no-fund --registry=$NPM_REGISTRY > /root/bazi-npmci.log 2>&1" \
    || { remote "tail -25 /root/bazi-npmci.log" || true; die "npm ci 失败"; }
fi

log "构建：引擎打包 + 前端 + agent:setup（装插件到 profile、生成技能目录）"
remote "set -euo pipefail; cd $STAGE_DIR
        npm run build --silent 2>&1 | tail -15
        set -a; . $ENV_FILE; set +a
        npm run agent:setup --silent 2>&1 | tail -15
        test -f server/dsh/plugins/lingshu-tools/dist/engines.mjs
        test -f dist/index.html
        test -L server/dsh/home/profiles/lingshu/node_modules/dsh-plugin-lingshu-tools" \
  || die "构建失败（线上未改动）"

# 测试门禁：没有 CI，这里是唯一一道自动化关卡。跑的是构建产物所在的同一棵树。
if [[ $SKIP_TESTS -eq 0 ]]; then
  log "回归测试（--skip-tests 可跳过）"
  remote "set -euo pipefail; cd $STAGE_DIR && npm test 2>&1 | tail -25" \
    || die "测试未通过，已中止（线上未改动）。确需强行发布用 --skip-tests"
fi

# 切换前先留一份可回退的副本。rsync --delete 是就地覆盖，一旦新版本起不来，
# 没有备份就只能重新跑一次部署（而那时线上已经是坏的）。
BACKUP_DIR="${APP_DIR}.prev"
log "备份当前线上产物 → $BACKUP_DIR"
remote "set -euo pipefail
        if [ -d $APP_DIR ]; then
          rm -rf $BACKUP_DIR
          cp -a $APP_DIR $BACKUP_DIR
        fi" || die "备份失败，已中止（线上未改动）"

log "切换产物 → ${APP_DIR}，前端 → $WEB_DIR"
remote "set -euo pipefail
        systemctl stop $SERVICE 2>/dev/null || true
        mkdir -p $APP_DIR $WEB_DIR
        rsync -a --delete ${KEEP[*]} $STAGE_DIR/ $APP_DIR/
        install -d $APP_DIR/server/data $APP_DIR/server/dsh/home/sessions $APP_DIR/server/dsh/skills/_admin
        chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR
        rsync -a --delete --chown=root:root $APP_DIR/dist/ $WEB_DIR/
        chmod -R a+rX $WEB_DIR"

# 从这里开始线上目录已被改动，失败必须回滚而不是撒手不管
rollback() {
  echo "  ↩ 回滚到 $BACKUP_DIR" >&2
  remote "set -euo pipefail
          if [ -d $BACKUP_DIR ]; then
            rsync -a --delete $BACKUP_DIR/ $APP_DIR/
            chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR
            rsync -a --delete --chown=root:root $APP_DIR/dist/ $WEB_DIR/ || true
            chmod -R a+rX $WEB_DIR || true
            systemctl restart $SERVICE || true
          fi" >&2 || echo "  ⚠ 回滚也失败了，请手工处理：$BACKUP_DIR" >&2
}
die_rollback() { rollback; die "$@"; }

log "安装 unit 并启动 $SERVICE"
remote "cat > /etc/systemd/system/$SERVICE.service" < "$REPO_ROOT/deploy/$SERVICE.service"
remote "systemctl daemon-reload && systemctl enable --now $SERVICE >/dev/null 2>&1 && systemctl restart $SERVICE"
for i in $(seq 1 20); do
  if remote "curl -fsS http://127.0.0.1:$PORT/api/health" 2>/dev/null; then echo; break; fi
  [[ $i -eq 20 ]] && { remote "systemctl status $SERVICE --no-pager -l | tail -30; journalctl -u $SERVICE -n 40 --no-pager"; die_rollback "服务起来了但 /api/health 不通"; }
  sleep 1
done

log "Caddy 站点：/etc/caddy/conf.d/$SERVICE.caddy"
# ⚠ 先写到临时位置校验，通过了再落到 conf.d。直接写进 conf.d 再校验的话，
# 一旦片段有问题，坏文件就留在那儿了 —— 之后任何人（包括 KeyfocusHub 仓库发版）
# 执行 caddy reload 都会失败，等于把同机所有站点一起拖下水。
remote "mkdir -p /etc/caddy/conf.d && cat > /tmp/$SERVICE.caddy.new" < "$REPO_ROOT/deploy/$SERVICE.caddy"
remote "set -euo pipefail
        caddy validate --config /tmp/$SERVICE.caddy.new --adapter caddyfile >/dev/null 2>&1 \
          || { echo '站点片段本身校验失败：'; caddy validate --config /tmp/$SERVICE.caddy.new --adapter caddyfile; rm -f /tmp/$SERVICE.caddy.new; exit 1; }
        mv /tmp/$SERVICE.caddy.new /etc/caddy/conf.d/$SERVICE.caddy" \
  || die_rollback "Caddy 站点片段校验失败（未落盘，线上 Caddy 未受影响）"
remote "set -e
        if ! grep -qE '^import conf\.d/\*\.caddy' /etc/caddy/Caddyfile; then
          cp -a /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-\$(date +%Y%m%d-%H%M%S)
          printf '\n# 其他仓库自带的站点片段（如 bazi.keyfocus.cn ← bazi 仓库 deploy/bazi.caddy）。\n# 覆盖本文件时务必保留这一行，否则那些站点会随之下线。\nimport conf.d/*.caddy\n' >> /etc/caddy/Caddyfile
        fi
        caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 || { caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; exit 1; }
        systemctl reload caddy" || die_rollback "Caddy 配置校验/重载失败（已备份原 Caddyfile）"

log "公网验活 https://$DOMAIN/api/health（首次要等签证书）"
for i in $(seq 1 30); do
  if out="$(curl -fsS -m 10 "https://$DOMAIN/api/health" 2>/dev/null)"; then echo "$out"; break; fi
  [[ $i -eq 30 ]] && die "https://$DOMAIN 未通：查 journalctl -u caddy 与 DNS（本地回环已通过，未自动回滚；如需回退：rsync -a --delete $BACKUP_DIR/ $APP_DIR/ && systemctl restart $SERVICE）"
  sleep 3
done
curl -fsS -m 10 "https://$DOMAIN/" | grep -q '<div id="root"' || die "首页没拿到前端 index.html"

log "完成 · $COMMIT $SUBJECT → https://$DOMAIN"
