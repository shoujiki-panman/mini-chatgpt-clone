// server.ts — 自分のサーバー（お店＝店員）。ここに自分の手で書いていく。
// 迷ったら答え合わせ: server.reference.ts
import express from "express";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

// 別オリジン（Twitterクローン等）から呼べるように、必要なオリジンだけ許可（*にはしない）
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "https://shoujiki-panman.github.io",
];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.static("public"));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const SYSTEM_PROMPT = "あなたは親切で、やさしい日本語で答えるアシスタントです。";
const DAILY_LIMIT = 100; // 1日の上限回数（教材どおり）

// LLMに持たせる道具の「説明書」（スキーマ）。中身は下の calculate() が実体
const tools = [{
  type: "function",
  function: {
    name: "calculate",
    description: "2つの数の四則演算を正確に計算する。掛け算・割り算など、正確さが要る計算に使う。",
    parameters: {
      type: "object",
      properties: {
        a: { type: "number", description: "1つ目の数" },
        b: { type: "number", description: "2つ目の数" },
        op: { type: "string", enum: ["+", "-", "*", "/"], description: "演算子" },
      },
      required: ["a", "b", "op"],
    },
  },
}, {
  type: "function",
  function: {
    name: "get_timeline",
    // ★第2章の実験: 説明書の文字だけで挙動が変わる
    //   「データを取得する。」でも get_timeline という【名前】のおかげで呼ばれた
    //   名前を fetch_data_2 に変えた瞬間、呼ばれなくなった（エラーは出ず、静かに聞き返すだけ）
    //   → 道具の名前は「AIへの説明の1行目」。開発者都合の名前は道具を見えなくする
    description: "ミニTwitterの公開タイムラインを新しい順に読む。「タイムラインを要約して」「最近どんな投稿がある？」「みんな何を話してる？」など、いま流れている投稿の中身を知る必要があるときに使う。",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "読む件数。1〜20。省略すると10件" },
      },
      required: [],   // limit は省略可。LLMが件数を指定しなくても呼べるようにする
    },
  },
}, {
  type: "function",
  function: {
    name: "propose_post",
    // ★第4章: この道具は「投稿する」道具ではない。下書きを提案するだけ。
    //   実際に投稿できるのはブラウザの確認ダイアログだけなので、名前も propose（提案）にしてある
    description: "ミニTwitterへの投稿の下書きを、ユーザーに提案する。実際には投稿されず、ユーザーが画面で確認して初めて投稿される。投稿を頼まれたら、必ずこの道具を使って下書きを出すこと。文章をそのまま返信に書くのではなく、この道具を使う。ユーザーから修正の要望が来たら、修正した本文で改めてこの道具を呼び直すこと。",
    parameters: {
      type: "object",
      properties: {
        body: { type: "string", description: "投稿する本文。短めが良い（SNSの投稿なので2〜4文が目安）。プレーンテキストで書く（**太字**や箇条書きなどのマークダウン装飾は使わない。#ハッシュタグはOK）。リンクを載せるときは実際のURLをそのまま書く（『URL』『リンクはこちら』のようなプレースホルダは禁止。実際のURLが分からなければリンクは載せない）。" },
      },
      required: ["body"],
    },
  },
}, {
  type: "function",
  function: {
    name: "search_web",
    description: "Webを検索して最新の情報を調べる。あなた自身の知識は2024年頃で止まっているので、知らない固有名詞（新しいモデル名・製品名など）や「最新」「今」を含む話題は、記憶で答えずに必ず先にこれで調べること。比較を頼まれたら、比較対象もこれで調べる。出典つきの答えが返る。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "調べたいこと。日本語でよい" },
      },
      required: ["query"],
    },
  },
}];

// 道具の実体。引数は鵜呑みにせず検証してから使う（背骨②）
function calculate(a, b, op) {
  if (typeof a !== "number" || typeof b !== "number" || Number.isNaN(a) || Number.isNaN(b)) {
    return "数が不正です";
  }
  if (op === "+") return String(a + b);
  if (op === "-") return String(a - b);
  if (op === "*") return String(a * b);
  if (op === "/") return b === 0 ? "0では割れません" : String(a / b);
  return "不明な演算です";
}

