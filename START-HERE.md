# START HERE — ChatGPTクローン学習セッションを別スレで始める

新しいAIセッションを始めたら、このファイルと STATUS.md を最初に読む。
セッションを終える前に、必ず STATUS.md を今日の状態に更新する。

## これは何
- ChatGPTクローン（TypeScript + Express + LLM API）を作りながら、LLMアプリの仕組みを理解する学習プロジェクト
- BootCamp #4 もくもく会（2026-07-05）用。Twitterクローン（work/twitter-clone）の続編
- 完成の定義: Phase 3（サーバー経由でLLMと1往復会話）まで動き、Phase 4（ステートレス）を自分の言葉で説明できる

## 手順
1. このフォルダで**新しい Claude Code セッション**を開く:
   ```
   cd /Users/tanumashuu/Documents/Codex/2026-06-24/handoff-next-chat-2026-06-24/work/chatgpt-clone
   claude
   ```
2. 下の「貼り付けプロンプト」を最初のメッセージに貼る。

---

## 貼り付けプロンプト（コピペ）

```
Singularity Society BootCamp #4 のもくもく会で、ChatGPTクローンを作りながらLLMアプリの仕組みを学びます。
あなたは先生・相棒。私（田沼）が手を動かして学ぶのをサポートしてください。最優先は「自分で理解すること」。理解 > 完成。

まず同じフォルダの KICKOFF.md を読んでください。教材の全文は materials/ フォルダに落としてあります（全14章＋付録A〜J、進める章のファイルを直接読んで）。
今日使う章: 付録A materials/apx-a-api-keys.md / 第1章 materials/01-actors.md / 第2章 materials/02-secret-key.md / 第3章 materials/03-first-call.md / 第4章 materials/04-stateless.md
（読む版のWeb目次: https://singularitysociety.github.io/societys_statement/development/chatgpt_clone/README.html ／原本: github.com/SingularitySociety/societys_statement の development/chatgpt_clone）

スタック: TypeScript + Express + Node.js（導入済み）、フロントはプレーンHTML/TS、LLMはOpenAIまたはAnthropic（付録Cで差し替え可）。
学びの核心は2本の背骨: ①「LLMは毎回忘れる」（ステートレス、第4章）②「自分のサーバーで鍵と財布を守る」（第2章・第6章）。

進め方ルール（厳守):
- コードを全部書かないで。私が自分で書くのを手伝う形にする。理解できないまま動くものを増やさない。
- 教材の章の型（📱こう見える→🤔なぜ→🛠こう作る→⚠️ハマりどころ→🤖AIのコツ）で、1章ずつ進める。公式の手順は省略・最適化せずそのまま再現する。
- 私が書いたコードを確認して、間違い・ハマりどころを指摘して。
- AIが書いたコードでも、私が「なぜこうなるか」を説明できる状態を目指す。
- 各フェーズ終了ごとに「今日の学び」を1〜2行で LEARNING-LOG.md に追記して。
- Taste Glass / Taste Spoon に応用できそうな気づきは CROSS-PROJECT-NOTES.md に残して（実装はしない、メモだけ）。今回はストリーミング・Tool Use・メモリなどTaste GlassのGemini Liveまわりと重なるので特に意識して。

今日のフェーズ計画（実働2.5〜3h）: Phase0 準備(付録A・APIキー) → Phase1 全体像(1章) → Phase2 鍵を守る(2章) → Phase3 はじめての会話(3章) → Phase4【背骨】ステートレス(4章)。
メインゴールは Phase3まで動かして Phase4 を理解すること。余力で5章（会話ログ・Supabase再利用）か11章（SSE）。
さらに早く終わったら stretch-nanogpt/START-STRETCH.md を読んで、LLMの中身ミニ体験（bigram.py、準備済み・6秒で動く）へ。本編優先、これはボーナス。

最後に LEARNING-LOG.md をまとめて、もくもく会共有用の結果報告（進捗／学び／次にやること）を作って。

まず Phase 0 から。APIキーの準備状況を確認して、付録Aを一緒に進めたい。最初の一歩を教えて。
```

---

## いまのフェーズ
Phase 0: 準備（詳細は KICKOFF.md）

## 次の一手（30分以内）
**LLMのAPIキーを1つ用意する**（付録A `apx-a-api-keys.html` 参照）。
- 教材の主線は OpenAI。Anthropic でもOK（付録Cで1箇所差し替え）。
- 課金設定が要るので**当日朝ではなく前日までに**済ませておくと安全。
- Node.js は v24.16.0 導入済みなので環境面はほぼOK。

## 事前にあると速いもの
- [ ] OpenAI または Anthropic の APIキー（**これだけは前日推奨**）
- [x] Node.js / npm（v24.16.0 / 11.13.0 確認済み）
- [ ] Supabaseアカウント（第5章以降で使用。**Twitterクローンのものを再利用できる**ので新規作成不要）

## メモ
- 仕様・章構成・ルールは `KICKOFF.md`。進捗は `STATUS.md`。学びは `LEARNING-LOG.md`、横展開の気づきは `CROSS-PROJECT-NOTES.md`。
- Taste Glass（応募）とは別プロジェクト。混ぜない。気づきのメモだけ橋渡しする。
