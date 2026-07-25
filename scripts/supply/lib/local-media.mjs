export const LOCAL_MEDIA_ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    resultHighlight: { type: "string" },
    reusableStructure: { type: "string" },
    retestStandard: { type: "string" },
    promptTranslationZh: { type: "string" },
  },
  required: [
    "resultHighlight",
    "reusableStructure",
    "retestStandard",
    "promptTranslationZh",
  ],
};

export function buildFrameTimestamps(durationSeconds, frameCount = 6) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("视频时长必须大于 0");
  }
  if (!Number.isInteger(frameCount) || frameCount < 2 || frameCount > 12) {
    throw new Error("抽帧数量必须是 2 到 12 之间的整数");
  }

  return Array.from(
    { length: frameCount },
    (_, index) => ((index + 0.5) * durationSeconds) / frameCount
  );
}

export function buildLocalAnalysisPrompt(originalPrompt = "") {
  return [
    "你正在审核一个 GoodCase 视频候选。输入图片按时间先后排列，必须只根据可见画面下结论，不得补写看不见的情节。",
    "resultHighlight 要具体写出画面发生了什么，以及最关键的视觉转折；不要写“观察连续性是否成立”这类空话。",
    "reusableStructure 要把可迁移的镜头结构写成简短步骤。",
    "retestStandard 要给出三个可直接检查的画面标准。",
    originalPrompt
      ? `把下面的公开原文 Prompt 完整翻译为中文，写入 promptTranslationZh：\n${originalPrompt}`
      : "没有提供原文 Prompt 时，promptTranslationZh 返回空字符串。",
    `只返回符合以下 JSON Schema 的 JSON：${JSON.stringify(LOCAL_MEDIA_ANALYSIS_SCHEMA)}`,
  ].join("\n\n");
}

export function parseLocalAnalysis(content) {
  const parsed = typeof content === "string" ? JSON.parse(content) : content;
  const required = [
    "resultHighlight",
    "reusableStructure",
    "retestStandard",
    "promptTranslationZh",
  ];

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("本地模型返回值必须是 JSON 对象");
  }

  for (const key of required) {
    if (typeof parsed[key] !== "string") {
      throw new Error(`本地模型缺少字符串字段：${key}`);
    }
  }

  return Object.fromEntries(required.map((key) => [key, parsed[key].trim()]));
}
