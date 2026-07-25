# GoodCase.ai

[中文文档](./README.md) | README in English

[![Website](https://img.shields.io/website?down_message=offline&up_message=goodcase.ai&url=https%3A%2F%2Fgoodcase.ai)](https://goodcase.ai)
[![GitHub](https://img.shields.io/github/stars/LearnPrompt/goodcaseai?style=flat&label=GoodCase.ai)](https://github.com/LearnPrompt/goodcaseai)

Website: [goodcase.ai](https://goodcase.ai)

The problem with viral AI cases is that they scroll past and disappear. You see a stunning AI video on X, hit like, and three days later you want to reproduce it — no prompt to be found, no idea which model was used, no clue what else the creator has made.

GoodCase.ai puts the work, creator, method, original source, and reproduction evidence back into one Case. Full prompts are public and no account is required.

**See what actually works. Follow the people who keep shipping.**

## Showcase

![GoodCase.ai homepage](public/readme/home.png)

![Source Heat Ranking and Stability Ranking](public/readme/rankings.png)

## One object, three derived views

**Case** is the entry point. Every case ships with the full prompt, model stack and media assets, captured from X, Xiaohongshu, Bilibili and wherever things are spreading right now.

**Creator** links each case back to a person. One viral hit can be luck; a creator who consistently ships good work is worth following long term.

**Lab** is not a separate product. Reproduction notes, stability, drift, and cost stay on the relevant Case page.

**Skill** is only distilled after a pattern holds across multiple Cases. It is not a separate content product or top-level page this month.

![Creators](public/readme/creator.png)

## Run Locally

```bash
git clone https://github.com/LearnPrompt/goodcaseai.git
cd goodcaseai
npm ci
npm run dev
```

Open http://localhost:3000.

The data layer runs on Supabase. Copy `.env.example` to `.env.local`, then configure Supabase and the public site origin. The schema lives in `supabase/schema.sql`. Without Supabase, pages fall back to built-in cases.

## Content Pipeline

Automated discovery and human publishing stay separate. The shadow supply run only writes local reports:

```bash
npm run supply:shadow
```

Human-confirmed candidates then follow an import, review, and publish flow:

```bash
npm run import:candidates -- --file=tmp/case-candidates.json
npm run review:candidates
npm run review:candidates -- --action=approve --id=<candidate-uuid> --note="Source and method verified" --evidence-level=L1 --tags=video,verified
# Or reject it
npm run review:candidates -- --action=reject --id=<candidate-uuid> --note="Creator or original source could not be verified"
npm run publish:cases
```

Only `pending` candidates can be reviewed, and every decision records its note, evidence level, and timestamp. Import and publish are append-only by default. Interrupted publishes can safely resume through `source_candidate_id`. Updating an unbound Case with the same slug requires the explicit `--allow-update` flag; a Case already bound to another candidate can never be reassigned.

## Stack

Next.js App Router, Tailwind CSS, Supabase, deployed on Vercel. Visually: one accent color, Swiss grid, zero border radius, 1px hairlines. Restraint all the way down.

## Credits

GoodCase.ai is maintained by [Carl](https://github.com/LearnPrompt). [LearnPrompt](https://www.learnprompt.pro) remains an external learning destination rather than a merged content library.