// 道具の実体②。公開ツイートを新しい順に読んで「返すだけ」（画面は触らない・DBには書かない）
// DBを待つので async。calculate と違ってこちらは非同期
async function getTimeline(limit) {
  // 引数は鵜呑みにしない（背骨②）。LLMが 9999 と言ってきても 20 で頭打ち、変な値なら 10
  const n = Math.min(Math.max(Number(limit) || 10, 1), 20);
  const { data, error } = await supabase
    .from("tweets")
    .select("body, created_at")
    .eq("is_public", true)                       // 公開のみ。下書き(is_public=false)は読まない
    .order("created_at", { ascending: false })   // 新しいものが上
    .limit(n);
  if (error) return "タイムラインを読めませんでした: " + error.message;
  if (!data.length) return "投稿がまだありません";
  // 返り値は文字列。読むのはLLMなので、人間に読める形に整える
  return data.map((t, i) => `${i + 1}. ${t.body}`).join("\n");
}

// 道具の実体③。Webを検索して出典つきの答えを返すだけ（/api/websearch と同じ中身を共用）
async function searchWeb(query) {
  const q = String(query ?? "").trim().slice(0, 4000);
  if (!q) return "検索語が空でした";
  const r = await openai.responses.create({
    model: "gpt-4.1-mini",                    // web_search対応・軽量
    tools: [{ type: "web_search" }],
    input: q,
  });
  // 出典（URL＋タイトル）も文字列に含めてLLMへ渡す（正直に情報源を見せる）
  const cites: string[] = [];
  for (const item of (r.output ?? []) as any[]) {
    if (item.type !== "message") continue;
    for (const c of (item.content ?? []) as any[]) {
      for (const a of (c.annotations ?? []) as any[]) {
        if (a.type === "url_citation") cites.push(`- ${a.title} (${a.url})`);
      }
    }
  }
  const uniq = [...new Set(cites)].slice(0, 5);
  return (r.output_text || "(結果なし)") + (uniq.length ? "\n\n出典:\n" + uniq.join("\n") : "");
}

// ログインしている人だけ通す見張り役（ミドルウェア）
async function requireUser(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: "ログインが必要です" });
  }
  req.userId = data.user.id;
  next();
}

// ★第3章: 計画モードのときだけ足す規範（Claude Code / Grok Build の Plan mode）
const PLAN_PROMPT = `あなたはミニTwitterのエージェントです。
いまは【計画モード】です。まだ実行はしません。
ユーザーの依頼に対して、これから何をするかを短い箇条書きで示してください。

あなたが使える道具はこの3つだけです。持っていない道具をあてにした計画を立てないでください:
- get_timeline: 公開タイムラインを読む
- search_web: Webを検索して最新情報を調べる（出典つき）
- propose_post: 投稿の下書きをユーザーに提案する（投稿するのはユーザー本人）

書き方:
計画:
  1. （やること）
  2. （やること）

注意:
- 3〜4項目以内。長く書かない
- 投稿など取り消せない操作を含むときは、最後に「※実行前に確認します」と書く
- 挨拶や前置きは不要。「計画:」から書き始める`;

