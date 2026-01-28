import express, { type Request, type Response } from "express"
import cors from "cors"
import dotenv from "dotenv"
import OpenAI from "openai"

dotenv.config()

const app = express()

app.use(cors({ origin: true }))
app.use(express.json({ limit: "1mb" }))

const port = Number(process.env.PORT ?? 3001)

if (!process.env.OPENAI_API_KEY) {
  console.warn("WARNING: OPENAI_API_KEY is not set in .env")
}


type Role = "user" | "assistant"

type ChatMessage = {
  id: string
  role: Role
  content: string
  streaming?: boolean
  error?: string | null
  createdAt: number
}

type ChatRequestBody = {
  text?: string

  history?: ChatMessage[]

  apiKey?: string
  baseUrl?: string
}

app.post(
  "/api/chat",
  async (req: Request<{}, {}, ChatRequestBody>, res: Response) => {
    try {
      const text = (req.body?.text ?? "").trim()

      const client = new OpenAI({
        apiKey: req.body.apiKey || process.env.OPENAI_API_KEY,
        baseURL: req.body.baseUrl || process.env.OPENAI_BASE_URL
      })

      if (!text) return res.status(400).json({ error: "Пустой текст" })

      const completion = await client.chat.completions.create({
        model: 'gpt-5-mini',
        messages: req.body.history ?? [
          { role: "system", content: "Ты полезный ассистент. Будь живым, отвечай по-русски и не веди себя как робот." },
          { role: "user", content: text },
        ],
        temperature: 0.7
      })

      const answer = completion.choices?.[0]?.message?.content ?? ""
      return res.json({ answer })
    } catch (err: any) {
      console.error(err)

      const status = Number(err?.status ?? 500)
      const message =
        err?.error?.message ||
        err?.message ||
        "Неизвестная ошибка при обращении к модели"

      return res.status(status).json({ error: message })
    }
  }
)

function sseHeaders(res: Response) {
  res.status(200)
  res.setHeader("Content-Type", "text/event-stream charset=utf-8")
  res.setHeader("Cache-Control", "no-cache, no-transform")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("X-Accel-Buffering", "no")
  res.flushHeaders?.()
}

function sseSend(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

app.post(
  "/api/chat/stream",
  async (req: Request<{}, {}, ChatRequestBody>, res: Response) => {
    const text = (req.body?.text ?? "").trim()
    if (!text) return res.status(400).json({ error: "Пустой текст" })

    const client = new OpenAI({
      apiKey: req.body.apiKey || process.env.OPENAI_API_KEY,
      baseURL: req.body.baseUrl || process.env.OPENAI_BASE_URL,
    })

    sseHeaders(res)

    try {
      const stream = await client.chat.completions.create({
        model: "gpt-5-mini",
        messages: req.body.history ?? [
          { role: "system", content: "Ты полезный ассистент. Будь живым, отвечай по-русски и не веди себя как робот." },
          { role: "user", content: text },
        ],
        temperature: 0.7,
        stream: true,
      })

      console.log(stream)

      sseSend(res, "meta", { ok: true })

      for await (const chunk of stream) {
        console.log(chunk)

        const delta = chunk.choices?.[0]?.delta?.content ?? ""
        if (delta) sseSend(res, "token", { delta })
      }

      sseSend(res, "done", { ok: true })
      res.end()
    } catch (err: any) {
      const message =
        err?.error?.message || err?.message || "Ошибка стриминга"
      sseSend(res, "error", { error: message, status: err?.status ?? 500 })
      res.end()
    }
  }
)

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`)
})
