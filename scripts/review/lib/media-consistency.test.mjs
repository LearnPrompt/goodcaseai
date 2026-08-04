import assert from "node:assert/strict";
import test from "node:test";
import {
  decidePublish,
  validateMediaConsistency,
} from "./publish-candidate.mjs";

const video = {
  category: "video",
  media_kind: "video",
  media_url: "https://video.twimg.com/amplify_video/1/vid/avc1/720x960/a.mp4",
  poster_url: "https://pbs.twimg.com/amplify_video_thumb/1/img/b.jpg",
};

test("完整的视频候选不报问题", () => {
  assert.deepEqual(validateMediaConsistency(video), []);
});

test("分类是 video 但 media_kind 不是时拦下", () => {
  const problems = validateMediaConsistency({
    ...video,
    media_kind: "image",
    media_url: "/media/goodcase/x-01.jpg",
  });
  assert.ok(problems.some((p) => p.includes("详情页放不出视频")));
});

test("media_kind 是 video 但地址不是视频文件时拦下", () => {
  const problems = validateMediaConsistency({
    ...video,
    media_url: "/media/goodcase/x-01.jpg",
  });
  assert.ok(problems.some((p) => p.includes("不是视频文件")));
});

test("视频缺 poster 时拦下", () => {
  const problems = validateMediaConsistency({ ...video, poster_url: null });
  assert.ok(problems.some((p) => p.includes("poster_url")));
});

test("缺 media_url 时拦下", () => {
  const problems = validateMediaConsistency({ ...video, media_url: "" });
  assert.ok(problems.some((p) => p.includes("缺少 media_url")));
});

test("图片候选不受视频规则影响", () => {
  assert.deepEqual(
    validateMediaConsistency({
      category: "image",
      media_kind: "image",
      media_url: "https://cms-assets.example.com/a.jpg",
      poster_url: null,
    }),
    []
  );
});

test("decidePublish 在媒体不一致时返回 blocked", () => {
  const decision = decidePublish({
    candidateId: "c1",
    candidate: { ...video, media_kind: "image" },
    existingByCandidate: null,
    existingBySlug: null,
    allowUpdate: false,
  });
  assert.equal(decision.action, "blocked");
  assert.ok(decision.reason.includes("媒体不一致"));
});

test("不传 candidate 时保持原有决策路径", () => {
  const decision = decidePublish({
    candidateId: "c1",
    existingByCandidate: null,
    existingBySlug: null,
    allowUpdate: false,
  });
  assert.equal(decision.action, "insert");
});
