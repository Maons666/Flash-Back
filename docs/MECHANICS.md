# 技能参数与复现范围

资料查阅日期：2026-11-02。目标：国际服 PC，参考版本 13.09，程序 v0.9。程序使用原创模型、原创声音，不提取官方资源。尚无游戏内实测录像，不能给出相对真实游戏的绝对误差。下表区分公告数值、推算和训练建模；公开的时长也不能单独证明全白、残影与渐隐阶段已经匹配。

| 特工 | 已实现的关键规则 | 本程序时序 | 公开出处 |
| --- | --- | --- | --- |
| Hush | 可改向、触碰表面引爆、到时引爆 | 默认引信 1.15s / 满闪 1.5s，**未证实的可调训练值** | [13.09](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-1309/) |
| Phoenix | 左/右固定曲线，碰障碍停下，到时引爆 | 0.6s 前摇，1.5s 满闪 | [11.00](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-11-00/)、[5.01](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-5-01/) |
| Breach | 在实际墙面显现，爆点仍需视线 | 显现后 0.5s 前摇，2.25s 满闪；不含施放者侧的部署行程 | 前摇：[1.07](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-1-07/)，时长：[11.08](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-11-08/) |
| Skye | 飞行→激活→引爆；不可射毁；到时自动激活 | 0.45s / 1.25s / 2s 飞行情景，另外加 0.3s 引爆前摇；0.75s 蓄力到 2.25s，短飞行时长按线性插值推算 | 前摇：[3.06](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-3-06/)，蓄力：[5.07](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-5-07/)，最长飞行：[7.04](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-7-04/)，自动激活：[8.01](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-8-01/)；飞行路线仍为预设 |
| KAY/O | 上手与下手，物理反弹，上手反弹后缩短引信 | 上手 1.6s、下手 1s 为待独立实测基线；反弹取 min(原剩余时间,0.8s)，满闪均 2.25s | 反弹：[10.06](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-10-06/)，下手时长：[11.08](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-11-08/)，上手时长：[5.07](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-5-07/) |
| Yoru | 首次反弹后显现和激活；碰撞法线决定反弹方向；分身被射击才触发 | 反弹后 0.6s / 满闪 1.5s；分身 0.5s 前摇待实测 / 满闪 2s | 激活：[2.06](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-2-06/)，时长：[11.08](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-11-08/)；分身锥形角度、轨迹和弹速为训练值 |
| Vyse | 墙面闪，前摇中可射毁 | 0.5s 前摇，2s 满闪 | [官方特工](https://playvalorant.com/en-us/agents/vyse/)、[11.08](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-11-08/)；前摇为训练基线 |
| Gekko | 头部或身体可见可锁定；到期停止新发射；已发射电浆独立飞行 | 0.65s 部署待实测，0.35s 锁定，活动期 1s；电浆按公告 10000 单位换算为 100m/s；遮挡总计 2s 及渐隐待实测 | 锁定：[7.12](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-7-12/)，活动期：[9.08](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-9-08/)，身体可见性：[12.08](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-12-08/)；身体采样点、溅射半径仍为近似 |

其他练习：Reyna 的魔眼持续视线近视、Omen 的穿墙暗魇、Fade 的黯兽、Harbor 的涡流和水浪。Omen 弹速采用 20m/s、最长行进 25m；近视场景约 7m 可视范围。Harbor 涡流不要求视线。依据 [11.08](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-11-08/)、[12.00](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-12-00/)、[12.02](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-12-02/)。它们是专项练习，不代表所有特工的完整技能组。

## 判定实现

移动与碰撞使用不超过 1/240 秒的子步，已知引信、激活、锁定等定时事件精确分割到事件边界；重力自由飞行使用解析位移。线段/AABB 求接触比例，碰撞时刻用于引信，反弹后继续处理剩余子步；重力曲线接触点仍是子步内线性近似。移动允许贴墙滑行。射线从玩家眼睛到实际爆点，中间墙体遮挡普通闪光；Breach 的穿墙施放不等于爆炸效果穿透所有墙。Omen 和 Harbor 范围效果另行处理。场地比例、玩家胶囊和运动加减速仍未用实测标定。

可见性采用与 103°、16:9 相机一致的矩形视锥。桌面反应时钟从该技能首次被提交绘制起计，不把未显示的模拟子步算作用户已看见；仍无法测量显示器实际亮起时刻。转身达到 8° 或移动 0.2m 的时间作为动作反应，属于训练统计口径。输入事件先推进到当前时刻，再更新朝向，避免把新朝向用于过去的模拟时刻。闪屏每个显示帧刷新；超过 100ms 的主线程卡顿会暂停，避免静默丢时间。

Reyna 采用公告 2.0s 总存续、包含 0.4s 前摇的解释，生效窗口 1.6s；口径标为规则推算，仍需录像核实。移开视线、遮挡、到期或击毁后清除持续近视，不再额外保留 60ms。

普通闪光的角度包含垂直视角。没有用户采样时，`flashExposure()` 对 0–45° 给满值，45–100° 衰减到 13%，100–180° 衰减到 5%；超过 25m 后继续距离衰减。**这整条曲线是训练近似，并非官方引擎规则。** 有有效采样时，在采样角度和距离网格内双线性插值绝对受闪时间；不向采样距离之外外推，超出范围回退近似并记录 `outside-samples`。100° 仍只是本工具的评分阈值；全屏遮罩的保留/渐隐分配仍为近似。时长采样不会自动校准亮度、残影图案或音效。

默认训练固定位置前方生成技能，左右偏移可指定；自由移动时相对当前站位生成；墙面技能会查询实际墙面。投掷者的操控由预设脚本代理，没有复刻特工出手动画、投掷手感、所有实战 line-up、网络延迟或伺服器的逐帧同步。

视角采用 `counts × sensitivity × 0.07°`，DPI 只计算 cm/360，不二次缩放。0.07 为通用社区实测基线，并非 Riot 在上述公告中公开的常量。16:9 的水平 103° 转成透视相机的垂直 FOV。原始输入请求失败时回退并明确提示校准；请用游戏内实测验证 DPI、系统与硬件链路。

## 后续精度校准

若要追求逐帧复现，需要当前国际服版本的实测录像或可靠测量。优先核对 Hush 引信/转向、各技能后向残闪曲线、可见前摇、爆点大小、音频提示、玩家移动加减速和视角高度。逐步操作见 [校准说明](CALIBRATION.md)。默认时序与字段出处在 `src/data.js`，校准验证与采样插值在 `src/accuracy.js`，状态机在 `src/engine.js`，基础衰减在 `src/math.js`。用户数据不升级为“官方值”。
