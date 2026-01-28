<template>
  <main class="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center p-6">
    <div class="w-full max-w-3xl space-y-4">
      <h1 class="text-xl font-semibold">ChatGPT</h1>

      <div class="flex flex-col lg:flex-row gap-4">

        <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-4 h-fit">
          <div class="flex flex-col gap-2">
            <label class="text-sm text-zinc-300" for="apiKey">Данные для OpenAI API</label>
  
            <div class="flex flex-col gap-2">
              <input
                v-model="apiKey"
                id="apiKey"
                class="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-600"
                placeholder="sk-......."
                @keydown.enter.prevent
                type="password"
              />
              <input
                v-model="apiBaseUrl"
                id="apiBaseUrl"
                class="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-600"
                placeholder="https://api.openai.com/v1"
                @keydown.enter.prevent
              />
            </div>
            <p class="text-xs text-zinc-400">
              Если поля пустые — backend возьмёт ключ/URL из <code>.env</code>.
            </p>
          </div>
        </div>
  
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl w-full">
          <div ref="messagesEl" class="h-[45vh] lg:h-[65vh] overflow-y-auto p-4 space-y-3">
            <div v-if="messages.length === 0" class="text-zinc-400 text-sm">
              Напишите сообщение, чтобы начать чат.
            </div>
  
            <div
              v-for="m in messages"
              :key="m.id"
              class="flex"
              :class="m.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-[85%] rounded-2xl px-3 py-2 text-sm border"
                :class="m.role === 'user'
                  ? 'bg-zinc-950 border-zinc-800'
                  : 'bg-zinc-800/40 border-zinc-700'"
              >
                <div class="text-[11px] mb-1 opacity-70">
                  {{ m.role === "user" ? "Вы" : "Assistant" }}
                  <span v-if="m.streaming" class="ml-2">(печатает…)</span>
                </div>
  
                <div class="whitespace-pre-wrap leading-relaxed">
                  {{ m.content }}
                </div>
  
                <div v-if="m.error" class="mt-2 text-red-300 text-xs">
                  Ошибка: {{ m.error }}
                </div>
              </div>
            </div>
          </div>
  
          <div class="border-t border-zinc-800 p-4 space-y-3">
            <div class="flex flex-col gap-2">
              <label class="text-sm text-zinc-300" for="prompt">Ваше сообщение</label>
  
              <div class="flex flex-wrap gap-2">
                <button
                  class="px-3 w-10 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-center"
                  :disabled="loading || !speechSupported"
                  @click="toggleMic"
                  :title="speechSupported ? (listening ? 'Остановить запись' : 'Записать голос') : 'Speech API не поддерживается'"
                >
                  <Icon name="lucide:mic-off" v-if="!speechSupported" class="min-w-4 min-h-4" />
                  <Icon name="lucide:mic" v-else-if="!listening" class="min-w-4 min-h-4" />
                  <Icon name="lucide:circle-stop" v-else class="min-w-4 min-h-4" />
                </button>

                <input
                  v-model="text"
                  class="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-600"
                  placeholder="Введите текст или нажмите микрофон…"
                  @keydown.enter.prevent="sendStream"
                  id="prompt"
                />
  
                <button
                  class="px-3 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-center"
                  :disabled="loading"
                  @click="sendStream"
                  title="Отправить"
                >
                  <Icon name="lucide:send" class="min-w-4 min-h-4" />
                </button>
  
                <!-- <button
                  class="px-3 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 disabled:opacity-50"
                  :disabled="loading || messages.length === 0"
                  @click="clearChat"
                  title="Очистить"
                >
                  Очистить
                </button> -->
              </div>
  
              <div class="flex items-center gap-3 text-sm">
                <div v-if="loading" class="text-zinc-300">Загрузка…</div>
                <div v-else-if="listening" class="text-zinc-300">Слушаю… говорите</div>
                <div v-if="error" class="text-red-400">{{ error }}</div>
              </div>
            </div>
  
            <p class="text-xs text-zinc-400">
              Enter отправляет сообщение в чат. История хранится только в памяти страницы.
            </p>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()

const text = ref("")
const apiBaseUrl = ref("")
const apiKey = ref("")

const error = ref<string | null>(null)
const loading = ref(false)

type Role = "user" | "assistant"

type ChatMessage = {
  id: string
  role: Role
  content: string
  streaming?: boolean
  error?: string | null
  createdAt: number
}

