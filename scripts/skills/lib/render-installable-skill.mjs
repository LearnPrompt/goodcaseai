const CATEGORY_GUIDANCE = {
  image: {
    triggers:
      "planning, writing, or refining an AI image prompt in this visual pattern, including requests for 图片提示词, 海报, 肖像, 产品图, or character consistency",
    inputs: [
      "Intended subject, audience, and use",
      "Target image model, aspect ratio, and output constraints",
      "Required references, brand assets, copy, or identity details",
    ],
    output: [
      "A one-paragraph creative brief",
      "A complete generation prompt with composition, subject, lighting, material, and style constraints",
      "Negative constraints or likely failure modes",
      "A short verification checklist",
    ],
    checks: [
      "The prompt names one primary subject and a readable composition",
      "Required text, identity, material, and aspect-ratio constraints are explicit",
      "The verification checklist can be judged from the generated image",
    ],
  },
  video: {
    triggers:
      "planning, storyboarding, or refining an AI video prompt in this motion pattern, including requests for 视频提示词, 分镜, 动作复刻, reference images, source video, or special generation steps",
    inputs: [
      "Target duration, aspect ratio, model, and delivery platform",
      "Opening frame, ending frame, reference image, source video, or depth/motion guide when available",
      "Character, camera, action, continuity, sound, and special-operation requirements",
    ],
    output: [
      "A shot-by-shot motion brief",
      "A complete video prompt with timing, camera, action, continuity, and audio constraints",
      "A reference-assets and special-steps checklist",
      "A short verification checklist for motion and continuity",
    ],
    checks: [
      "Every shot has a subject, action, camera instruction, and duration or sequence position",
      "Reference media and special preprocessing steps are named instead of implied",
      "Continuity risks such as identity drift, limb errors, direction changes, and rhythm breaks are testable",
    ],
  },
  web: {
    triggers:
      "planning, designing, or implementing a website in this interface pattern, including requests for 网页, 落地页, 作品集, 3D hero, SaaS, ecommerce, or UI structure",
    inputs: [
      "Page goal, target audience, offer, and primary action",
      "Content, proof, product assets, and technical stack",
      "Responsive, accessibility, performance, and interaction constraints",
    ],
    output: [
      "A page narrative and section hierarchy",
      "A component and interaction specification",
      "Implementation-ready copy or code appropriate to the user request",
      "A responsive, accessibility, and performance verification checklist",
    ],
    checks: [
      "The first screen communicates one value proposition and one primary action",
      "Every section advances the same user journey with real content",
      "Responsive behavior, keyboard access, contrast, loading, and motion fallback are checked",
    ],
  },
  copy: {
    triggers:
      "planning, writing, or revising copy in this pattern, including requests for 文案, scripts, campaigns, headlines, or structured written content",
    inputs: [
      "Audience, channel, objective, and desired action",
      "Source facts, proof, tone, length, and prohibited claims",
      "Required variants or delivery format",
    ],
    output: [
      "A concise message strategy",
      "The finished copy in the requested format",
      "Claims and evidence notes",
      "A short verification checklist",
    ],
    checks: [
      "The opening matches the audience and channel",
      "Claims are grounded in supplied evidence",
      "The requested action and format are unambiguous",
    ],
  },
  hardware: {
    triggers:
      "planning or evaluating an AI hardware experience in this pattern, including requests for AI 硬件, devices, physical interaction, prototypes, or product concepts",
    inputs: [
      "User, environment, job to be done, and physical constraints",
      "Available sensors, compute, connectivity, privacy, and power limits",
      "Prototype fidelity and evidence required",
    ],
    output: [
      "A hardware experience brief",
      "Interaction flow and system boundaries",
      "Prototype and validation plan",
      "A safety, privacy, and feasibility checklist",
    ],
    checks: [
      "Hardware, software, and human responsibilities are separated",
      "Privacy, failure modes, power, connectivity, and physical safety are addressed",
      "The proposed behavior can be validated with a concrete prototype",
    ],
  },
};

