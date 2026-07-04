// server.ts — 自分のサーバー（お店＝店員）。ここに自分の手で書いていく。
// 迷ったら答え合わせ: server.reference.ts
import express from "express";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());
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

app.post("/api/chat", requireUser, async (req, res) => {
  const { messages } = req.body;
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
  const convo = [...messages]; // 道具の結果を足していく作業用コピー

  try {
    let usedTool = true;
    let guard = 0;
    // 道具を呼ぶ→実行→また聞く、を最大3回まで（無限ループ防止＝背骨②）
    while (usedTool && guard < 3) {
      guard++;
      usedTool = false;

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: convo,
        tools,                                   // ★道具の説明書も渡す
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
          if (c.name === "calculate") {
            const args = JSON.parse(c.args);
            result = calculate(Number(args.a), Number(args.b), args.op);
          }
          res.write("data: " + JSON.stringify(`\n[道具 ${c.name} を実行 → ${result}]\n`) + "\n\n");
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

app.listen(3000, () => console.log("起動 → http://localhost:3000"));
