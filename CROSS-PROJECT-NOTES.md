# CROSS-PROJECT NOTES — ChatGPTクローン → Taste Glass / Taste Spoon

ルール: ここは**メモだけ**。実装は持ち込まない。

今回の教材は Taste Glass（Gemini Live）と重なりが大きい。特に見ておく章:
- 第4章 ステートレス／第8-9章 トークンあふれ・要約 → Gemini Liveの会話が長くなったときのコンテキスト管理
- 第10章 メモリ → 味覚プロファイル（taste profile）の持たせ方と同型
- 第11章 SSEストリーミング → Liveの逐次応答の仕組みの理解
- 第12章 Tool Use → getRestaurantCompatibility / setCurrentRestaurant がまさにこれ
- 第6章・付録G 使用量制限 → 公開デモ時の請求爆発防止

## 気づきメモ
（日付＋1〜2行で追記）
- 2026-07-04: 第5章のDB永続化＋RLS＋Googleログインの形は、Taste Glassで「ユーザーごとの味覚プロファイル／会話を保存」するときそのまま使える。会話履歴をDBから毎回組み立ててLLMに渡す＝Gemini Liveのコンテキスト管理と同型。
- 2026-07-04: 第10章メモリ＝Taste Glassの味覚プロファイルの実装パターンそのもの。memories(user_id,fact)＋RLS、発言から事実抽出、毎回systemにそっと差し込む。新会話でも好みを覚えているのを実機確認済み。TasteGlassでは fact を「甘め好き/にんにく強め」等の味覚事実にすればよい。PII抽出しない指示もサーバー側prompt済み。
