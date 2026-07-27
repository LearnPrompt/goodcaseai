import Link from "next/link";
import { SiteShell } from "@/components/site-shell";

export default function NotFound() {
  return (
    <SiteShell footerNote="这个版本先只做了核心路由，404 页面也保持同一视觉语言。">
      <section className="gc-empty-state my-8">
        <p className="gc-eyebrow">
          Not found
        </p>
        <h1 className="text-5xl font-medium leading-[0.95] tracking-[-0.04em] md:text-7xl">
          这个页面还没做，或者路径不对。
        </h1>
        <div>
          <Link
            href="/"
            className="gc-action gc-action-primary"
          >
            返回首页
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
