---
name: SkillPal
description: Online skill exchange in a bright yellow service interface
---

# SkillPal Design

## Overview

Operate模式。白天在电脑或手机上寻找学习伙伴，优先清晰地完成供需匹配。美团黄是用户确认的品牌约束。双向技能卡是核心识别元素。

## Colors

品牌#FFD100，柔黄#FFF8D6，底色#F6F6F2，白色#FFFFFF，主字#24271F，次字#666873。技能分类使用低饱和辅助色，仅帮助辨识。

## Typography

系统无衬线字体，中文苹方；正文14–16px，页面标题28–40px，发现首屏使用38–58px双行标题，手机34px。品牌英文采用系统粗体，避免外部字体依赖。

## Layout

桌面208px侧栏、72px顶栏，主区最大1400px。发现首屏采用白色双栏构图，左侧是双行标题和匹配入口，右侧以黄色圆面衬托一白一深的立体供需卡。卡片直接显示当前用户的教学与学习技能，避免另设重复供需栏。手机上下排列，体验说明折叠在底部。下面直接呈现分类与技能卡。900px以下改为底部导航，600px以下单列。

## Elevation & Depth

普通卡片使用细边框，无大范围阴影。浮层使用轻阴影。页面留白与分区承担层级。

## Shapes

卡片16px、操作按钮10px，标签和分类使用胶囊形。

## Components

双向技能卡同时显示能教与想学。主操作黄底深色文字；匹配解释为文本。表单错误紧邻字段。原生dialog保护焦点，消息用live region。

## Do's and Don'ts

保持演示标识、具体学习成果、清晰状态和可见焦点。不伪造认证、真实发送、用户量和AI匹配百分比。减少动画设置受尊重。

## Information Hierarchy

详情先并排展示能教与想学，再呈现课程内容与预约操作。课程安排、准备、练习、个人经历和反馈完整保留，默认通过折叠面板按需阅读。时间与匹配说明集中一处。手机仅显示固定的交换按钮，隐藏正文中的重复按钮。

首页技能卡使用218px照片区，手机202px；照片底部使用深色遮罩承托白色技能名，正文独立呈现具体学习成果。卡片保留技能、伙伴、教学成果、学习需求和入口，删除重复口号、通用副标题与重复时长说明。全局导航和业务页标题使用直接的功能名称。

## Glass and motion

The visual direction references the pointer-responsive material and depth of ThreeUI's Holographic Glitter Card, with an original implementation for SkillPal. The site uses CSS 3D transforms, native Web Animations and backdrop blur; it does not require Three.js or a WebGL canvas.

- Keep Meituan yellow, readable white card bodies and all twelve distinct lesson images.
- Two perspective tiles in the introduction show the actual teaching and learning skills, with a translucent teaching surface and graphite learning surface. Multiple skills use compact type and omit decorative icons to keep all content visible. Pointer movement changes their perspective. Two orbital light points and gently floating tiles animate only while the introduction is visible and the document is foregrounded.
- Cards tilt at most 4.5 degrees per axis, with a small counter-moving photograph parallax. Reflection, elevation and shadow respond to the pointer, while touch devices retain normal scrolling and press feedback.
- Cards enter in a short stagger when the visible partner collection changes; favorite updates do not replay the entire grid. New cards still reveal as they enter the viewport, and content remains visible if animation APIs are unavailable.
- The header contains only search and publishing. The optional reduce-motion checkbox lives under the profile display preferences, persists separately from learning records, and respects the system setting.
- Matching uses a graphite supply-and-demand strip with a yellow exchange symbol; exchanges show status-derived next steps, rounded filter tabs and a connected lesson timeline. Profile skill panels distinguish teaching from learning. Page headings enter briefly on route changes, without moving forms or replaying on field edits.
- Each render disposes observers, animation frames and listeners. Hidden tabs and scrolling clear transient pointer state.
- Glass surfaces have opaque fallbacks; navigation, focus outlines and publishing remain usable on narrow screens.

Reference: https://threeui.com/three-js/holographic-glitter-card


## Continuous component transitions

- Keep the navigation and search shell mounted between renders. Preserve the discovery sculpture and its disclosure state during category and favorite changes.
- Navigation, mobile navigation, categories and exchange status share a sliding selection surface. Capture its current visual bounds before each update, including during interrupted motion, then stretch and settle into the next selection in 440ms.
- Page content fades in 300ms; form steps and exchange filters add a small directional entrance. Cards use a shorter 360ms reveal. Native disclosures animate height in 320ms and reverse from their current state.
- Reduced motion cancels pending transitions. Route cleanup releases animation, click and resize observers. No animation delays a state update or blocks input.
- Remove redundant page subtitles and compress the guide and status explanations; retain concrete lesson content and demo labels.