function cleanInline(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeTableCell(value) {
  return cleanInline(value).replaceAll("|", "\\|");
}

function yamlString(value) {
  return JSON.stringify(cleanInline(value));
}

function truncateEvidence(value, maxLength = 1_600) {
  const normalized = String(value || "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

function quoteEvidence(value) {
  return truncateEvidence(value)
    .split("\n")
    .map((line) => {
      const trimmed = line.trimEnd();
      return trimmed ? `> ${trimmed}` : ">";
    })
    .join("\n");
}

function absoluteGoodCaseUrl(value) {
  const normalized = cleanInline(value);
  if (!normalized) {
    return "";
  }
  if (/^https?:\/\//.test(normalized)) {
    return normalized;
  }
  if (normalized.startsWith("/")) {
    return new URL(normalized, "https://goodcase.ai").toString();
  }
  return "";
}

export function assertValidSkillName(name) {
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) ||
    name.length > 64 ||
    name.includes("anthropic") ||
    name.includes("claude")
  ) {
    throw new Error(`Invalid Agent Skill name: ${name}`);
  }
}

export function buildInstallableSkillFiles(skill) {
  assertValidSkillName(skill.slug);
  const guidance = CATEGORY_GUIDANCE[skill.category];
  if (!guidance) {
    throw new Error(`Unsupported Skill category: ${skill.category}`);
  }

  const creatorName =
    skill.kind === "creator_method" ? cleanInline(skill.creators[0]?.name) : "";
  const description =
    skill.kind === "creator_method"
      ? `Apply an evidence-derived ${cleanInline(skill.baseTitle || skill.title)} workflow observed across published GoodCase examples by ${creatorName}. Use when ${guidance.triggers}. This is an unofficial synthesis and must preserve source attribution.`
      : `Apply the ${cleanInline(skill.title)} workflow derived from multiple published GoodCase examples. Use when ${guidance.triggers}. Read the bundled Case evidence before producing an artifact.`;

  const methodSteps = skill.methodSteps
    .map((step, index) => `${index + 5}. ${cleanInline(step)}.`)
    .join("\n");
  const inputs = guidance.inputs.map((item) => `- ${item}.`).join("\n");
  const output = [
    "A reference contract naming one anchor Case, with Preserve, Replace, and Avoid decisions",
    ...guidance.output,
  ]
    .map((item) => `- ${item}.`)
    .join("\n");
  const checks = guidance.checks.map((item) => `- ${item}.`).join("\n");

  const skillMd = `---
name: ${skill.slug}
description: ${yamlString(description)}
---

# ${cleanInline(skill.title)}

Turn the method into an executable, Case-grounded workflow. The Skill is incomplete unless the final artifact can be traced to one named anchor Case.

## Inputs

Ask only for missing inputs:

${inputs}
- Preferred anchor Case from \`references/cases.md\`, or permission to select one.

## Required evidence gate

- Read \`references/cases.md\` before drafting on every invocation.
- Select exactly one anchor Case. Name it in the response; do not average several unrelated visual styles.
- Inspect the anchor's finished media with an available image, video, or browser tool. If the media cannot be inspected, say so and do not claim visual fidelity.
- Write a reference contract before the artifact:
  - **Preserve:** at least three structural traits supported by the Case evidence.
  - **Replace:** subject, copy, brand, or context supplied by the user.
  - **Avoid:** unrelated dominant motifs and superficial copying of creator identity.

## Workflow

1. Restate the requested deliverable, audience, and success criteria.
2. Read \`references/cases.md\` and select one anchor Case.
3. Inspect its finished media, summary, and prompt excerpt.
4. Produce the Preserve / Replace / Avoid reference contract.
${methodSteps}
${skill.methodSteps.length + 5}. Produce the requested artifact using the output contract below.
${skill.methodSteps.length + 6}. Compare it with the anchor Case, then revise material failures once.

## Output contract

${output}

## Verification

${checks}
- The response names one anchor Case and confirms that its evidence file was read.
- At least three visible or structural traits in the artifact map back to the Preserve list.
- No unrelated theme becomes dominant unless the user explicitly requested it.
- If finished media was inaccessible, the response labels the result as prompt-grounded rather than visually verified.
- Distinguish observed evidence from your own recommendation.
- Link or name the relevant GoodCase evidence used for the artifact.

## Safety and attribution

- Do not invent an original prompt, model, result, creator, metric, or source.
- Do not imply this Skill is authored, endorsed, or officially distributed by a referenced creator.
- Preserve creator attribution when reproducing or discussing a source Case.
- Transfer structure and decision logic; do not impersonate a creator or present a close copy as original work.
- Do not publish, purchase, upload private assets, or make external account changes without explicit user approval.
`;

  const evidenceCases = skill.cases.slice(0, 8);
  const evidenceCards = evidenceCases.map((item, index) => {
    const goodCaseUrl = `https://goodcase.ai/cases/${encodeURIComponent(item.slug)}`;
    const mediaUrl = absoluteGoodCaseUrl(item.mediaUrl);
    const posterUrl = absoluteGoodCaseUrl(item.posterUrl);
    const sourceUrl =
      typeof item.sourceUrl === "string" && /^https?:\/\//.test(item.sourceUrl)
        ? item.sourceUrl
        : "";
    const prompt = item.promptFull || item.promptPreview || "";
    const summary = truncateEvidence(item.summary, 600);
    const links = [
      `[GoodCase](${goodCaseUrl})`,
      mediaUrl ? `[finished media](${mediaUrl})` : "",
      posterUrl && posterUrl !== mediaUrl ? `[poster](${posterUrl})` : "",
      sourceUrl ? `[original source](${sourceUrl})` : "",
    ].filter(Boolean);
    return `### E${index + 1} · ${cleanInline(item.title)}

- Creator: ${cleanInline(item.creator)}
- Evidence: ${links.join(" · ")}
- Summary: ${summary || "No editorial summary is available."}
- Prompt excerpt:

${prompt ? quoteEvidence(prompt) : "> No public prompt is available. Use only the inspected media and summary."}`;
  });

  const evidenceRows = skill.cases.slice(0, 20).map((item, index) => {
    const goodCaseUrl = `https://goodcase.ai/cases/${encodeURIComponent(item.slug)}`;
    const mediaUrl = absoluteGoodCaseUrl(item.mediaUrl || item.posterUrl);
    const sourceUrl =
      typeof item.sourceUrl === "string" && /^https?:\/\//.test(item.sourceUrl)
        ? item.sourceUrl
        : "";
    return `| ${escapeTableCell(item.title)} | ${escapeTableCell(item.creator)} | [GoodCase](${goodCaseUrl}) | ${
      mediaUrl ? `[Media](${mediaUrl})` : "—"
    } | ${
      sourceUrl ? `[Original](${sourceUrl})` : "—"
    } | E${index < evidenceCases.length ? index + 1 : "—"} |`;
  });

  const attributionNote =
    skill.kind === "creator_method"
      ? `This is an unofficial synthesis of a recurring method found in ${skill.caseCount} published Cases attributed to ${creatorName}. It is not an official Skill from that creator.`
      : `This workflow is derived from ${skill.caseCount} published Cases across ${skill.creatorCount} creators.`;

  const casesMd = `# Case evidence

${attributionNote}

## Operating rule

Choose one evidence card below as the anchor before drafting. Inspect its finished media, then state which traits will be preserved, replaced, and avoided. A title match alone is not evidence.

${evidenceCards.join("\n\n")}

## Evidence index

| Case | Creator | GoodCase evidence | Finished media | Original source | Card |
| --- | --- | --- | --- | --- | --- |
${evidenceRows.join("\n")}

## Derivation boundary

- Inclusion means the published Case matched the method pattern; it does not prove the creator used this exact synthesized workflow.
- Popularity is not part of the Skill threshold.
- Treat GoodCase summaries as editorial evidence and the linked original source as primary evidence.
`;

  return {
    "SKILL.md": skillMd,
    "references/cases.md": casesMd,
    description,
  };
}
