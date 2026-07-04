# ミニ ChatGPT クローン

Singularity Society BootCamp #4 のもくもく会（2026-07-04）で、ChatGPTクローン教材を最初から最後まで作った記録です。
TypeScript + Express + OpenAI + Supabase で、本物と同じ構造のチャットアプリを実装しました。

## 何ができるか
- 自分のサーバー経由でLLMと会話（APIキーはサーバーに隠す）
- 会話が続く（履歴を毎回送り直す＝ステートレス対応）
- Googleログイン＋会話をSupabaseに保存（RLSで自分の会話だけ）
- 使いすぎ防止（サーバー側で1日の上限、超過は429）
- トークンあふれ対策（要約＋直近だけ送る／全文はDB）
- メモリ（会話をまたいで名前・好みを覚える）
- ストリーミング（1文字ずつ／SSE）
- ツール（電卓を持たせて正確な計算／function calling）

## 成果報告
- [発表メモ.md](発表メモ.md) — 話す原稿・デモ手順・学び・つまづきポイント
- [LEARNING-LOG.md](LEARNING-LOG.md) — 章ごとの学び
- [STATUS.md](STATUS.md) — 進捗

## 構成
- `server.ts` — 自分のサーバー（鍵を持ち、OpenAIを代理で呼ぶ）
- `public/index.html` — 画面
- `*.reference` — 自分で打ち直す前の答え合わせ用

## 動かし方（ローカル）
1. `.env` に `OPENAI_API_KEY` / `SUPABASE_URL` / `SUPABASE_ANON_KEY` を入れる（`.env` はgitに載せない）
2. `npm install`
3. `npm run dev` → http://localhost:3000

教材本文は著作物のためこのリポには含めていません。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