## State-to-state component switching

Supported browsers capture old and new component states through View Transitions. Cards retain a stable visual identity and interpolate position and size when filtering; removed cards fade out. Page content has coordinated exit and entry, and publishing panels interpolate their height while steps slide in the appropriate direction. Navigation and the hero remain separate stable layers.

A revision-aware renderer skips superseded requests and restores scrolling or focus only after the current DOM commit. Native snapshot transitions suppress duplicate card entrances; older browsers retain the existing liquid and disclosure fallback. Reduced motion bypasses scene transitions.


## Brand mark

The SkillPal mark uses two opposing curved arrows that suggest an S inside a Meituan-yellow rounded square. A diagonal gap separates the two strokes; compact open arrowheads and consistent optical weight keep the exchange motif legible at small sizes. The wordmark uses Avenir Next when available, falling back to Segoe UI and sans-serif, with consistent weight across Skill and Pal. Sidebar, mobile header, footer and favicon share assets/skillpal-mark.svg, at 36px, 32px and 22px respectively.


## Matching and learning outcomes

The discovery grid ranks reciprocal matches first and displays what each side teaches, shared time and level suitability on those cards. The matching empty state preserves the user's stated needs and offers up to three partners who can teach a requested skill, explicitly marked as not yet reciprocal; favorites remain the lightweight follow-up mechanism.

A partially fulfilled exchange cannot silently terminate through cancellation: it becomes pending rescheduling, stays in the ongoing list, releases paused time reservations and preserves completed lessons. The rescheduling dialog changes only unfinished lessons, checks future dates and booking conflicts, and explicitly simulates both parties agreeing. Untouched exchanges can still be cancelled normally.

Each lesson carries its original goal through completion. Participants record whether the goal was achieved or further help is needed, the concrete learning note and an optional HTTP(S) artifact link. Completing two sessions and achieving both goals are separate states; unmet goals remain visible after evaluation. Existing saved lessons remain compatible.


## Reciprocal offer composition

匹配页采用全宽横向交换卡，避免少量候选在三列网格中留下大片空白。左侧使用伙伴独有的课程照片，叠加磨砂玻璃双向技能面板；右侧依次呈现身份、具体课程成果、对方的学习目标、共同常用时段与教学形式。匹配原因按需展开。首位沿用现有匹配排序，用黄色主按钮突出；不虚构匹配分数、认证或成交数据。移动端自然转为照片在上的单列结构。

公共搜索栏采用半透明白色、背景模糊和内侧高光，聚焦时背景变实、提交箭头变黄。正文卡片保持清晰实底，玻璃只用于浮于照片或内容之上的操作层。详情页顶部复用同一课程照片与技能标题，保持从匹配到课程的视觉连续性。照片均保留AI场景标识。

大面积匹配卡的指针倾斜限制为约1度，沿用现有可中断页面过渡、折叠展开动画和滑动导航。收藏保留卡片身份，不重播整个列表；系统与用户减少动态设置继续生效。


## Interaction continuity

保留已确认的页面分区、横卡尺寸、照片比例和移动端排列。匹配卡和详情主按钮优先进入已有未结束交换，按实际状态显示查看邀请、继续交换、安排补课或记录评价；更改个人供需不会阻断已有约定。

收藏在原位置更新按钮和无障碍状态，不重绘页面，不收起说明，不丢失焦点；从收藏列表移除伙伴时将焦点交给下一位或收藏标题。返回已浏览页面时恢复阅读位置和展开内容，按伙伴身份保存说明状态；发起新搜索则直接定位到结果区。收藏确认仅有一次短反馈，键盘操作保留清晰焦点，减少动态设置继续生效。


## Invitation continuity and recovery

邀请按伙伴分别保存本机草稿，包含双方技能、具体目标、两次时间、形式和留言。离开页面或刷新后恢复未完成输入，空字段仍为空；重新选择技能时清除对应旧目标。资料变化导致所选技能不再可用时，重新匹配技能并要求重填该课程目标。草稿日期不自动改期，提交时重新检查未来14天、课程顺序和占用情况。成功生成邀请后仅清除该伙伴的草稿，损坏草稿不影响资料、收藏和已有交换。

发现页存在任一搜索或筛选条件时显示重置筛选，清除搜索按钮仍只清除关键词。邀请错误携带对应字段信息，第二节时间冲突、顺序错误或重叠会定位第二节，保留其他输入。沿用当前页面布局和过渡，草稿状态不触发整页重绘。
