# 進捗ボード — ChatGPTクローン（2026-07-04 準備時点）

## ✅ 完了したこと
- [x] プロジェクト4点セット＋CROSS-PROJECT-NOTES 作成（2026-07-04、もくもく会前日）
- [x] Node.js 環境確認（v24.16.0 / npm 11.13.0）
- [x] 教材の章構成・URL確認（14章＋付録A〜J、個別ページあり）
- [x] 教材全文を materials/ にダウンロード（25ファイル。当日Wi-Fi不要で読める）
- [x] ストレッチゴール準備: stretch-nanogpt/（clone＋PyTorch 2.8.0導入＋bigram.py動作検証済み・約6秒で学習完了）
- [x] 共有会用の全体像・完成イメージ → OVERVIEW.md（30秒トーク台本つき）

## 🔨 いまやっていること
- Phase 0〜4 ＋ 第5〜7章 完了（2026-07-04 もくもく会本番）。メインゴール大幅超過。
- 次は教材どおり第13章（キャッシュ）。第12章まで完了（第14章は読み物）。

## 🏁 本番の成果（2026-07-04）
- [x] Phase 1〜3: server.ts＋index.html で、自分のサーバー経由でLLMと会話が動いた
- [x] Phase 4: 全履歴を送る形に改造し、会話を覚えるようになった（背骨①を体験）
- [x] server.ts と index.html を5ブロックずつで**自分の手で1から打ち直した**（answer key: *.reference）
- [x] 第5章: Supabaseに会話を保存（twitter-cloneプロジェクトに相乗り、conversations/messages＋RLS）。Googleログイン、リロードしても会話が残る＝DB永続化を確認
- [x] 第6章: サーバー側でログイン必須（requireUser／トークン検証で401）＋1日の使用量上限（usage表＋increment_usage、超過で429）。DAILY_LIMITはテストで5→100に戻した
- [x] 第7章: 二重送信ロック（isSending＋finally解除）。会話はuser→assistantの交互が基本。うちは「成功後に保存」なので壊れた履歴はDBに残らない（設計で回避済み）
- [x] 第8章: トークン＝箱（コンテキストウィンドウ約128k）。会話が伸びると毎回送る量が増え、いつかあふれる。ざっくり見積もり関数(CHARS_PER_TOKEN=2)を画面に表示して数字が伸びるのを確認
- [x] 第9章: 要約＋ログのハイブリッド。summary列追加＋/api/summarize＋buildMessagesForLLM（system＋要約＋直近4件だけ送る）。全文1780に対し送信435、名前は要約経由で保持されるのを確認。TasteGlass/Claude自身の長会話記憶と同型
- [x] 第10章: メモリ（会話をまたいで覚える）。memories表＋RLS＋/api/extract-fact＋systemに事実を差し込む＋「新しい会話」ボタン。まっさらな新会話でも名前・好みを答えるのを確認＝TasteGlassの味覚プロファイルと同型。背骨①完了
- [x] 第11章: ストリーミング（SSE）。/api/chatをstream:true＋text/event-streamに、画面はreaderで断片を+=表示。1文字ずつ出るのを確認。既存機能（認証・使いすぎ・保存・要約・メモリ）は全部維持
- [x] 第12章: ツール（function calling）。calculate道具（tools定義＋実体）＋tool_callループ（上限3・引数検証）をストリーミングと両立。12345×6789を電卓経由で正確に。TasteGlassのレストラン機能と同型
- [x] 記録: records/WHAT-I-BUILT-2026-07-04.md（＋スクショは本人がrecords/へ保存）

## ⏭ 残り
- [x] APIキー取得（OpenAI sk-proj-、$5チャージ・Auto rechargeオフ）
- [x] `.env`＋`.gitignore` 作成・形式チェックOK（キーはエディタで投入、gitに載らない）
- [ ] もくもく会当日: Phase 1〜4（第1〜4章）
- [ ] 余力: 第5章（会話ログ、SupabaseはTwitterクローンのを再利用）or 第11章（SSE）
- [ ] さらに早く終わったら: nanoGPTミニ体験（stretch-nanogpt/START-STRETCH.md、準備済み）
- [ ] 最後に結果報告（進捗／学び／次にやること）

## ⚠️ ハマりどころメモ
- APIキーは課金設定が必要な場合あり → 当日朝にやると開始が遅れる
- キーを絶対にコードに直書き・コミットしない（`.env` + `.gitignore`。第2章がまさにこれ）
- OpenAI/Anthropicの差は付録Cで吸収できる設計。プロバイダ選びで迷って止まらない
