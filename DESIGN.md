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
- Matching uses an unboxed pair of skill groups on a white summary surface with a yellow exchange symbol; exchanges show status-derived next steps, rounded filter tabs and a connected lesson timeline. Profile skill panels distinguish teaching from learning. Page headings enter briefly on route changes, without moving forms or replaying on field edits.
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

The SkillPal mark is a single open S monogram with broad curves and a diagonal connection, set inside a Meituan-yellow rounded square. Two compact filled arrowheads finish the S in opposite directions to express reciprocal exchange. Rounded joins and open negative space preserve clarity at small sizes. The wordmark uses Avenir Next when available, falling back to Segoe UI and sans-serif, with consistent weight across Skill and Pal. Sidebar, mobile header, footer and favicon share assets/skillpal-mark.svg, at 36px, 32px and 22px respectively.
