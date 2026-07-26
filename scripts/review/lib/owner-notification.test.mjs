import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOwnerNotificationPayload,
  sendOwnerNotification,
} from "../../../src/lib/owner-notification.ts";

const sample = {
  kind: "feedback",
  receiptId: "receipt-123",
  title: "页面问题",
  lines: [
    "内容：按钮无法点击",
    "联系方式：未填写",
    "处理入口：https://goodcase.ai/operator?view=feedback",
  ],
  createdAt: "2026-07-25T02:30:00+09:00",
};

test("owner notification uses Feishu text payload when configured", () => {
  const payload = buildOwnerNotificationPayload(sample, "feishu");
  assert.equal(payload.msg_type, "text");
  assert.match(payload.content.text, /GoodCase/);
  assert.match(payload.content.text, /receipt-123/);
  assert.match(payload.content.text, /按钮无法点击/);
  assert.match(payload.content.text, /goodcase\.ai\/operator\?view=feedback/);
});

test("owner notification tolerates whitespace around the Feishu format", () => {
  const payload = buildOwnerNotificationPayload(sample, " feishu\n");
  assert.equal(payload.msg_type, "text");
  assert.match(payload.content.text, /receipt-123/);
});

test("owner notification uses a provider-neutral payload by default", () => {
  const payload = buildOwnerNotificationPayload(sample);
  assert.equal(payload.event, "goodcase.feedback.created");
  assert.equal(payload.receiptId, "receipt-123");
});

test("owner notification is disabled without a webhook", async () => {
  const result = await sendOwnerNotification(sample, { webhookUrl: "" });
  assert.deepEqual(result, { status: "disabled" });
});

test("owner notification posts to an allowed webhook", async () => {
  let captured;
  const result = await sendOwnerNotification(sample, {
    webhookUrl: "http://127.0.0.1:4321/owner-notifications",
    format: "feishu\n",
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return Response.json({ code: 0, msg: "success" });
    },
  });

  assert.deepEqual(result, { status: "sent", responseStatus: 200 });
  assert.equal(captured.url, "http://127.0.0.1:4321/owner-notifications");
  assert.equal(captured.init.method, "POST");
  assert.equal(JSON.parse(captured.init.body).msg_type, "text");
});

test("owner notification rejects Feishu business errors returned with HTTP 200", async () => {
  const result = await sendOwnerNotification(sample, {
    webhookUrl: "https://open.feishu.cn/open-apis/bot/v2/hook/example",
    format: "feishu",
    fetchImpl: async () =>
      Response.json({ code: 19024, msg: "Key Words Not Found" }),
  });

  assert.deepEqual(result, { status: "failed", responseStatus: 200 });
});

test("owner notification rejects insecure remote webhooks", async () => {
  const result = await sendOwnerNotification(sample, {
    webhookUrl: "http://example.com/notify",
    fetchImpl: async () => {
      throw new Error("fetch should not run");
    },
  });
  assert.deepEqual(result, { status: "failed" });
});