const messages = ref<ChatMessage[]>([])

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const messagesEl = ref<HTMLElement | null>(null)
function scrollToBottom() {
  nextTick(() => {
    const el = messagesEl.value
    if (!el) return
    el.scrollTop = el.scrollHeight
  })
}

function clearChat() {
  messages.value = []
  error.value = null
  text.value = ""
}

// ---- Voice ----
const speechSupported = ref(false)
type SpeechRecognition = any
let recognition: SpeechRecognition | null = null
const listening = ref(false)

function initRecognition() {
  if (!speechSupported.value || recognition) return

  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  recognition = new SR()
  recognition.lang = "ru-RU"
  recognition.continuous = false
  recognition.interimResults = false

  recognition.onstart = () => {
    listening.value = true
    error.value = null
  }

  recognition.onend = () => {
    listening.value = false
  }

  recognition.onerror = (e: any) => {
    error.value = `Ошибка распознавания речи: ${e?.error || "unknown"}`
    listening.value = false
  }

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    const transcript = event.results?.[0]?.[0]?.transcript ?? ""
    if (transcript) {
      text.value = text.value ? `${text.value} ${transcript}` : transcript
    }
  }
}

function toggleMic() {
  initRecognition()
  if (!recognition) return
  if (listening.value) recognition.stop()
  else recognition.start()
}

async function send() {
  error.value = null

  const msg = text.value.trim()
  if (!msg) {
    error.value = "Введите текст перед отправкой."
    return
  }

  const userMsg: ChatMessage = { id: uid(), role: "user", content: msg, createdAt: Date.now() }
  messages.value.push(userMsg)

  const assistantMsg: ChatMessage = {
    id: uid(),
    role: "assistant",
    content: "",
    streaming: true,
    createdAt: Date.now(),
  }
  messages.value.push(assistantMsg)

  text.value = ""
  scrollToBottom()

  loading.value = true
  await $fetch<{ answer: string }>(`${config.public.apiUrl}/api/chat`, {
    method: "POST",
    body: { text: msg, baseUrl: apiBaseUrl.value, apiKey: apiKey.value },
  })
    .then((r) => {
      assistantMsg.content = r.answer
      assistantMsg.streaming = false
      scrollToBottom()
    })
    .catch((e) => {
      const msg = e?.data?.error || e?.message || "Ошибка запроса"
      assistantMsg.streaming = false
      assistantMsg.error = msg
      error.value = msg
      scrollToBottom()
    })
    .finally(() => {
      loading.value = false
    })
}

async function sendStream() {
  error.value = null

  const msg = text.value.trim()
  if (!msg) {
    error.value = "Введите текст перед отправкой."
    return
  }

  const userMsg: ChatMessage = { id: uid(), role: "user", content: msg, createdAt: Date.now() }
  messages.value.push(userMsg)
  const history = [...messages.value]

  const assistantMsg: ChatMessage = {
    id: uid(),
    role: "assistant",
    content: "",
    streaming: true,
    createdAt: Date.now(),
  }
  messages.value.push(assistantMsg)
  const index = messages.value.length-1

  text.value = ""
  scrollToBottom()

  loading.value = true

  try {
    const res = await fetch(`${config.public.apiUrl}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: msg,
        history: history,
        baseUrl: apiBaseUrl.value,
        apiKey: apiKey.value,
      }),
    })

    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "")
      throw new Error(t || `HTTP ${res.status}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder("utf-8")
    let buffer = ""

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const parts = buffer.split("\n\n")
      buffer = parts.pop() ?? ""

      for (const part of parts) {
        const lines = part.split("\n")

        let eventName = "message"
        let dataStr = ""

        for (const line of lines) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim()
          if (line.startsWith("data:")) dataStr += line.slice(5).trim()
        }

        if (!dataStr) continue

        const payload = JSON.parse(dataStr)

        if (eventName === "token") {
          messages.value[index]!.content += payload.delta ?? ""
          scrollToBottom()
        } else if (eventName === "error") {
          throw new Error(payload.error || "Stream error")
        } else if (eventName === "done") {
        }
      }
    }

    messages.value[index]!.streaming = false
    scrollToBottom()
  } catch (e: any) {
    const msg = e?.message || "Ошибка стриминга"
    messages.value[index]!.streaming = false
    messages.value[index]!.error = msg
    error.value = msg
    scrollToBottom()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  speechSupported.value = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
})
</script>
