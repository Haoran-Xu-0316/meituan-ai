// Original practice materials for fictional SkillPal lessons.
// Keep runnable examples beside their input and expected output.
export const MERGE_SCRIPT = `from pathlib import Path
import csv


def merge_registrations(folder):
    """Merge two practice tables and keep one record per registration ID."""
    records = {}
    for filename in ["morning.csv", "afternoon.csv"]:
        with (folder / filename).open(encoding="utf-8-sig", newline="") as source:
            for row in csv.DictReader(source):
                registration_id = row["id"].strip()
                if not registration_id:
                    continue
                records[registration_id] = {
                    "id": registration_id,
                    "name": row["name"].strip(),
                    "skill": row["skill"].strip(),
                }
    output = folder / "result"
    output.mkdir(exist_ok=True)
    with (output / "registrations.csv").open("w", encoding="utf-8-sig", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=["id", "name", "skill"])
        writer.writeheader()
        writer.writerows(records.values())
    return list(records.values())


if __name__ == "__main__":
    merge_registrations(Path(__file__).resolve().parent)
`;
export const CLEAN_SCRIPT = `def clean_names(names):
    """Trim surrounding spaces, skip empty names and preserve first-seen order."""
    result = []
    seen = set()
    for name in names:
        cleaned = name.strip()
        if cleaned and cleaned not in seen:
            result.append(cleaned)
            seen.add(cleaned)
    return result


sample_names = [" cover.jpg ", "", "notes.txt", "cover.jpg", "  "]
cleaned_names = clean_names(sample_names)
`;
export const PROFILE_HTML = `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>小麦的作品页</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; background: #f7f8fa; color: #222; font-family: system-ui; }
  main { max-width: 620px; margin: 40px auto; padding: 28px; background: white; border-radius: 18px; }
  h1 { margin-top: 0; }
  p { line-height: 1.8; }
  .tags { display: flex; flex-wrap: wrap; gap: 8px; }
  .tags span { padding: 6px 12px; border-radius: 20px; background: #fff3b0; }
  article { border-top: 1px solid #eee; margin-top: 24px; }
</style>
<main>
  <h1>你好，我是小麦</h1>
  <p>我喜欢用照片记录日常，也在学习做自己的网页。</p>
  <div class="tags"><span>摄影</span><span>散步</span><span>网页设计</span></div>
  <article><h2>窗边的一杯咖啡</h2><p>用一张照片练习侧光与留白。</p></article>
</main>
</html>`;
export const TODO_HTML = `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>我的练习清单</title>
<style>
  body { max-width: 600px; margin: 40px auto; padding: 20px; font-family: system-ui; }
  form { display: flex; gap: 8px; } input { min-width: 0; flex: 1; padding: 10px; }
  li { display: flex; align-items: center; gap: 10px; margin: 12px 0; }
  li span { flex: 1; overflow-wrap: anywhere; } button { padding: 8px 12px; }
  li input { flex: none; } li input:checked + span { text-decoration: line-through; color: #777; }
</style>
<h1>今天想学什么？</h1>
<form id="add-task"><input id="task" aria-label="练习内容" maxlength="100" required><button>添加</button></form>
<p id="empty">还没有练习，写下第一件想完成的事。</p>
<ul id="tasks"></ul>
<p>本练习不保存数据，刷新后清空。</p>
<script>
const form = document.querySelector('#add-task');
const input = document.querySelector('#task');
const list = document.querySelector('#tasks');
const empty = document.querySelector('#empty');
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) { input.value = ''; input.focus(); return; }
  const item = document.createElement('li');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.setAttribute('aria-label', '完成：' + text);
  const label = document.createElement('span');
  label.textContent = text;
  const remove = document.createElement('button');
  remove.textContent = '删除';
  remove.setAttribute('aria-label', '删除：' + text);
  remove.addEventListener('click', () => { item.remove(); empty.hidden = list.children.length > 0; });
  item.append(checkbox, label, remove);
  list.append(item);
  empty.hidden = true;
  form.reset();
  input.focus();
});
</script>
</html>`;
const table = (title, columns, rows) => ({ type: "table", title, columns, rows });
const text = (title, content) => ({ type: "text", title, content });
const code = (title, content) => ({ type: "code", title, content });
export const WORKSHOPS = {
  lin: {
    title: "把两张活动报名表合并成一份名单",
    brief: "6条原始记录中有重复报名和空编号。清理后应剩下4位报名者。CSV可以用Excel打开，本样例只使用Python标准库。",
    blocks: [
      table("上午报名表 morning.csv", ["id", "name", "skill"], [["101", "小麦", "摄影"], ["102", "可可", "Figma"], ["103", "一禾", "Excel"]]),
      table("下午报名表 afternoon.csv", ["id", "name", "skill"], [["102", " 可可 ", "Figma"], ["104", "江望", "吉他"], ["空", "未填写", "Python"]]),
      text("先定整理规则", "编号为空的行跳过；姓名去掉前后空格；编号相同视为同一条报名，保留后出现的记录。这里按编号去重，不按姓名去重。"),
      code("完整参考脚本 merge_registrations.py", MERGE_SCRIPT),
      text("怎么使用", "下载两个CSV和脚本，放进同一个文件夹。在Python编辑器中打开并运行脚本，整理结果会写入该文件夹下的result/registrations.csv。两份原始表不会改动。"),
    ],
    challenge: "在下午表增加一行：105,沈眠,日语。再次运行，结果应有多少条？如果把这一行编号改为102，会发生什么？",
    answer: "新增105时结果有5条。改成102后结果仍有4条，原102的姓名和技能被最后一条记录替换。这也是运行前必须明确去重规则的原因。",
    expected: table("原始样例的清理结果", ["id", "name", "skill"], [["101", "小麦", "摄影"], ["102", "可可", "Figma"], ["103", "一禾", "Excel"], ["104", "江望", "吉他"]]),
    files: [{ name: "morning.csv", content: "id,name,skill\n101,小麦,摄影\n102,可可,Figma\n103,一禾,Excel\n" }, { name: "afternoon.csv", content: "id,name,skill\n102, 可可 ,Figma\n104,江望,吉他\n,未填写,Python\n" }, { name: "merge_registrations.py", content: MERGE_SCRIPT }],
    source: ["Python CSV文档", "https://docs.python.org/3/library/csv.html"],
  },
  zhou: {
    title: "做一张技能互换首页卡片",
    brief: "目标画板为390×844。先完成一张可复用的卡片，再复制成列表，不需要从整套App开始。",
    blocks: [
      table("可以直接照着搭的尺寸", ["元素", "设置", "内容"], [["画板", "390×844，左右留白20", "首页"], ["内容卡片", "宽350，内边距20，圆角16", "Python入门"], ["标题", "24px，粗体", "用Python整理报名表"], ["说明", "14px，行高22", "合并两张表，去掉重复编号"], ["按钮", "高度44，圆角10", "查看交换详情"]]),
      text("自动布局设置", "卡片使用纵向自动布局，内容间距12；文字宽度随容器填充、高度随内容变化；按钮铺满可用宽度。卡片底色白色，页面底色#F7F8FA，主按钮#FFD100。"),
      text("检查一个真实变化", "把标题换成“用Python合并三张活动报名表并清理重复记录”。标题换行后，说明和按钮应自然向下移动，不覆盖文字。"),
    ],
    challenge: "复制卡片，把技能换成摄影，把页面宽度改为320。保持左右各20的留白，卡片应多宽？",
    answer: "卡片应为280px。标题可以换行，按钮仍在内容下方。不要靠固定高度裁掉长标题。",
    expected: text("交付检查", "一个可复用的纵向卡片组件，长短标题都能正常显示，320px宽度下没有横向溢出。"),
  },
  chen: {
    title: "用6笔支出做出分类汇总",
    brief: "把下表放进Excel的A1:D7。先核对总额，再分别用公式和数据透视表汇总。",
    blocks: [
      table("原始支出表", ["日期", "类别", "项目", "金额"], [["2026-09-01", "餐饮", "午饭", "28"], ["2026-09-01", "交通", "地铁", "6"], ["2026-09-02", "餐饮", "晚饭", "32"], ["2026-09-03", "学习", "练习本", "18"], ["2026-09-03", "交通", "公交", "2"], ["2026-09-04", "餐饮", "早餐", "12"]]),
      code("分类求和公式", '=SUMIF(B2:B7,"餐饮",D2:D7)\n=SUMIF(B2:B7,"交通",D2:D7)\n=SUM(D2:D7)'),
      text("数据透视表怎么摆", "选中A1:D7，创建数据透视表；行区域放“类别”，值区域放“金额”，汇总方式选择求和。如果显示计数，先检查金额是否被存成了文本。"),
    ],
    challenge: "在原表增加一笔学习支出24元。分类汇总与总额分别变成多少？注意扩展公式范围或表格数据源后再刷新。",
    answer: "学习变为42元，餐饮仍为72元，交通仍为8元，总额变为122元。只在表外增加一行而不扩展范围，旧公式不会自动把它算进去。",
    expected: table("原始6笔的核对结果", ["类别", "金额"], [["餐饮", "72"], ["交通", "8"], ["学习", "18"], ["合计", "98"]]),
    files: [{ name: "expenses.csv", content: "日期,类别,项目,金额\n2026-09-01,餐饮,午饭,28\n2026-09-01,交通,地铁,6\n2026-09-02,餐饮,晚饭,32\n2026-09-03,学习,练习本,18\n2026-09-03,交通,公交,2\n2026-09-04,餐饮,早餐,12\n" }],
    source: ["Microsoft SUMIF说明", "https://support.microsoft.com/en-us/excel/functions/sumif-function"],
  },
  xu: {
    title: "把空泛的自我介绍改成一个具体故事",
    brief: "练习角色是准备产品实习面试的学生Mia。下面是虚构范例，使用时换成自己的真实经历。",
    blocks: [
      text("修改前", "My name is Mia. I am hard-working and responsible. I like teamwork, and I want to learn more about product management."),
      text("修改后", "Hi, I'm Mia, a university student interested in product design. In a campus project, I helped organize a skill-sharing event. I noticed that students signed up but often missed the sessions, so I interviewed five participants and redesigned the reminder message. I learned to start with a specific user problem and test a small change. I'm looking for a product internship where I can keep practicing that approach."),
      table("逐句看结构", ["部分", "要回答的问题", "范例信息"], [["背景", "你是谁？", "学生，关注产品设计"], ["行动", "你具体做过什么？", "访谈参与者，改写提醒消息"], ["收获", "你学到了什么？", "从具体问题开始，验证小改动"], ["目标", "为什么来这里？", "希望在产品实习中继续练习"]]),
      text("追问练习", "Q: What did you change in the reminder?\nA: I made the time and preparation list easier to find. I also added a simple way to confirm attendance.\n没有统计结果就不要编造提升比例，可以如实说明你观察到了什么、还没有验证什么。"),
    ],
    challenge: "用自己的一个项目替换事件、行动与收获，先讲40至60秒，再请伙伴追问一个细节。",
    answer: "检查能否回答“我做了什么”和“为什么这么做”。删掉没有事实支撑的形容词；时间取决于语速，先讲清楚，不必逐字背诵范文。",
    expected: text("完成标准", "听者能复述你的一个具体行动；你能不用照读，回答一次关于该行动的追问。"),
  },
  lu: {
    title: "同一只杯子，拍出三种画面",
    brief: "用手机、杯子和窗边桌面就能练习。没有自然光时，用一盏台灯从侧面照亮杯子。",
    blocks: [
      table("三张照片的拍摄任务", ["照片", "怎么摆", "看什么"], [["A：记录原样", "杯子放桌面中间，保留原有杂物", "背景是否抢走注意力"], ["B：简化背景", "拿走包装袋与线缆，镜头与杯口接近同一高度", "主体边缘是否清楚"], ["C：调整光线", "让光从杯子侧前方照来，杯子放在画面左侧约三分之一处", "明暗层次和右侧留白"]]),
      text("曝光练习", "点击杯子对焦。如果白杯表面亮得没有细节，轻轻调低曝光；若阴影太暗，可在另一侧放一张白纸反光。不要照搬固定参数，观察杯口和杯身的细节。"),
      text("如何比较", "把三张照片排在一起，只比较背景、主体位置和光线。先不加滤镜。分别写一句“这一张我改变了什么”。"),
    ],
    challenge: "选出一张作为咖啡店菜单配图。画面需要在右侧放标题，哪一张更适合？为什么？",
    answer: "按上述布置，C通常更合适，因为右侧有留白可放标题；但若杯子边缘过暗，应先调整补光再选。评价依据是实际照片，不是步骤编号。",
    expected: text("交付内容", "三张同主体对照照片和三句拍摄说明。选片时能指出背景、留白和亮部细节的区别。"),
  },
  jiang: {
    title: "用Em与G完成四小节伴奏",
    brief: "使用标准调弦。指法数字按第6弦到第1弦排列：0是空弦，x是不弹，数字是品位。",
    blocks: [
      table("四个和弦的指法参考", ["和弦", "第6弦→第1弦", "本节要求"], [["Em", "0 2 2 0 0 0", "重点练习"], ["G", "3 2 0 0 0 3", "重点练习"], ["C", "x 3 2 0 1 0", "认识指法"], ["D", "x x 0 2 3 2", "认识指法"]]),
      code("四小节练习谱", "| Em       | Em       | G        | G        |\n| 1 2 3 4  | 1 2 3 4  | 1 2 3 4  | 1 2 3 4  |\n  ↓ ↓ ↓ ↓    ↓ ↓ ↓ ↓    ↓ ↓ ↓ ↓    ↓ ↓ ↓ ↓"),
      text("练习顺序", "先逐弦拨响Em，找出闷音；再单独练G。用自己能稳定跟上的速度，每拍向下扫一次。换和弦来不及时，可以先停下摆好，再重新开始，不需要硬追速度。"),
    ],
    challenge: "将四小节改成Em、G、Em、G。录一段练习，标出在哪一小节换和弦时停顿。",
    answer: "每小节仍有4拍。先检查换和弦的手指是否同时移动，再降低速度重复练习。初学时以声音清楚和拍数稳定为准，不要求第一节就流畅弹唱。",
    expected: text("完成标准", "能辨认Em与G，完成四小节慢速伴奏，并说出自己最需要练的一次转换。"),
  },
  song: {
    title: "一份能直接打开的个人介绍页",
    brief: "下载HTML文件，用浏览器打开就能看到成品。用编辑器修改姓名、简介和兴趣，再刷新观察变化。",
    blocks: [code("完整页面 profile.html", PROFILE_HTML), text("三个值得观察的地方", "max-width限制阅读宽度；box-sizing让内边距算进元素宽度；flex-wrap让兴趣标签在窄屏时换行。页面没有依赖外部图片和字体。")],
    challenge: "增加第二个作品“周末的街角”，再把昵称改成一段较长的名字。检查390px与320px宽度下是否能正常阅读。",
    answer: "复制一个article并修改标题与描述。正文采用自然换行，标签容器允许换行；不要给主容器设置比屏幕还宽的固定宽度。",
    expected: text("完成标准", "页面显示你的介绍、三个兴趣标签和两项作品；窄屏时不用左右拖动阅读。"),
    files: [{ name: "profile.html", content: PROFILE_HTML }],
  },
  he: {
    title: "把冲咖啡的素材剪成30秒短片",
    brief: "用自己拍摄的6个镜头完成练习。先剪清楚过程，不加复杂转场。",
    blocks: [
      table("可以照着剪的时间线", ["时间", "画面", "声音与字幕"], [["0–3秒", "成品咖啡的近景", "字幕：给自己留半分钟"], ["3–7秒", "拿杯子、放滤杯", "保留器具轻响"], ["7–12秒", "倒入咖啡粉", "字幕：准备"], ["12–20秒", "缓慢注水", "保留水声，删除等待停顿"], ["20–26秒", "拿起杯子", "字幕：慢一点，也很好"], ["26–30秒", "窗边放下杯子", "自然结束，声音渐弱"]]),
      text("剪辑检查", "先按顺序排齐镜头，再修剪每段头尾的晃动。字幕放在同一区域，避开画面主体；如果配乐盖过水声，降低配乐音量。使用有权使用的素材与音乐。"),
    ],
    challenge: "把同一组素材压缩成15秒。保留开头、过程、结尾，你会怎样分配时间？",
    answer: "一种参考分配是成品2秒、准备2秒、咖啡粉2秒、注水5秒、拿杯2秒、窗边2秒，总计15秒。优先删重复动作，不要把所有镜头简单加速。",
    expected: text("交付内容", "30秒版本和15秒版本各一条；两条都能让没看过素材的人理解发生了什么。"),
  },
  tang: {
    title: "把文件名清单整理成可用列表",
    brief: "只处理字符串，不改动真实文件。空白、重复和输入顺序都需要有明确规则。",
    blocks: [
      code("输入", '[" cover.jpg ", "", "notes.txt", "cover.jpg", "  "]'),
      code("完整参考函数 clean_names.py", CLEAN_SCRIPT),
      text("为什么需要seen", "result保存输出顺序，seen负责判断是否已经出现。先strip再去重，才能把“ cover.jpg ”与“cover.jpg”识别为同一项。该样例区分大小写。"),
    ],
    challenge: "输入[\"A.jpg\", \"a.jpg\", \" A.jpg \"]时输出什么？如果希望不区分大小写，应该改哪一处？",
    answer: "当前输出为['A.jpg', 'a.jpg']。若要忽略大小写，可用cleaned.casefold()作为seen中的比较键，同时继续把第一次出现的原始写法保存到result。",
    expected: code("原样例输出", "['cover.jpg', 'notes.txt']"),
    files: [{ name: "clean_names.py", content: CLEAN_SCRIPT }],
  },
  shen: {
    title: "在餐厅点一杯水和一份咖喱饭",
    brief: "先练三个完整句子，再通过替换食物名称扩展。示例对话用于语言练习。",
    blocks: [
      table("点餐对话", ["角色", "日语", "意思"], [["顾客", "すみません。メニューをお願いします。", "不好意思，请给我菜单。"], ["店员", "はい、どうぞ。", "好的，请看。"], ["顾客", "カレーを一つお願いします。", "请给我一份咖喱饭。"], ["顾客", "お水もお願いします。", "也请给我水。"]]),
      table("听不懂时可以说", ["日语", "读法提示", "意思"], [["もう一度お願いします。", "mō ichido onegaishimasu", "请再说一次。"], ["ゆっくりお願いします。", "yukkuri onegaishimasu", "请慢一点。"]]),
      text("替换练习", "将カレー替换成サンドイッチ，再完整说出“サンドイッチを一つお願いします”。先保证整句能表达需求，再练发音细节。"),
    ],
    challenge: "伙伴扮演店员，说一句你没有听清的话。请先请求重复，再点一份咖喱饭。",
    answer: "可以先说“もう一度お願いします”，听清后再说“カレーを一つお願いします”。不用因为没听懂一个词就放弃整个对话。",
    expected: text("完成标准", "不看中文提示，完成请求菜单、点餐和请求重复三种表达。"),
  },
  gu: {
    title: "从四拍节奏认识C大三和弦",
    brief: "先用拍手感受节拍，再用键盘图或键盘工具寻找C、E、G。没有乐器也可以先完成节奏部分。",
    blocks: [
      code("四拍练习", "数拍：  1   2   3   4\n练习A： 拍  拍  拍  拍\n练习B： 拍  停  拍  停\n说明：停拍时心里仍然数数，下一次拍手不提前。"),
      table("从C往上数半音", ["两个音", "半音数", "名称"], [["C→E", "4", "大三度"], ["C→G", "7", "纯五度"], ["C、E、G同时发声", "以C为根音", "C大三和弦"]]),
      text("动手找音", "在键盘上相邻的键之间，包括黑键，算一个半音。C到E依次经过C♯、D、D♯、E；不要只数白键。"),
    ],
    challenge: "C到E♭有几个半音？把C大三和弦中的E降为E♭，会得到什么？",
    answer: "C到E♭有3个半音，是小三度。C、E♭、G组成C小三和弦。听感比较可作为练习，但不把大和弦与快乐、小和弦与悲伤简单画等号。",
    expected: text("完成标准", "能稳定数四拍，指出C到E与C到G的半音数，并在键盘图上找出C、E、G。"),
  },
  wen: {
    title: "给网页加一个真正能用的练习清单",
    brief: "示例支持添加、勾选完成和删除，并拒绝空白输入。下载后用浏览器打开，不需要安装依赖。",
    blocks: [code("完整页面 todo.html", TODO_HTML), text("三个交互点", "submit事件同时支持点击按钮和回车；textContent把输入作为文字显示；删除后重新检查条目数，决定是否展示空状态。")],
    challenge: "依次添加“练摄影”和“读Python”，勾选第一项，再删掉两项。空状态是否恢复？输入一串空格会怎样？",
    answer: "删完最后一项后恢复空状态；空白输入被trim后拒绝。刷新会清空内容，这是本练习的明确边界；想保留数据，需要再学习本地存储。",
    expected: text("完成标准", "回车能添加条目，勾选后出现删除线，删除最后一项后恢复提示，输入HTML标签也只显示为文字。"),
    files: [{ name: "todo.html", content: TODO_HTML }],
    source: ["MDN DOM操作", "https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Building_and_updating_the_DOM_tree"],
  },
};

export function workshopText(workshop) {
  const format = (block) => block.type === "table"
    ? [block.columns.join("\t"), ...block.rows.map((row) => row.join("\t"))].join("\n")
    : block.content;
  return [
    workshop.title, workshop.brief,
    ...workshop.blocks.flatMap((block) => [block.title, format(block)]),
    workshop.expected.title, format(workshop.expected),
    "自己试一试", workshop.challenge,
    "参考答案", workshop.answer,
    ...(workshop.source ? ["参考资料", workshop.source[1]] : []),
  ].join("\n\n") + "\n";
}
