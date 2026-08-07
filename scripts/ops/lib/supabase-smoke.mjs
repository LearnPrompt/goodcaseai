export function projectRefFromUrl(value) {
  try {
    const url = new URL(value);
    const match = url.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}
export function assertTestTarget({ url, expectedProject, productionUrl }) {
  const actualProject = projectRefFromUrl(url);
  if (!actualProject) throw new Error("Supabase URL 不是可识别的 *.supabase.co 项目地址。");
  if (!expectedProject) throw new Error("必须传 --expect-project=...，避免 smoke 测试误连别的项目。");
  if (actualProject !== expectedProject) {
    throw new Error(`目标项目是 ${actualProject}，但本次期望测试项目是 ${expectedProject}。`);
  }
  if (productionUrl && url === productionUrl) {
    throw new Error("拒绝在生产 Supabase 项目上运行测试 smoke。");
  }
  return actualProject;
}