app.post("/api/chat", requireUser, async (req, res) => {
  const { messages, planOnly } = req.body;   // ★planOnly: true なら計画だけ返す
  const today = new Date().toISOString().slice(0, 10); // "2026-07-04"

  // 使いすぎチェックは「流し始める前」に（429はJSONで返す必要があるため）
  const { data: usage } = await supabase
    .from("usage").select("count")
    .eq("user_id", req.userId).eq("day", today).maybeSingle();
  if ((usage?.count ?? 0) >= DAILY_LIMIT) {
    return res.status(429).json({ error: "本日の上限に達しました。明日また使えます" });
  }

  res.setHeader("Content-Type", "text/event-stream"); // SSEで少しずつ流す宣言
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders(); // ヘッダーをすぐ送り出す（ためこまない）

  let totalTokens = 0;
  // 計画モードのときは、規範を先頭に足してから会話を渡す
  const convo = planOnly
    ? [{ role: "system", content: PLAN_PROMPT }, ...messages]
    : [...messages]; // 道具の結果を足していく作業用コピー

  try {
    let usedTool = true;
    let guard = 0;
    // 道具を呼ぶ→実行→また聞く、の上限（無限ループ防止＝背骨②）
    // 3だと「検索2回→下書き」で使い切る。調べ物＋提案が1往復で収まるよう5に
    while (usedTool && guard < 5) {
      guard++;
      usedTool = false;

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: convo,
        tools,                                   // ★道具の説明書も渡す
        // ★第3章の心臓: 計画モードでは道具を「呼べなくする」
        //   プロンプトでお願いするだけでは、たまに従わない。取り消せない操作の前でそれは困る
        //   tool_choice:"none" はモデル側で道具呼び出しを封じるので、規範ではなくコードで止まる
        tool_choice: planOnly ? "none" : "auto",
        stream: true,
        stream_options: { include_usage: true },
      });

      const toolCalls = {}; // index -> { id, name, args }
      let assistantContent = "";
      for await (const chunk of stream) {
        if (chunk.usage) totalTokens += chunk.usage.total_tokens;
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          assistantContent += delta.content;
          res.write("data: " + JSON.stringify(delta.content) + "\n\n"); // 文章の断片を流す
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const i = tc.index;
            if (!toolCalls[i]) toolCalls[i] = { id: "", name: "", args: "" };
            if (tc.id) toolCalls[i].id = tc.id;
            if (tc.function?.name) toolCalls[i].name += tc.function.name;
            if (tc.function?.arguments) toolCalls[i].args += tc.function.arguments;
          }
        }
      }

      const calls = Object.values(toolCalls);
      if (calls.length > 0) {
        usedTool = true;
        // 「道具を呼んで」と言ったLLMの発言を会話に残す
        convo.push({
          role: "assistant",
          content: assistantContent || null,
          tool_calls: calls.map((c) => ({
            id: c.id, type: "function",
            function: { name: c.name, arguments: c.args },
          })),
        });
        // 道具を実際に実行して、結果を会話に足す
        for (const c of calls) {
          let result = "不明な道具です";
          let summary = "";   // ★第6章: 画面に出す1行の要約（LLMに渡す result とは別物）
          // 引数なしで呼ばれる道具は c.args が空文字で来ることがある → そのまま parse すると落ちる
          const args = c.args ? JSON.parse(c.args) : {};
          if (c.name === "calculate") {
            result = calculate(Number(args.a), Number(args.b), args.op);
            summary = result;
          } else if (c.name === "get_timeline") {
            result = await getTimeline(args.limit);
            summary = result.startsWith("タイムラインを読めません") || result.startsWith("投稿がまだ")
              ? result
              : result.split("\n").length + "件読みました";
          } else if (c.name === "search_web") {
            result = await searchWeb(args.query);
            const nCites = (result.match(/^- /gm) || []).length;
            summary = nCites ? `調べました（出典${nCites}件）` : "調べました";
          } else if (c.name === "propose_post") {
            // ★第4章の心臓: ここでは【DBに一切書かない】。下書きをブラウザへ渡すだけ
            const draft = String(args.body ?? "").trim();
            if (!draft) {
              result = "下書きが空でした。本文を入れてもう一度提案してください。";
              summary = result;
            } else if (draft.length > 500) {
              // 黙って切るとURLが途中で壊れる。差し戻してLLMに縮めさせる
              // 注: LLMは字数を数えられないので、細かい上限は差し戻し無限ループになる（280で実証済み）。
              //     上限はゆるく取り、削り方は「量」ではなく「内容」で指示する
              result = `本文が長すぎます（${draft.length}字）。話題を1〜2個に絞って、いまの半分の長さでもう一度この道具を呼んでください。URLは末尾に。`;
              summary = `長すぎたため差し戻し（${draft.length}字）`;
            } else {
              // 文字列ではなくオブジェクトを流す。ブラウザはこれを見て確認ダイアログを出す
              res.write("data: " + JSON.stringify({ type: "draft", body: draft }) + "\n\n");
              // LLMには「まだ投稿されていない」ことをはっきり伝える（勝手に完了報告させない）
              result = "下書きをユーザーに提示しました。まだ投稿されていません。ユーザーが画面で確認するのを待っています。あなたからは投稿できません。";
              summary = "下書きを提示しました（確認待ち）";
            }
          }
          // ★第6章: Claude Code 風の2行に畳む。中身の全文ではなく「何をして、どうだったか」だけ出す
          //   ⏺ get_timeline(limit: 10)
          //     └ 9件読みました
          const argStr = Object.entries(args)
            .map(([k, v]) => `${k}: ${typeof v === "string" ? `"${v.length > 24 ? v.slice(0, 24) + "…" : v}"` : v}`)
            .join(", ");
          res.write("data: " + JSON.stringify(`\n⏺ ${c.name}(${argStr})\n  └ ${summary || result}\n`) + "\n\n");
          convo.push({ role: "tool", tool_call_id: c.id, content: result });
        }
        // ループ先頭に戻り、結果を踏まえた最終回答をまた流す
      }
    }
    res.write("data: [DONE]\n\n"); // 終わりの合図

    await supabase.rpc("increment_usage", {
      p_user_id: req.userId,
      p_day: today,
      p_tokens: totalTokens,
    });
  } catch (err) {
    console.error("ストリーム中に失敗:", err);
    res.write("data: [ERROR]\n\n");
  } finally {
    res.end(); // 流しおわり。接続を閉じる
  }
});

