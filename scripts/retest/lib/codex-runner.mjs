import { spawn } from "node:child_process";

/**
 * 调本机 codex CLI 跑一次非交互任务。
 *
 * 为什么是 `codex exec --json`：
 *   - `--json` 会把事件流按行吐出来，第一条 `thread.started` 带 thread_id，
 *     而内置图像生成工具正好把产物写在 ~/.codex/generated_images/<thread_id>/ 下。
 *     不解析这个 id，图生成了也不知道去哪儿捡。
 *   - `-o` 把最后一条消息单独写文件，省得从事件流里猜哪条是结论。
 *
 * 已验证的环境事实（2026-08-07，codex-cli 0.144.6）：
 *   - 图像生成走的是 Codex 自带的 image_generation 工具（features 里 stable/true），
 *     吃订阅额度，不需要 OPENAI_API_KEY。产物落 ~/.codex/generated_images/<thread_id>/exec-<uuid>.png。
 *   - ~/.codex/skills/imagegen 那个技能是另一条路：它调 OpenAI Image API，
 *     需要 OPENAI_API_KEY（本机没设），会单独计费。别往那条路上引导。
 *   - codex exec 默认拒绝非 git 目录；本仓库是 git，但仍显式带 --skip-git-repo-check 兜底。
 *   - 沙箱里没有外网。生成物里凡是要联网的部分（CDN 字体、外链图片）都会挂，
 *     所以 UI 复现的提示词必须要求单文件、零外部请求。
 */
export function runCodex({
  prompt,
  cwd,
  model = "gpt-5.6-sol",
  reasoningEffort = "medium",
  outputFile,
  images = [],
  timeoutMs = 15 * 60 * 1000,
}) {
  return new Promise((resolve) => {
    const args = [
      "exec",
      "--json",
      "--skip-git-repo-check",
      "-C",
      cwd,
      "-m",
      model,
      "-c",
      `model_reasoning_effort=${reasoningEffort}`,
      "-s",
      "danger-full-access",
    ];
    if (outputFile) args.push("-o", outputFile);
    // 参考图入口。v1 的复测流程刻意不传：库里存的是案例的**成品**不是原作者的**输入图**，
    // 拿成品当参考图喂回去等于给模型抄答案，复现出来的相似度没有证据价值。
    // 留着这个参数是为了将来真的补齐了输入图素材时能直接用。
    for (const image of images) args.push("-i", image);
    args.push(prompt);

    const startedAt = Date.now();
    const child = spawn("codex", args, { stdio: ["ignore", "pipe", "pipe"] });

    let threadId = null;
    let lastMessage = "";
    let buffer = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("{")) continue;
        let event;
        try {
          event = JSON.parse(trimmed);
        } catch {
          continue;
        }
        if (event.type === "thread.started" && event.thread_id) {
          threadId = event.thread_id;
        }
        if (event.type === "item.completed" && event.item?.type === "agent_message") {
          lastMessage = event.item.text ?? lastMessage;
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0 && !timedOut,
        code,
        timedOut,
        threadId,
        lastMessage: lastMessage.trim(),
        stderr: stderr.slice(-4000),
        elapsedMs: Date.now() - startedAt,
      });
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        code: null,
        timedOut,
        threadId,
        lastMessage: "",
        stderr: String(error),
        elapsedMs: Date.now() - startedAt,
      });
    });
  });
}
