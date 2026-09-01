/* ============================================================
   《绿神话》12 个月事件静态数据
   题面、选项、数值均以《游戏规则.MD》为准。
   每月 = { month, title, steps: [...] }
   步骤类型：
     companyChoice   企业录入选择 → 统一揭示 → 结算
     governmentChoice 政府政策选择（含财政红线）
     diceCheck       掷骰（自动/手动）
     autoEvent       自动结算（按资产/条件判定）
     awardCeremony   年终颁奖录入
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GreenEvents = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- 资产图标 ---------- */
  const ASSET_META = {
    rooftopPV: { name: "屋顶光伏", icon: "☀" },
    battery: { name: "蓄电池", icon: "🔋" },
    oneWayCharger: { name: "单向充电桩", icon: "🔌" },
    twoWayCharger: { name: "双向充电桩", icon: "⚡" },
  };

  /* ---------- 通用：生态奖惩（2 / 8 / 11 月复用） ----------
     力度一致、奖惩并行：政府只选从轻/从重一档，
     处罚生态最低企业 + 奖励生态最高企业同时生效（财政罚入奖出相抵净 0） */
  function ecoRewardPunishStep(month) {
    return {
      type: "governmentChoice",
      id: `m${month}-ecoPolicy`,
      title: "生态奖惩",
      prompt:
        "为了推动环保目标的实现，政府决定根据企业的生态表现进行相应的惩罚或奖励。环保做得最差的企业将受到处罚，而表现突出的企业则会获得奖励，奖惩力度保持一致并同时执行，政府选择从轻还是从重？",
      government: {
        target: "ecoExtrema", // 系统自动找出生态最高/最低企业，政府选力度（奖惩并行）
        options: [
          {
            id: `m${month}-ecoBothLight`,
            label: "从轻奖惩",
            detail: "生态最低企业经济 -10，生态最高企业经济 +10，财政不变（罚入奖出相抵）",
            apply: { target: "ecoBoth", economyPunish: -10, economyReward: +10 },
          },
          {
            id: `m${month}-ecoBothHeavy`,
            label: "从重奖惩",
            detail: "生态最低企业经济 -20，生态最高企业经济 +20，财政不变（罚入奖出相抵）",
            apply: { target: "ecoBoth", economyPunish: -20, economyReward: +20 },
          },
        ],
      },
    };
  }

  /* ---------- 12 个月流程 ---------- */
  const MONTHS = [
    /* ================ 1 月 ================ */
    {
      month: 1,
      title: "扩大产能，选择设备",
      steps: [
        {
          type: "companyChoice",
          id: "m1-equipment",
          title: "设备采购",
          prompt:
            "新年伊始，企业为迎接市场需求的高峰，决定扩大产能，你们决定购买哪个设备？",
          timer: true,
          options: [
            {
              id: "m1-A",
              key: "A",
              label: "不购买新设备",
              detail: "保持现状，省钱省事，也许是个安全的选择？",
              cost: 0, monthly: 3, ecology: -15,
            },
            {
              id: "m1-B",
              key: "B",
              label: "高产能高能效设备",
              detail: "最新节能科技，产能翻倍，能效惊人，环保与效益两不误！",
              cost: -30, monthly: 5, ecology: -10,
            },
            {
              id: "m1-C",
              key: "C",
              label: "设备升级改造",
              detail: "升级现有设备，花小钱提升产能，既节省成本，又提高效率！",
              cost: -20, monthly: 5, ecology: -15,
            },
            {
              id: "m1-D",
              key: "D",
              label: "超高产能低能效设备",
              detail: "购入【超高产能的猛兽设备】，产量翻3倍，但环保压力倍增，敢挑战吗？",
              cost: -30, monthly: 7, ecology: -25,
            },
          ],
        },
      ],
    },

    /* ================ 2 月 ================ */
    {
      month: 2,
      title: "建筑围护结构改造",
      steps: [
        {
          type: "companyChoice",
          id: "m2-envelope",
          title: "围护结构改造",
          prompt:
            "你们正在考虑对建筑围护结构进行改造。这一改造会对建筑的功能和运行成本产生影响，你们会选择？",
          timer: true,
          options: [
            {
              id: "m2-A", key: "A",
              label: "不改造，维持原状",
              detail: "继续使用现有建筑围护结构，不进行改造",
              cost: 0, monthly: 0, ecology: -10,
            },
            {
              id: "m2-B", key: "B",
              label: "进行改造",
              detail: "对建筑围护结构进行改造，提升建筑性能，但需要投入额外资金。",
              cost: -15, monthly: 5, ecology: 0,
            },
          ],
        },
        ecoRewardPunishStep(2),
      ],
    },

    /* ================ 3 月 ================ */
    {
      month: 3,
      title: "团建选择与疫情事件",
      steps: [
        {
          type: "companyChoice",
          id: "m3-teambuilding",
          title: "团建地点",
          prompt:
            "上个月企业效益爆棚，管理层决定奖励大家一场别开生面的团建活动。问题来了——你们会选择去哪里？",
          timer: true,
          options: [
            {
              id: "m3-A", key: "A",
              label: "飞跃大洋去美国",
              detail: "（后因签证被拒，改为去北京环球影城）",
              cost: 0, monthly: -5, ecology: -5,
            },
            {
              id: "m3-B", key: "B",
              label: "去新疆阿勒泰骑马",
              detail: "长距离出行，成本和碳排放都高",
              cost: 0, monthly: -10, ecology: -10,
            },
            {
              id: "m3-C", key: "C",
              label: "在公司楼下的马路边种树",
              detail: "低碳选项，同时改善企业生态表现",
              cost: 0, monthly: 0, ecology: +5,
            },
          ],
          /* 团建疫情后果：随选择直接结算 */
          followUp: {
            note: "突发事件：疫情爆发！",
            effects: {
              "m3-A": { economy: -5, note: "环球影城人群密集，部分员工感染" },
              "m3-B": { economy: -10, note: "新疆骑马员工被困酒店隔离" },
              "m3-C": { economy: 0, note: "公司楼下种树员工未受影响" },
            },
          },
        },
      ],
    },

    /* ================ 4 月 ================ */
    {
      month: 4,
      title: "政府应对公共卫生危机",
      steps: [
        {
          type: "governmentChoice",
          id: "m4-publicHealth",
          title: "公共卫生决策",
          prompt:
            "突如其来的疫情爆发引发了公共卫生危机，政府需要迅速决策以应对当前的紧急情况。企业的生产和运营将受到政府政策的直接影响，你们将如何决策？",
          government: {
            options: [
              {
                id: "m4-A",
                label: "停工停产",
                detail: "全部企业暂停生产，每家企业经济 -10",
                apply: { target: "all", economy: -10, finance: 0 },
              },
              {
                id: "m4-B",
                label: "继续正常生产",
                detail: "各企业继续掷骰子决定员工感染情况",
                apply: { target: "all", economy: 0, finance: 0 },
                triggersDice: "m4-dice",
              },
            ],
          },
        },
        {
          type: "diceCheck",
          id: "m4-dice",
          title: "疫情掷骰",
          note: "各企业分别掷骰（自动或实体骰录入）",
          perCompany: true, // 每家企业单独掷
          results: [
            { faces: [1, 2], key: "B1", label: "员工大规模阳了，无法工作", economy: -10, ecology: 0 },
            { faces: [3, 4], key: "B2", label: "部分员工阳了，效率下降", economy: -5, ecology: 0 },
            { faces: [5, 6], key: "B3", label: "大家都是天选打工人", economy: 0, ecology: 0 },
          ],
        },
      ],
    },

    /* ================ 5 月 ================ */
    {
      month: 5,
      title: "屋顶光伏安装",
      steps: [
        {
          type: "companyChoice",
          id: "m5-pv",
          title: "光伏决策",
          prompt:
            "公司面临是否在厂房屋顶安装光伏系统的选择，决策会影响未来的能源使用方式和电力费用，你们的选择是？",
          timer: true,
          options: [
            {
              id: "m5-A", key: "A",
              label: "不安装光伏",
              detail: "继续维持现状，从电网买电",
              cost: 0, monthly: 0, ecology: -10,
              grants: {},
            },
            {
              id: "m5-B", key: "B",
              label: "全额上网模式",
              detail: "光伏发电全部并入电网售电，企业不自用，通过售电获取收益",
              cost: -20, monthly: 2, ecology: +10,
              grants: { rooftopPV: true },
            },
            {
              id: "m5-C", key: "C",
              label: "自发自用，余电上网",
              detail: "企业优先使用光伏电力，剩余电力送入电网（更利于后续停电自备电力）",
              cost: -20, monthly: 2, ecology: +10,
              grants: { rooftopPV: true },
            },
          ],
        },
      ],
    },

    /* ================ 6 月 ================ */
    {
      month: 6,
      title: "政府对光伏企业补贴",
      steps: [
        {
          type: "governmentChoice",
          id: "m6-pvSubsidy",
          title: "光伏补贴决策",
          prompt:
            "尽管推动了多次政策，很多企业在安装分布式光伏方面的响应依然不佳，政府面临着一个选择？",
          government: {
            options: [
              {
                id: "m6-A",
                label: "对安装光伏的企业补贴",
                detail: "每家已安装屋顶光伏的企业经济 +2，政府财政每家 -2",
                apply: { target: "hasRooftopPV", economy: +2, finance: -2 },
              },
              {
                id: "m6-B",
                label: "不进行补贴",
                detail: "保持现状，不对安装分布式光伏的企业提供额外经济支持",
                apply: { target: "none", economy: 0, finance: 0 },
              },
            ],
          },
        },
      ],
    },

    /* ================ 7 月 ================ */
    {
      month: 7,
      title: "安装电动车充电桩",
      steps: [
        {
          type: "companyChoice",
          id: "m7-charger",
          title: "充电桩决策",
          prompt:
            "公司正在考虑是否在厂区安装电动车充电桩，此举将影响电动车的充电便利性，并可能带来技术发展机会，你们会如何决策？",
          timer: true,
          options: [
            {
              id: "m7-A", key: "A",
              label: "不安装充电桩",
              detail: "继续维持现状，不安装任何电动车充电设施",
              cost: 0, monthly: 0, ecology: -10,
              grants: {},
            },
            {
              id: "m7-B", key: "B",
              label: "安装单向充电桩",
              detail: "安装技术成熟的单向充电桩，为电动车提供基本充电服务",
              cost: -20, monthly: 4, ecology: +15,
              grants: { oneWayCharger: true },
            },
            {
              id: "m7-C", key: "C",
              label: "安装双向充电桩",
              detail: "投资安装双向充电桩，作为智能充电试点工程（11 月零碳园区资格更优）",
              cost: -30, monthly: 4, ecology: +20,
              grants: { twoWayCharger: true },
            },
          ],
        },
      ],
    },

    /* ================ 8 月 ================ */
    {
      month: 8,
      title: "光伏并网受限与加装蓄电池",
      steps: [
        {
          type: "companyChoice",
          id: "m8-battery",
          title: "应对并网受限",
          prompt:
            "随着电网可再生电力的快速增长，电网承受着巨大的消纳压力，光伏发电的并网受限。政府为应对这一问题，鼓励企业增加自消纳比例，并取消了对全额上网电量的补贴。面对这一变化，你们会？",
          timer: true,
          options: [
            {
              id: "m8-A", key: "A",
              label: "维持不变",
              detail: "继续现有光伏并网策略",
              cost: 0, monthly: 0, ecology: -5,
              grants: {},
            },
            {
              id: "m8-B", key: "B",
              label: "加装蓄电池",
              detail: "存储光伏发电，减少对电网的依赖，提高自用电量（仅已安装光伏企业可选）",
              cost: -20, monthly: 4, ecology: +10,
              grants: { battery: true },
              requires: { rooftopPV: true }, // 资格条件
            },
            {
              id: "m8-C", key: "C",
              label: "继续安装光伏",
              detail: "继续扩展光伏系统，增加投资以提升发电能力",
              cost: -15, monthly: 2, ecology: +5,
              grants: { rooftopPV: true },
            },
          ],
        },
        ecoRewardPunishStep(8),
      ],
    },

    /* ================ 9 月 ================ */
    {
      month: 9,
      title: "台风「塔巴」三段事件",
      steps: [
        {
          type: "diceCheck",
          id: "m9-typhoonPV",
          title: "屋顶光伏抗台检测",
          note: "【拥有屋顶光伏】的企业掷骰子决定",
          perCompany: true,
          onlyCompaniesWith: "rooftopPV",
          results: [
            { faces: [1, 3, 5], key: "A", label: "屋顶光伏被连根拔起，修缮费用经济 -10", economy: -10, ecology: 0 },
            { faces: [2, 4, 6], key: "B", label: "光伏板坚如磐石，设备完好无损", economy: 0, ecology: 0 },
          ],
        },
        {
          type: "governmentChoice",
          id: "m9-blackout",
          title: "政府停电应对",
          prompt:
            "台风「塔巴」重创本市，电力设施大规模损毁，预计电网供电中断一个月。面对这场危机，政府将：",
          government: {
            options: [
              {
                id: "m9-A",
                label: "强制停工停产",
                detail: "要求所有非必要企业暂停生产，每家企业经济 -15",
                apply: { target: "all", economy: -15, finance: 0 },
              },
              {
                id: "m9-B",
                label: "部分限电，轮流供电",
                detail: "企业每天仅能获得部分时间供电，每家企业经济 -10",
                apply: { target: "all", economy: -10, finance: 0 },
              },
              {
                id: "m9-C",
                label: "启动抢险救灾资金",
                detail: "对每家企业经济 +10，政府财政 -30",
                apply: { target: "all", economy: +10, finance: -30 },
              },
            ],
          },
        },
        {
          type: "autoEvent",
          id: "m9-selfPower",
          title: "企业自备电力加成",
          note:
            "【拥有屋顶光伏】经济 +5；【拥有蓄电池或双向充电桩】经济 +5；两项具备可叠加 +10",
          autoApply: function (companies) {
            const results = [];
            for (const c of companies) {
              let delta = 0;
              const hasPV = c.assets.rooftopPV;
              const hasStorage = c.assets.battery || c.assets.twoWayCharger;
              if (hasPV) delta += 5;
              if (hasStorage) delta += 5;
              results.push({
                companyId: c.id,
                economy: delta,
                note: `光伏${hasPV ? "✔" : "✘"} 储电${hasStorage ? "✔" : "✘"} → ${delta > 0 ? "+" + delta : "无加成"}`,
              });
            }
            return results;
          },
        },
      ],
    },

    /* ================ 10 月 ================ */
    {
      month: 10,
      title: "国际油价飙升",
      steps: [
        {
          type: "autoEvent",
          id: "m10-oil",
          title: "油价冲击结算",
          note:
            "【已安装电动车充电桩】的企业不受影响；【未安装充电桩】的企业每月经济 -3",
          autoApply: function (companies) {
            const results = [];
            for (const c of companies) {
              const hasCharger = c.assets.oneWayCharger || c.assets.twoWayCharger;
              results.push({
                companyId: c.id,
                economy: hasCharger ? 0 : -3,
                note: hasCharger ? "已有充电桩，不受油价冲击影响" : "无充电桩，承受高昂燃油费用，经济 -3",
              });
            }
            return results;
          },
        },
      ],
    },

    /* ================ 11 月 ================ */
    {
      month: 11,
      title: "零碳园区申报",
      steps: [
        {
          type: "companyChoice",
          id: "m11-apply",
          title: "零碳园区申报",
          prompt:
            "发改委发布《关于开展零碳园区建设的通知》，支持有条件的地区率先建成一批零碳园区，政府将给予资金支持。只有同时具备【屋顶光伏】【双向充电桩】【蓄电池】中至少两项的企业可以申报第一批试点，你们将如何参与？",
          timer: true,
          options: [
            {
              id: "m11-A", key: "A",
              label: "万事俱备，直接申报",
              detail: "不新增投资，保留资格参与审查（需已具备至少 2 项资格资产）",
              cost: 0, monthly: 0, ecology: 0,
              applyIntent: "applyDirect",
            },
            {
              id: "m11-B", key: "B",
              label: "积极响应，加装一项后申报",
              detail: "先补齐短板，再申报试点（下一步选择具体设备）",
              cost: 0, monthly: 0, ecology: 0,
              applyIntent: "applyWithRetrofit",
            },
            {
              id: "m11-C", key: "C",
              label: "观望中，不申报",
              detail: "不新增投资，不参与试点",
              cost: 0, monthly: 0, ecology: 0,
              applyIntent: "skip",
            },
          ],
          /* 选 B 的企业继续在本步骤内选择加装项（子选择） */
          retrofitOptions: [
            {
              id: "m11-R1",
              label: "加装屋顶光伏",
              cost: -18, monthly: 2, ecology: +10,
              grants: { rooftopPV: true },
            },
            {
              id: "m11-R2",
              label: "加装双向充电桩",
              cost: -30, monthly: 4, ecology: +20,
              grants: { twoWayCharger: true },
            },
            {
              id: "m11-R3",
              label: "把单向充电桩改造为双向充电桩",
              detail: "单向充电桩升级为双向充电桩（仅已装单向桩企业可选）",
              cost: -10, monthly: 2, ecology: +5,
              grants: { oneWayCharger: false, twoWayCharger: true },
              requires: { oneWayCharger: true },
            },
            {
              id: "m11-R4",
              label: "加装蓄电池",
              cost: -20, monthly: 4, ecology: +10,
              grants: { battery: true },
            },
          ],
        },
        {
          type: "governmentChoice",
          id: "m11-funding",
          title: "零碳园区试点资金",
          prompt:
            "政府对申报零碳园区试点的企业资格进行审查，并根据试点企业数量、各企业具备的条件来确定对各企业的资金支持力度，支持力度分为4档，请政府对各试点企业发放资金？",
          government: {
            mode: "perApplicantFunding",
            tiers: [
              { id: "tier1", label: "第 1 档", amount: 0 },
              { id: "tier2", label: "第 2 档", amount: 10 },
              { id: "tier3", label: "第 3 档", amount: 20 },
              { id: "tier4", label: "第 4 档", amount: 40 },
            ],
            note: "资金只能给合格申报企业；第 1 档 +0、第 2 档 +10、第 3 档 +20、第 4 档 +40，同步扣减政府财政",
          },
        },
        ecoRewardPunishStep(11),
      ],
    },

    /* ================ 12 月 ================ */
    {
      month: 12,
      title: "雾霾限产",
      steps: [
        {
          type: "companyChoice",
          id: "m12-smog",
          title: "限产应对",
          prompt:
            "空气污染问题愈发严重，雾霾笼罩了整个城市。政府为了改善空气质量，决定对部分企业实施生产限制。面对这一突如其来的政策调整，你们的企业将如何应对？",
          timer: true,
          options: [
            {
              id: "m12-A", key: "A",
              label: "维持原状",
              detail: "不做调整，继续全力以赴保证生产任务",
              cost: 0, monthly: 0, ecology: -10,
            },
            {
              id: "m12-B", key: "B",
              label: "关停部分生产线",
              detail: "关闭部分生产线，配合政府的环保措施",
              cost: 0, monthly: -20, ecology: +10,
            },
          ],
        },
      ],
    },
  ];

  /* ---------- 年终颁奖 ---------- */
  const AWARD_STEP = {
    type: "awardCeremony",
    id: "final-awards",
    title: "年终颁奖",
    note: "政府设计 3 个奖项并为三家企业颁奖（不改分值，仅叙事与复盘）",
  };

  /* ---------- 政府全年行为一览（供归档页展示） ---------- */
  const GOV_SUMMARY = [
    { month: 1, act: "观察企业初始设备路线", finance: 0 },
    { month: 2, act: "生态奖惩（罚最低或奖最高）", finance: "±10/±20" },
    { month: 3, act: "观察团建与疫情结果", finance: 0 },
    { month: 4, act: "停工停产或继续生产（掷骰）", finance: 0 },
    { month: 5, act: "记录哪些企业安装屋顶光伏", finance: 0 },
    { month: 6, act: "决定是否补贴已安装光伏企业", finance: "-2/家" },
    { month: 7, act: "记录充电桩路线", finance: 0 },
    { month: 8, act: "宣布取消全额上网电量补贴 + 生态奖惩", finance: "±10/±20" },
    { month: 9, act: "台风停电：停工 / 限电 / 救灾", finance: "0/0/-30" },
    { month: 10, act: "观察油价冲击结果", finance: 0 },
    { month: 11, act: "零碳园区试点资金（4 档）+ 生态奖惩", finance: "0/-10/-20/-40 与 ±10/±20" },
    { month: 12, act: "宣布雾霾限产背景", finance: 0 },
    { month: "任意", act: "企业经济值首次 ≤20 时的破产救助（每企业限一次）", finance: "-10" },
  ];

  return { MONTHS, AWARD_STEP, ASSET_META, GOV_SUMMARY };
});
