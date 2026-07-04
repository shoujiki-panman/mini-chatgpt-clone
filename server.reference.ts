// server.ts  （鍵を知っているのはこのサーバーだけ）
import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());
app.use(express.static("public")); // 画面（public/index.html）も同じサーバーから配る

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = "あなたは親切で、やさしい日本語で答えるアシスタントです。";

app.post("/api/chat", async (req, res) => {
  const { messages } = req.body; // ← 1発言ではなく「全履歴」を受け取る
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages, // ← 届いた全履歴をそのままLLMへ
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error("OpenAI呼び出しに失敗:", err);
    res.status(500).json({ error: "返事の生成に失敗しました" });
  }
});

app.listen(3000, () => console.log("起動 → http://localhost:3000"));