// 古い会話を短い要約にまとめ直す窓口（要約づくりもLLMに頼む）
app.post("/api/summarize", requireUser, async (req, res) => {
  const { oldSummary, overflowed } = req.body;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "次の要約と新しい発言を、短い要約にまとめ直して。固有名詞・決定事項は必ず残して。" },
        { role: "user", content: `これまでの要約:\n${oldSummary}\n\n新しい発言:\n${overflowed}` },
      ],
    });
    res.json({ summary: completion.choices[0].message.content });
  } catch (err) {
    console.error("要約に失敗:", err);
    res.status(500).json({ error: "要約に失敗しました" });
  }
});

// 発言から「長く覚えるべき事実」だけを抜き出す窓口（メモリ用）
app.post("/api/extract-fact", requireUser, async (req, res) => {
  const { text } = req.body;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "次の発言から、長く覚えるべき事実だけ短く抜き出して。なければ空に。住所・電話番号・カード番号などの機微な個人情報は抜き出さないで。" },
        { role: "user", content: text },
      ],
    });
    res.json({ fact: (completion.choices[0].message.content ?? "").trim() });
  } catch (err) {
    console.error("事実抽出に失敗:", err);
    res.status(500).json({ error: "抽出に失敗しました" });
  }
});

// テキストを「意味のベクトル(embedding)」に変換する窓口（意味検索・pgvector用）
// キーはサーバーだけが持つので、埋め込み計算もここを通す
app.post("/api/embed", requireUser, async (req, res) => {
  const { text } = req.body;
  try {
    const r = await openai.embeddings.create({
      model: "text-embedding-3-small",          // 1536次元。Supabaseの vector(1536) と合わせる
      input: (text ?? "").slice(0, 8000),
    });
    res.json({ embedding: r.data[0].embedding });
  } catch (err) {
    console.error("embedに失敗:", err);
    res.status(500).json({ error: "embedに失敗しました" });
  }
});

// 最新情報をWeb検索して答える窓口（OpenAI純正の web_search ツール。出典つき）
// キーはサーバーだけが持つ。答え本文＋引用元(URL/タイトル)を返す。
app.post("/api/websearch", requireUser, async (req, res) => {
  const { input } = req.body;
  try {
    const r = await openai.responses.create({
      model: "gpt-4.1-mini",                    // web_search対応・軽量
      tools: [{ type: "web_search" }],
      input: (input ?? "").slice(0, 4000),
    });
    // 出典（URL＋タイトル）を集める
    const citations: { url: string; title: string }[] = [];
    for (const item of (r.output ?? []) as any[]) {
      if (item.type !== "message") continue;
      for (const c of (item.content ?? []) as any[]) {
        for (const a of (c.annotations ?? []) as any[]) {
          if (a.type === "url_citation") citations.push({ url: a.url, title: a.title });
        }
      }
    }
    res.json({ text: r.output_text, citations });
  } catch (err) {
    console.error("web検索に失敗:", err);
    res.status(500).json({ error: "web検索に失敗しました" });
  }
});

// ローカルは3000、本番（Renderなど）はプラットフォームが渡すPORTを使う
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("起動 → port " + PORT));
