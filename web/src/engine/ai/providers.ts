// Direct browser providers: OpenAI-compatible Chat Completions or Anthropic
// Messages. The learner's key never passes through our server.

import { bi, type Bi } from '../../core/i18n';

export type ProviderId = 'deepseek' | 'openrouter' | 'openai' | 'custom' | 'ollama' | 'gemini' | 'anthropic';

export interface ProviderPreset {
  id: ProviderId;
  api?: 'anthropic';
  name: string;
  /** Base URL without the trailing /chat/completions. */
  baseUrl: string;
  /** Whether the URL field is shown (custom endpoint, a different Ollama port). */
  editableUrl: boolean;
  needsKey: boolean;
  defaultModel: string;
  /** Where to get a key, or how to install. */
  keyUrl?: string;
  note: Bi;
  /** Rough cost of the whole course for an active learner (09 §4.3). */
  cost: Bi;
  /** Extra request headers some providers ask for. */
  headers?: Record<string, string>;
}

export const PROVIDERS: ProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    editableUrl: false,
    needsKey: true,
    defaultModel: 'deepseek-flash',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    note: bi(
      'Предоплаченный баланс у провайдера — естественный лимит расходов: положите немного на счёт провайдера и не волнуйтесь о счёте. Если модели по умолчанию нет, нажмите «Загрузить список» и выберите из того, что отдаёт API.',
      'A prepaid balance is a natural spending limit: top up a little and stop worrying about the bill. If the default model is not there, press “Load the list” and pick from what the API returns.',
    ),
    cost: bi('≈ $0,3–1 за весь курс', '≈ $0.3–1 for the whole course'),
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    editableUrl: false,
    needsKey: true,
    defaultModel: 'deepseek/deepseek-chat',
    keyUrl: 'https://openrouter.ai/keys',
    note: bi(
      'Один ключ к сотням моделей; у ключа можно задать лимит расходов. Есть бесплатные модели — с суффиксом `:free`.',
      'One key to hundreds of models; the key can have a spending limit. Free models carry the `:free` suffix.',
    ),
    cost: bi('от $0 (бесплатные модели) до ≈ $1–3 за курс', 'from $0 (free models) to ≈ $1–3 for the course'),
    headers: { 'X-Title': 'DevOps Trainer' },
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    editableUrl: false,
    needsKey: true,
    defaultModel: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
    note: bi('Создайте для курса отдельный проектный ключ с лимитом расходов.', 'Create a separate project key with a spending limit for the course.'),
    cost: bi('≈ $0,5–2 за курс на малых моделях', '≈ $0.5–2 for the course on small models'),
  },
  {
    id: 'gemini', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    editableUrl: false, needsKey: true, defaultModel: 'gemini-2.5-flash', keyUrl: 'https://aistudio.google.com/apikey',
    note: bi('Создайте ключ в Google AI Studio.', 'Create a key in Google AI Studio.'),
    cost: bi('Стоимость зависит от модели.', 'Cost depends on the model.'),
  },
  {
    id: 'anthropic', name: 'Anthropic', api: 'anthropic', baseUrl: 'https://api.anthropic.com/v1',
    editableUrl: false, needsKey: true, defaultModel: 'claude-sonnet-4-5', keyUrl: 'https://platform.claude.com/settings/keys',
    note: bi('Запросы идут из браузера с вашим ключом Anthropic.', 'Requests go from your browser with your Anthropic key.'),
    cost: bi('Стоимость зависит от модели.', 'Cost depends on the model.'),
  },
  {
    id: 'ollama',
    name: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    editableUrl: true,
    needsKey: false,
    defaultModel: 'qwen2.5:7b',
    keyUrl: 'https://ollama.com/download',
    note: bi(
      'Модель работает на вашем компьютере: без ключа, без денег, без сети. Ollama нужно разрешить запросы с адреса курса — команды ниже.',
      'The model runs on your own computer: no key, no money, no network. Ollama must allow requests from the course address — see the commands below.',
    ),
    cost: bi('бесплатно; нужна видеокарта или терпение', 'free; needs a GPU or patience'),
  },
  {
    id: 'custom',
    name: 'OpenAI-compatible',
    baseUrl: '',
    editableUrl: true,
    needsKey: true,
    defaultModel: '',
    note: bi(
      'Любой сервер с API в формате OpenAI: Mistral, Groq, Cloud.ru, vLLM, LM Studio, корпоративный шлюз. Адрес — до `/chat/completions`, например `https://api.mistral.ai/v1`.',
      'Any server with an OpenAI-style API: Mistral, Groq, Cloud.ru, vLLM, LM Studio, a company gateway. The address goes up to `/chat/completions`, e.g. `https://api.mistral.ai/v1`.',
    ),
    cost: bi('зависит от провайдера', 'depends on the provider'),
  },
];

export function preset(id: ProviderId): ProviderPreset {
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) throw new Error(`unknown provider ${id}`);
  return p;
}

export function isLocalUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost');
  } catch {
    return false;
  }
}

/** Normalise a base URL: no trailing slash, no /chat/completions the learner pasted by habit. */
export function normalizeBase(url: string): string {
  return url.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
}

/** The OLLAMA_ORIGINS commands for the setup screen (docs.ollama.com/faq). */
export function ollamaCommands(origin: string): { os: string; cmd: string }[] {
  return [
    { os: 'macOS', cmd: `launchctl setenv OLLAMA_ORIGINS "${origin}"\n# then quit and start the Ollama app again` },
    { os: 'Linux', cmd: `sudo systemctl edit ollama.service\n# add under [Service]:\n# Environment="OLLAMA_ORIGINS=${origin}"\nsudo systemctl daemon-reload && sudo systemctl restart ollama` },
    { os: 'Windows', cmd: `setx OLLAMA_ORIGINS "${origin}"\n# then quit Ollama from the tray and start it again` },
  ];
}
