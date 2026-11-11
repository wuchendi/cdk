========================================================================
  Google AI Pro (5 TB) 零成本两年 (US$0.00 -> 24个月) 全自动控制台
========================================================================

【一、运行环境要求】
1. Windows 10 / 11 系统
2. 已安装 Google Chrome 浏览器（默认路径即可）
3. 已安装 Python 3.10 或更高版本（安装时勾选 Add Python to PATH）
4. 网络环境：本机开启美区（US）代理，或在控制台左侧填写代理模板

【二、快速启动步骤】
1. 首次使用请双击运行：【1_首次运行_安装依赖并启动.bat】
2. 之后日常使用直接双击：【2_启动控制台.bat】
3. 浏览器会自动打开控制台页面：http://127.0.0.1:8765

【三、自定义填写支付卡 & 跑号说明】
1. 填写支付卡（必填）：
   - 在网页左侧【全局配置与内联免税绑卡】区域，填入你自己的 Visa 或 Mastercard 外币卡：
     * 卡号（16位数字）
     * 有效期（月 / 年，如 08 / 29）
     * 安全码（3位 CVC）
     * 持卡人英文姓名
     * 免税邮编默认已填好 97201（美国俄勒冈免税州），无需修改
   - 填写后点击【💾 保存配置】。
   - 注：脚本内置严格 0 元消费保护，仅在结账弹窗确认为 US$0.00 时才会点击订阅，全程 0 扣费。

2. 批量导入 Google 账号：
   - 在网页右侧【批量放号导入区】粘贴账号（每行一个），支持以下任意格式：
     * 邮箱----密码----辅助邮箱
     * 邮箱----密码----辅助邮箱----2FA密钥
     * 邮箱----密码----2FA密钥
   - 点击【➕ 一键导入账号列表】。

3. 开始全自动执行：
   - 点击单个账号右侧的【▶ 执行】或顶部的【▶ 批量全自动执行】。
   - 脚本会自动完成：
     Step 1: 自动登录 Google 并通过辅助邮箱 / 2FA 验证
     Step 2: 内联免税绑卡 + 首层 12 个月免费包 (US$0.00)
     Step 3: 叠加二层 6 个月免费包 (US$0.00 -> 18个月)
     Step 4: 叠加三层 6 个月免费包 (US$0.00 -> 24个月封顶)
     Step 5: 自动前往 Google Play 取消自动续订，锁死 2 年到期权益并截图验真


# 卡网：https://faka.cdkey.si
# 博客：https://blog.caowo.de
# TG群：@Hello_Florence


========================================================================
  接入 cdk 任务系统（API 驱动，推荐）
========================================================================

除了上面的本地控制台（app.py，手动粘贴账号）外，本目录新增了一个 API 驱动的
执行器，直接对接 cdk 管理后台：它轮询后台的待办任务，逐个跑自动化，并把
运行中 / 成功 / 失败 的状态和运行详情回写到任务上。账号凭据来自后台（买家在
控制台提交的 `邮箱----密码----2FA密钥`），不再手工导入。

1. 准备配置（卡和代理只留在本机，不入库）：
   - 复制 `config.example.json` 为 `config.json`，填写：
     * `admin_token`：cdk 后端的 `ADMIN_TOKEN`（与管理后台登录令牌相同）
     * `api_url`：cdk 后端地址（默认 https://cdk.a.wd.ds.cc）
     * `card`：你的外币卡（卡号 / 月 / 年 / CVC / 持卡人；邮编默认 97201）
     * `proxy_template`：美区代理模板（可选，支持 `{COUNTRY}` / `{session}` 占位）
   - 也可用环境变量覆盖连接：`CDK_API_URL`、`CDK_ADMIN_TOKEN`、`CDK_POLL_SECONDS`。

2. 安装依赖（首次）：`pip install -r requirements.txt && playwright install chromium`

3. 运行：
   - `python task_worker.py`        持续轮询待办任务
   - `python task_worker.py --once` 把当前队列跑完就退出

说明：
- 本执行器仍需在操作员的 Windows 机器上运行（真实 Chrome + 美区代理），
  自动化引擎 `automation_engine.py` 未改动。
- 任务一旦开始即被置为「运行中」，后台不会再次下发；若中途崩溃，任务会停在
  「运行中」，在管理后台把它改回「等待运行」即可重跑。
- 任务类型（sub6/sub12/sub24）目前都走零成本 24 个月流程；按时长分层是后续项。


========================================================================
  在 Linux / macOS 上运行
========================================================================

`.bat` 只是 Windows 的双击启动器，对应命令在 Linux/macOS 上是：

前置条件：
- Python 3.10+
- 真实的 Chrome 或 Chromium（引擎用它登录 Google，不是 Playwright 自带的那个）
  * Debian/Ubuntu: `sudo apt install chromium`（或装 Google Chrome）
  * 自动探测 `/usr/bin/google-chrome`、`/usr/bin/chromium` 等；路径不同时用
    环境变量指定：`export CHROME_PATH=/path/to/chrome`
- 一个“桌面/显示”。Google 登录自动化需要有头浏览器：
  * 有图形桌面：直接跑即可
  * 无桌面的服务器：用 Xvfb 套一层 → `xvfb-run -a ./run.sh`
    （装 Xvfb：`sudo apt install xvfb`）
- 美区住宅代理（在 config.json 的 `proxy_template` 里配）

运行：
```bash
cd worker
cp config.example.json config.json   # 填 admin_token / 卡 / 代理
chmod +x run.sh
./run.sh            # 持续轮询待办任务
./run.sh --once     # 跑完当前队列就退出
# 无桌面服务器：
xvfb-run -a ./run.sh
```

`run.sh` 做的事：建虚拟环境 → `pip install -r requirements.txt` →
`playwright install chromium`（装 Playwright 驱动）→ 启动 `task_worker.py`。
不想用脚本时手动等价命令：
```bash
pip install -r requirements.txt
python -m playwright install chromium
python task_worker.py
```

提示：无头（headless）跑 Google 登录极易被风控拦截，所以这里走的是“有头 +
Xvfb”而不是 headless。本机那台无头容器服务器并不适合跑它，建议放在有桌面的
操作员机器或带 Xvfb 的专用机上。
