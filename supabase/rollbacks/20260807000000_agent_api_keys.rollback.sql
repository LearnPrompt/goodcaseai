begin;

-- 回滚会**永久丢掉所有已签发的 key 和用量记录**，而 key 的明文不在任何地方，
-- 删了就是删了，只能给每个调用方重新签发一把。跑之前先确认这不是你要的。
--
-- 应用侧不需要先回退：src/app/api/public/_lib/api-access.ts 在关系缺失时
-- 会降级成免 key 模式，删表之后带 key 的请求会被当匿名请求放行，接口继续可用。

drop function if exists public.consume_api_quota(bigint, date, integer);

-- api_usage 先删：它有指向 api_keys 的外键。
drop table if exists public.api_usage;
drop table if exists public.api_keys;

commit;

notify pgrst, 'reload schema';
