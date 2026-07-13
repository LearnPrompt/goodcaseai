# GoodCase.ai

[中文文档](./README.md) | README in English

[![Website](https://img.shields.io/website?down_message=offline&up_message=goodcase.ai&url=https%3A%2F%2Fgoodcase.ai)](https://goodcase.ai)
[![GitHub](https://img.shields.io/github/stars/LearnPrompt/goodcaseai?style=flat&label=GoodCase.ai)](https://github.com/LearnPrompt/goodcaseai)

Website: [goodcase.ai](https://goodcase.ai)

The problem with viral AI cases is that they scroll past and disappear. You see a stunning AI video on X, hit like, and three days later you want to reproduce it — no prompt to be found, no idea which model was used, no clue what else the creator has made.

GoodCase.ai turns this into a complete pipeline: track AI cases while they are spreading, verify stability by re-running the same prompt across models, see who keeps delivering, and distill recurring creative patterns into reusable skill packs.

**See what actually works. Follow the people who keep shipping.**

## Showcase

![GoodCase.ai homepage](public/readme/home.png)

![Love Ranking and Stability Ranking](public/readme/rankings.png)

## Four Layers

**Case** is the entry point. Every case ships with the full prompt, model stack and media assets, captured from X, Xiaohongshu, Bilibili and wherever things are spreading right now.

**Creator** links each case back to a person. One viral hit can be luck; a creator who consistently ships good work is worth following long term.

**Lab** does the verification. Same prompt, same variables, re-run across different models, logging stability scores, drift and cost. The Love Ranking reads audience preference; the Stability Ranking reads model reliability.

**Skill** is the distillation. When the same creator keeps producing the same class of pattern, it gets promoted into a skill pack you can use directly.

## Run Locally

```bash
git clone https://github.com/LearnPrompt/goodcaseai.git
cd goodcaseai
npm ci
npm run dev
```

Open http://localhost:3000.

The data layer runs on Supabase. Copy `.env.example` to `.env.local` and fill in the three variables; the schema lives in `supabase/schema.sql`. It also runs without Supabase — pages fall back to built-in sample cases, so you can look around before wiring up a database.

## Content Pipeline

A Feishu (Lark) Base serves as the editorial backend. Cases marked as approved get synced into Supabase by a script:

```bash
node scripts/sync-feishu-cases.mjs --dry-run   # preview
node scripts/sync-feishu-cases.mjs             # sync
```

The homepage revalidates every 5 minutes. Put the sync script on a daily cron and the whole loop runs itself.

## Stack

Next.js App Router, Tailwind CSS, Supabase, deployed on Vercel. Visually: one accent color, Swiss grid, zero border radius, 1px hairlines. Restraint all the way down.

## Credits

GoodCase.ai is part of the [LearnPrompt](https://www.learnprompt.pro) ecosystem, maintained by [Carl](https://github.com/LearnPrompt). Stay curious.
