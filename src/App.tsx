import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation } from 'wouter'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bot,
  BookText,
  Compass,
  Check,
  ChevronDown,
  ChevronsUpDown,
  CircleUserRound,
  Clapperboard,
  Clock3,
  Copy,
  Film,
  Flame,
  Hash,
  Heart,
  Home,
  Image,
  ImagePlus,
  Laugh,
  Menu,
  MessageCircle,
  MessageSquare,
  MessageSquareDot,
  PanelsTopLeft,
  Paperclip,
  Pencil,
  Plus,
  Repeat2,
  SearchCheck,
  ShieldCheck,
  Search,
  Send,
  Sparkles,
  TrendingUp,
  Trophy,
  UserPlus,
  UserRound,
  Vote,
  X
} from 'lucide-react'
import { toast } from 'sonner'

type AIView = 'home' | 'writer' | 'gallery' | 'studio'
type AgentType = 'writer' | 'gallery' | 'studio'
type MsgKind = 'text' | 'options' | 'loading' | 'writing-result' | 'image-result' | 'video-result' | 'suggestions'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  kind: MsgKind
  text?: string
  options?: string[]
  optionGroup?: 'angle' | 'style'
  suggestions?: string[]
  content?: string
  images?: string[]
  video?: {
    cover: string
    duration: string
    ratio: string
    resolution: string
  }
}

interface Conversation {
  id: string
  agentType: AgentType
  title: string
  createdAt: number
  messages: ChatMessage[]
  model: string
  selectedSkills: string[]
  extraParamValues: Record<string, string>
  meta?: {
    writerStep?: 0 | 1 | 2 | 3
  }
}

interface AITask {
  id: string
  title: string
  agentType: AgentType
  model: string
  progress: number
  status: 'in_progress' | 'completed'
  createdAt: number
  conversationId: string
  loadingMessageId?: string
  paramsSnapshot?: Record<string, string>
}

interface AgentConfig {
  id: AgentType
  name: string
  description: string
  color: string
  icon: ReactNode
  models: Array<{ name: string; provider: string; recommended?: boolean; desc?: string }>
  skills: string[]
  params?: Array<{ key: string; label: string; options: string[] }>
}

interface AppCtx {
  isAICreationMode: boolean
  currentAIView: AIView
  activeConversation: Conversation | null
  conversations: Conversation[]
  tasks: AITask[]
  isTaskPanelOpen: boolean
  publisherText: string
  publisherImages: string[]
  publisherVideo: string | null
  selectedModel: string
  selectedSkills: string[]
  extraParamValues: Record<string, string>
  aiReadyBanner: boolean
  enterAICreation: (view?: AIView) => void
  exitAICreation: () => void
  setAIView: (view: AIView) => void
  startConversation: (agentType: AgentType, seed?: { text?: string; model?: string; skills?: string[] }) => Conversation
  sendToPublisher: (payload?: { text?: string; images?: string[]; video?: string }) => void
  addTask: (task: AITask) => void
  updateTask: (id: string, updates: Partial<AITask>) => void
  toggleTaskPanel: (open?: boolean) => void
  goToConversation: (id: string) => void
  sendUserInput: (text: string) => void
  selectOption: (option: string, group: 'angle' | 'style') => void
  setSelectedModel: (model: string) => void
  setSelectedSkills: (skills: string[]) => void
  setExtraParamValues: (values: Record<string, string>) => void
  closeBanner: () => void
  setPublisherText: (text: string) => void
}

const agentConfigs: Record<AgentType, AgentConfig> = {
  writer: {
    id: 'writer',
    name: 'AI 妙笔',
    description: '智能写作助手',
    color: '#8B5CF6',
    icon: <Pencil size={16} />,
    models: [
      { name: 'Qwen 3.0', provider: '通义', recommended: true, desc: '平衡速度与质量' },
      { name: 'DeepSeek R1', provider: 'DeepSeek', desc: '更强推理能力' },
      { name: 'GPT-4o', provider: 'OpenAI', desc: '多场景稳定生成' },
      { name: 'Claude 4', provider: 'Anthropic', desc: '长文本结构化更好' }
    ],
    skills: ['热点追踪', '风格迁移', 'SEO优化', '智能配图']
  },
  gallery: {
    id: 'gallery',
    name: 'AI 画廊',
    description: '图片生成工坊',
    color: '#3B82F6',
    icon: <Image size={16} />,
    models: [
      { name: 'SeeArt Pro', provider: '字节', recommended: true, desc: '出图快，风格稳定' },
      { name: 'Midjourney v7', provider: 'Midjourney', desc: '创意表达强' },
      { name: 'DALL·E 4', provider: 'OpenAI', desc: '提示词容错高' },
      { name: 'Flux Pro', provider: 'Black Forest', desc: '高保真细节' }
    ],
    skills: ['风格参考', '背景移除', '超分辨率', '批量生成'],
    params: [
      { key: 'ratio', label: '画面比例', options: ['1:1方形', '4:3横版', '3:4竖版', '16:9宽屏', '9:16竖屏'] },
      { key: 'style', label: '画风', options: ['写实', '动漫', '水彩', '油画', '水墨', '3D渲染'] }
    ]
  },
  studio: {
    id: 'studio',
    name: 'AI 影室',
    description: '视频创作中心',
    color: '#10B981',
    icon: <Clapperboard size={16} />,
    models: [
      { name: 'SeeDance 2.0', provider: '字节', recommended: true, desc: '短视频生成效率高' },
      { name: 'Kling 2.0', provider: '快手', desc: '镜头语言更丰富' },
      { name: 'Veo 3', provider: 'Google', desc: '高质量动态细节' },
      { name: 'Sora 2', provider: 'OpenAI', desc: '复杂场景表现强' }
    ],
    skills: ['图生视频', '视频续写', '音频生成', '字幕生成'],
    params: [
      { key: 'duration', label: '时长', options: ['4秒', '8秒', '15秒', '30秒'] },
      { key: 'resolution', label: '分辨率', options: ['720p', '1080p', '4K'] },
      { key: 'ratio', label: '画面比例', options: ['16:9横版', '9:16竖版', '1:1方形'] }
    ]
  }
}

const promptTags = [
  { text: '帮我写一条关于AI视频工具对比的微博', hot: true, agent: 'writer' as AgentType },
  { text: '生成一张国风水墨风格的山水画配图', agent: 'gallery' as AgentType },
  { text: '用SeeDance生成一段赛博朋克城市夜景', hot: true, agent: 'studio' as AgentType },
  { text: '写一篇2026年AI行业趋势分析', agent: 'writer' as AgentType },
  { text: '生成一段产品展示的15秒短视频', agent: 'studio' as AgentType },
  { text: '设计一张科技风格的活动海报', agent: 'gallery' as AgentType }
]

const templatePresets = [
  {
    emoji: '🔥',
    name: '热点评论',
    type: '写作',
    agent: 'writer' as AgentType,
    model: 'Qwen 3.0',
    skills: ['热点追踪'],
    desc: '快速跟进热搜，生成观点型短评'
  },
  {
    emoji: '🛍️',
    name: '产品种草',
    type: '写作',
    agent: 'writer' as AgentType,
    model: 'Qwen 3.0',
    skills: ['SEO优化'],
    desc: '突出卖点并优化转化表达'
  },
  {
    emoji: '☕',
    name: '日常分享',
    type: '写作',
    agent: 'writer' as AgentType,
    model: 'Qwen 3.0',
    skills: [],
    desc: '生活场景轻量表达，一键成文'
  },
  {
    emoji: '📘',
    name: '知识科普',
    type: '写作',
    agent: 'writer' as AgentType,
    model: 'DeepSeek R1',
    skills: ['SEO优化'],
    desc: '结构化讲解复杂概念'
  },
  {
    emoji: '🖌️',
    name: '国风水墨',
    type: '图片',
    agent: 'gallery' as AgentType,
    model: 'SeeArt Pro',
    skills: [],
    desc: '水墨笔触与留白构图生成'
  },
  {
    emoji: '📣',
    name: '海报设计',
    type: '图片',
    agent: 'gallery' as AgentType,
    model: 'Midjourney v7',
    skills: [],
    desc: '活动主视觉与宣传海报快速出图'
  },
  {
    emoji: '🌆',
    name: '风景延时',
    type: '视频',
    agent: 'studio' as AgentType,
    model: 'SeeDance 2.0',
    skills: [],
    desc: '生成具备镜头变化的延时风格短片'
  },
  {
    emoji: '🎬',
    name: '产品展示',
    type: '视频',
    agent: 'studio' as AgentType,
    model: 'Kling 2.0',
    skills: [],
    desc: '15秒卖点演示，适配信息流投放'
  }
]

const feedPosts = [
  {
    id: 'post-1',
    name: '新浪科技',
    verified: '媒体认证',
    time: '2分钟前',
    source: '微博网页版',
    text: '微博 AI 创作空间进入内测，用户可在发布前直接与智能体协作完成图文视频创作，创作链路从“想法”到“发布”一站式完成。',
    images: ['https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=960&q=80'],
    stat: { repost: 182, comment: 64, like: 1200 }
  },
  {
    id: 'post-2',
    name: '产品观察员',
    verified: '微博优质创作者',
    time: '15分钟前',
    source: 'iPhone 17 Pro',
    text: '试用了“千问AI创作”，从文案骨架、配图生成到发布前改写都在一个入口完成。产品决策点很清晰：减少跳出、缩短发布时间。',
    images: [
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=560&q=80',
      'https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?auto=format&fit=crop&w=560&q=80',
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=560&q=80',
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=560&q=80'
    ],
    stat: { repost: 98, comment: 39, like: 860 }
  },
  {
    id: 'post-3',
    name: '设计研究社',
    verified: '微博设计博主',
    time: '1小时前',
    source: '微博网页版',
    text: '把 AI 入口放在主发布器，不是“新增一个工具”，而是把创作心智放在最短路径上。交互里最重要的是保持主站风格一致，避免割裂。',
    stat: { repost: 76, comment: 25, like: 531 }
  },
  {
    id: 'post-4',
    name: '前端群星',
    verified: '互联网博主',
    time: '3小时前',
    source: '微博网页版',
    text: 'React + Motion 做复杂交互确实顺手，但要先把“会话、任务、发布器”三套状态边界划清楚，否则后期功能越加越乱。',
    stat: { repost: 43, comment: 14, like: 309 }
  },
  {
    id: 'post-5',
    name: 'AI视频日报',
    verified: '微博原创视频博主',
    time: '昨天 21:36',
    source: '微博视频号',
    text: 'SeeDance 与 Kling 新版本都在迭代视频一致性，你更看好哪家？评论区欢迎放真实生成样片。',
    images: ['https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=960&q=80'],
    stat: { repost: 133, comment: 82, like: 974 }
  },
  {
    id: 'post-6',
    name: '知识创作周刊',
    verified: '头条文章作者',
    time: '昨天 18:22',
    source: 'HUAWEI Mate X6',
    text: '#AIGC工具实测# 做知识向账号，真正需要的是“稳定风格 + 快速改写 + 素材复用”三件套。AI创作空间在这点上已经有雏形。',
    stat: { repost: 27, comment: 17, like: 216 }
  }
]

const hotList = [
  { title: '王鑫被查', heat: '10:57登顶', hot: true },
  { title: '曝谢霆锋张柏芝结婚与王菲有关', heat: '885924', hot: true },
  { title: '王菲 春晚', heat: '692075', hot: true },
  { title: '中戏已有两位表演系主任主动投案', heat: '556347', hot: true },
  { title: 'Deepseek被指变冷淡了', heat: '凌晨霸榜', hot: false },
  { title: '湛江一海滩发现疑似儒艮尸体', heat: '353572', hot: false },
  { title: '刘大锤聊赵丽颖恋情近况', heat: '09:39登顶', hot: true },
  { title: '方家翊整容', heat: '381219', hot: false },
  { title: '蒙古感谢中方', heat: '81751', hot: false },
  { title: '无锡威玛犬', heat: '48226', hot: false }
]

const recommends = [
  { name: 'chun-明', desc: '体育博主 头条文章作者' },
  { name: '丁旭1984', desc: '微博原创视频博主' },
  { name: '兵峰', desc: '天津市津南区兵峰摄影工作室 摄影师' },
  { name: '设计灵感Bot', desc: '设计领域精选内容聚合' }
]

const defaultTasks: AITask[] = [
  {
    id: 'task-demo-1',
    title: '赛博朋克城市夜景 - 4K视频',
    agentType: 'studio',
    model: 'SeeDance 2.0',
    progress: 67,
    status: 'in_progress',
    createdAt: Date.now() - 2 * 60 * 60 * 1000,
    conversationId: 'demo-1'
  },
  {
    id: 'task-demo-2',
    title: '国风山水画 - 高清配图',
    agentType: 'gallery',
    model: 'SeeArt Pro',
    progress: 100,
    status: 'completed',
    createdAt: Date.now() - 6 * 60 * 60 * 1000,
    conversationId: 'demo-2'
  },
  {
    id: 'task-demo-3',
    title: '科技行业分析长文',
    agentType: 'writer',
    model: 'Qwen 3.0',
    progress: 100,
    status: 'completed',
    createdAt: Date.now() - 26 * 60 * 60 * 1000,
    conversationId: 'demo-3'
  },
  {
    id: 'task-demo-4',
    title: '产品宣传片 - 15秒短视频',
    agentType: 'studio',
    model: 'Kling 2.0',
    progress: 100,
    status: 'completed',
    createdAt: Date.now() - 36 * 60 * 60 * 1000,
    conversationId: 'demo-4'
  }
]

const AppContext = createContext<AppCtx | null>(null)

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function relativeTime(ts: number) {
  const diff = Date.now() - ts
  const h = Math.floor(diff / (1000 * 60 * 60))
  if (h < 1) return '刚刚'
  if (h < 24) return `${h}小时前`
  return `${Math.floor(h / 24)}天前`
}

function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('missing app context')
  return ctx
}

function AppProvider({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation()
  const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const withBase = (path: string) => {
    const normalizedBase = basePath === '/' ? '' : basePath
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${normalizedBase}${normalizedPath}`
  }
  const withoutBase = (path: string) => {
    const normalizedBase = basePath === '/' ? '' : basePath
    return normalizedBase && path.startsWith(normalizedBase) ? path.slice(normalizedBase.length) || '/' : path
  }
  const [isAICreationMode, setIsAICreationMode] = useState(false)
  const [currentAIView, setCurrentAIView] = useState<AIView>('home')
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [tasks, setTasks] = useState<AITask[]>(defaultTasks)
  const [isTaskPanelOpen, setTaskPanelOpen] = useState(false)
  const [publisherText, setPublisherText] = useState('')
  const [publisherImages, setPublisherImages] = useState<string[]>([])
  const [publisherVideo, setPublisherVideo] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState('Qwen 3.0')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [extraParamValues, setExtraParamValues] = useState<Record<string, string>>({})
  const [aiReadyBanner, setAIReadyBanner] = useState(false)

  const enterAICreation = (view: AIView = 'home') => {
    setIsAICreationMode(true)
    setCurrentAIView(view)
    navigate(view === 'home' ? withBase('/ai') : withBase(`/ai/${view}`))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const exitAICreation = () => {
    setIsAICreationMode(false)
    setCurrentAIView('home')
    navigate(withBase('/'))
  }

  const setAIView = (view: AIView) => {
    setCurrentAIView(view)
    if (view !== 'home') {
      navigate(withBase(`/ai/${view}`))
    } else {
      navigate(withBase('/ai'))
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startConversation = (agentType: AgentType, seed?: { text?: string; model?: string; skills?: string[] }) => {
    const id = uid()
    const cfg = agentConfigs[agentType]
    const model = seed?.model ?? cfg.models.find((m) => m.recommended)?.name ?? cfg.models[0].name
    const paramDefaults =
      cfg.params?.reduce<Record<string, string>>((acc, param) => {
        acc[param.key] = param.options[0]
        return acc
      }, {}) ?? {}
    const introByAgent: Record<AgentType, string> = {
      writer: 'AI 妙笔已就绪。描述你的主题后，我会先帮你确定写作角度与文案风格。',
      gallery: 'AI 画廊已就绪。告诉我画面主体、风格和用途，我会生成4张候选图。',
      studio: 'AI 影室已就绪。给我场景描述后，我会创建视频任务并持续反馈进度。'
    }
    const convo: Conversation = {
      id,
      agentType,
      title: seed?.text ? seed.text.slice(0, 16) : `${cfg.name}新对话`,
      createdAt: Date.now(),
      model,
      selectedSkills: seed?.skills ?? [],
      extraParamValues: paramDefaults,
      meta: agentType === 'writer' ? { writerStep: 0 } : undefined,
      messages: [
        {
          id: uid(),
          role: 'assistant',
          kind: 'text',
          text: introByAgent[agentType]
        },
        {
          id: uid(),
          role: 'assistant',
          kind: 'suggestions',
          suggestions:
            agentType === 'writer'
              ? ['先给我一个创作方向', '给我三个风格版本', '输出可直接发布版本']
              : agentType === 'gallery'
                ? ['生成国风水墨风格', '做一张活动海报', '按9:16竖版输出']
                : ['做一段15秒产品展示', '生成赛博朋克夜景', '输出4K横版片段']
        }
      ]
    }
    setConversations((prev) => [convo, ...prev])
    setActiveConversation(convo)
    setSelectedModel(model)
    setSelectedSkills(convo.selectedSkills)
    setExtraParamValues(paramDefaults)
    enterAICreation(agentType)
    return convo
  }

  const sendToPublisher = (payload?: { text?: string; images?: string[]; video?: string }) => {
    if (payload?.text) setPublisherText(payload.text)
    if (payload?.images) setPublisherImages(payload.images)
    if (payload?.video) setPublisherVideo(payload.video)
    setAIReadyBanner(true)
    exitAICreation()
    toast.success('AI创作内容已发送到发布器')
  }

  const addTask = (task: AITask) => setTasks((prev) => [task, ...prev])
  const updateTask = (id: string, updates: Partial<AITask>) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)))
  const toggleTaskPanel = (open?: boolean) => setTaskPanelOpen((prev) => (typeof open === 'boolean' ? open : !prev))

  const goToConversation = (id: string) => {
    const convo = conversations.find((c) => c.id === id)
    if (!convo) {
      const task = tasks.find((t) => t.conversationId === id)
      if (task) {
        const created = startConversation(task.agentType, { text: task.title, model: task.model })
        updateTask(task.id, { conversationId: created.id })
        patchConversation(created.id, (c) => ({
          ...c,
          messages: [
            ...c.messages,
            {
              id: uid(),
              role: 'assistant',
              kind: task.agentType === 'writer' ? 'writing-result' : task.agentType === 'gallery' ? 'image-result' : 'video-result',
              ...(task.agentType === 'writer'
                ? {
                    content:
                      '这是从任务面板恢复的内容预览：创作任务已完成，你可以继续优化语气、补充观点，或直接发送到发布器。#AI创作 #微博创作空间'
                  }
                : task.agentType === 'gallery'
                  ? {
                      images: [
                        'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=80',
                        'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=900&q=80',
                        'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=80',
                        'https://images.unsplash.com/photo-1470770903676-69b98201ea1c?auto=format&fit=crop&w=900&q=80'
                      ]
                    }
                  : {
                      video: {
                        cover:
                          'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1200&q=80',
                        duration: task.paramsSnapshot?.duration ?? '15秒',
                        ratio: task.paramsSnapshot?.ratio ?? '16:9横版',
                        resolution: task.paramsSnapshot?.resolution ?? '1080p'
                      }
                    })
            }
          ]
        }))
        toggleTaskPanel(false)
        toast.success('已恢复任务对应会话')
        return
      }
      toast.info('该任务暂无会话记录')
      return
    }
    setActiveConversation(convo)
    setSelectedModel(convo.model)
    setSelectedSkills(convo.selectedSkills)
    setExtraParamValues(convo.extraParamValues)
    setTaskPanelOpen(false)
    enterAICreation(convo.agentType)
  }

  const patchConversation = (id: string, updater: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)))
    setActiveConversation((prev) => (prev && prev.id === id ? updater(prev) : prev))
  }

  const sendUserInput = (text: string) => {
    if (!text.trim()) return
    let convo = activeConversation
    if (!convo) {
      const targetAgent: AgentType = currentAIView === 'home' ? 'writer' : (currentAIView as AgentType)
      convo = startConversation(targetAgent, { model: selectedModel, skills: selectedSkills })
    }

    const userMsg: ChatMessage = { id: uid(), role: 'user', kind: 'text', text }

    if (convo.agentType === 'writer') {
      const step = convo.meta?.writerStep ?? 0
      if (step === 0) {
        patchConversation(convo.id, (c) => ({
          ...c,
          model: selectedModel,
          selectedSkills,
          extraParamValues: { ...extraParamValues },
          meta: { writerStep: 1 },
          messages: [
            ...c.messages,
            userMsg,
            {
              id: uid(),
              role: 'assistant',
              kind: 'options',
              text: '收到，你希望从哪个角度展开？',
              optionGroup: 'angle',
              options: ['技术对比分析', '观点输出', '新闻解读', '实用建议']
            }
          ]
        }))
      } else if (step === 1) {
        patchConversation(convo.id, (c) => ({
          ...c,
          model: selectedModel,
          selectedSkills,
          extraParamValues: { ...extraParamValues },
          meta: { writerStep: 2 },
          messages: [
            ...c.messages,
            userMsg,
            {
              id: uid(),
              role: 'assistant',
              kind: 'options',
              text: '好的，文案风格你更偏向哪种？',
              optionGroup: 'style',
              options: ['专业严谨', '轻松幽默', '犀利点评', '娓娓道来']
            }
          ]
        }))
      } else {
        const loadingId = uid()
        patchConversation(convo.id, (c) => ({
          ...c,
          model: selectedModel,
          selectedSkills,
          extraParamValues: { ...extraParamValues },
          messages: [...c.messages, userMsg, { id: loadingId, role: 'assistant', kind: 'loading', text: '正在思考...' }]
        }))

        setTimeout(() => {
          patchConversation(convo!.id, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === loadingId
                ? {
                    id: uid(),
                    role: 'assistant',
                    kind: 'writing-result',
                    content:
                      '过去一年，AI视频工具从“可用”走向“可落地”。如果你重视镜头连续性，SeeDance在运动场景更稳；如果你追求风格化表达，Kling在叙事感上更有优势。实际选型建议先看三件事：1）生成速度是否满足日更；2）角色一致性是否抗抖动；3）平台分发前是否支持快速二次编辑。对内容团队来说，最优解不是单模型，而是“主力+备份”的组合策略，既保证产能，也能应对热点突发。#AI视频工具 #内容创作 #AIGC'
                  }
                : m
            )
          }))
        }, 1200)
      }
      return
    }

    if (convo.agentType === 'gallery') {
      const loadingId = uid()
      const paramsSnapshot = { ...extraParamValues }
      patchConversation(convo.id, (c) => ({
        ...c,
        model: selectedModel,
        selectedSkills,
        extraParamValues: paramsSnapshot,
        messages: [
          ...c.messages,
          userMsg,
          {
            id: uid(),
            role: 'assistant',
            kind: 'text',
            text: `已确认参数：${selectedModel} · ${paramsSnapshot.ratio ?? '1:1方形'} · ${paramsSnapshot.style ?? '写实'}，开始生成4张候选图。`
          },
          { id: loadingId, role: 'assistant', kind: 'loading', text: '正在思考...' }
        ]
      }))

      setTimeout(() => {
        patchConversation(convo!.id, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === loadingId
              ? {
                  id: uid(),
                  role: 'assistant',
                  kind: 'image-result',
                  images: [
                    'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=80',
                    'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=900&q=80',
                    'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=80',
                    'https://images.unsplash.com/photo-1470770903676-69b98201ea1c?auto=format&fit=crop&w=900&q=80'
                  ]
                }
              : m
          )
        }))
      }, 1400)
      return
    }

    const loadingId = uid()
    const paramsSnapshot = { ...extraParamValues }
    patchConversation(convo.id, (c) => ({
      ...c,
      model: selectedModel,
      selectedSkills,
      extraParamValues: paramsSnapshot,
      messages: [
        ...c.messages,
        userMsg,
        {
          id: uid(),
          role: 'assistant',
          kind: 'text',
          text: `已确认参数：${selectedModel} · ${paramsSnapshot.duration ?? '15秒'} · ${paramsSnapshot.resolution ?? '1080p'} · ${paramsSnapshot.ratio ?? '16:9横版'}，任务已创建。`
        },
        { id: loadingId, role: 'assistant', kind: 'loading', text: '正在思考...' }
      ]
    }))
    const taskId = uid()
    addTask({
      id: taskId,
      title: `${text.slice(0, 18)} - ${paramsSnapshot.resolution ?? '1080p'}视频`,
      agentType: 'studio',
      model: selectedModel,
      progress: 8,
      status: 'in_progress',
      createdAt: Date.now(),
      conversationId: convo.id,
      loadingMessageId: loadingId,
      paramsSnapshot
    })
    setTimeout(() => {
      updateTask(taskId, { progress: 100, status: 'completed' })
      patchConversation(convo!.id, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === loadingId
            ? {
                id: uid(),
                role: 'assistant',
                kind: 'video-result',
                video: {
                  cover:
                    'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1200&q=80',
                  duration: paramsSnapshot.duration ?? '15秒',
                  ratio: paramsSnapshot.ratio ?? '16:9横版',
                  resolution: paramsSnapshot.resolution ?? '1080p'
                }
              }
            : m
        )
      }))
    }, 5200)
    toast.info('视频任务已加入创作任务')
  }

  const selectOption = (option: string, group: 'angle' | 'style') => {
    if (!activeConversation || activeConversation.agentType !== 'writer') return
    const convoId = activeConversation.id
    const userMsg: ChatMessage = { id: uid(), role: 'user', kind: 'text', text: option }

    if (group === 'angle') {
      patchConversation(convoId, (c) => ({
        ...c,
        meta: { writerStep: 2 },
        model: selectedModel,
        selectedSkills,
        extraParamValues: { ...extraParamValues },
        messages: [
          ...c.messages,
          userMsg,
          {
            id: uid(),
            role: 'assistant',
            kind: 'options',
            text: '好的，文案风格你更偏向哪种？',
            optionGroup: 'style',
            options: ['专业严谨', '轻松幽默', '犀利点评', '娓娓道来']
          }
        ]
      }))
      return
    }

    const loadingId = uid()
    patchConversation(convoId, (c) => ({
      ...c,
      meta: { writerStep: 3 },
      model: selectedModel,
      selectedSkills,
      extraParamValues: { ...extraParamValues },
      messages: [...c.messages, userMsg, { id: loadingId, role: 'assistant', kind: 'loading', text: '正在思考...' }]
    }))

    setTimeout(() => {
      patchConversation(convoId, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === loadingId
            ? {
                id: uid(),
                role: 'assistant',
                kind: 'writing-result',
                content:
                  '过去一年，AI视频工具从“可用”走向“可落地”。如果你重视镜头连续性，SeeDance在运动场景更稳；如果你追求风格化表达，Kling在叙事感上更有优势。实际选型建议先看三件事：1）生成速度是否满足日更；2）角色一致性是否抗抖动；3）平台分发前是否支持快速二次编辑。对内容团队来说，最优解不是单模型，而是“主力+备份”的组合策略，既保证产能，也能应对热点突发。#AI视频工具 #内容创作 #AIGC'
              }
            : m
        )
      }))
    }, 1200)
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const completed: AITask[] = []
      setTasks((prev) =>
        prev.map((task) => {
          if (task.status !== 'in_progress') return task
          const progress = Math.min(100, task.progress + Math.floor(Math.random() * 16 + 5))
          if (progress === 100) {
            completed.push({ ...task, progress, status: 'completed' })
            return { ...task, progress, status: 'completed' }
          }
          return { ...task, progress }
        })
      )

      if (completed.length) {
        completed.forEach((task) => {
          if (!task.loadingMessageId) return
          patchConversation(task.conversationId, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === task.loadingMessageId
                ? {
                    id: uid(),
                    role: 'assistant',
                    kind: 'video-result',
                    video: {
                      cover:
                        'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1200&q=80',
                      duration: task.paramsSnapshot?.duration ?? '15秒',
                      ratio: task.paramsSnapshot?.ratio ?? '16:9横版',
                      resolution: task.paramsSnapshot?.resolution ?? '1080p'
                    }
                  }
                : m
            )
          }))
        })
      }
    }, 800)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const rawPath = typeof window !== 'undefined' ? window.location.pathname : location
    const aiMatch = rawPath.match(/\/ai(?:\/(writer|gallery|studio))?$/)
    if (aiMatch) {
      setIsAICreationMode(true)
      const seg = aiMatch[1]
      setCurrentAIView(seg === 'writer' || seg === 'gallery' || seg === 'studio' ? seg : 'home')
      return
    }
    setIsAICreationMode(false)
    setCurrentAIView('home')
  }, [location])

  const value: AppCtx = {
    isAICreationMode,
    currentAIView,
    activeConversation,
    conversations,
    tasks,
    isTaskPanelOpen,
    publisherText,
    publisherImages,
    publisherVideo,
    selectedModel,
    selectedSkills,
    extraParamValues,
    aiReadyBanner,
    enterAICreation,
    exitAICreation,
    setAIView,
    startConversation,
    sendToPublisher,
    addTask,
    updateTask,
    toggleTaskPanel,
    goToConversation,
    sendUserInput,
    selectOption,
    setSelectedModel,
    setSelectedSkills,
    setExtraParamValues,
    closeBanner: () => setAIReadyBanner(false),
    setPublisherText
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

function DotLoading() {
  return (
    <div className="flex items-center gap-1 text-sm text-gray-500">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-gray-400"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 0.45, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
      <span className="ml-1">正在思考...</span>
    </div>
  )
}

function Dropdown({
  open,
  onClose,
  children,
  className = 'absolute left-0 top-full z-30 mt-2 w-72'
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            className="fixed inset-0 z-20 cursor-default bg-transparent"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className={className}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function TopNav() {
  const navItems = [
    { label: '首页', icon: <Home size={15} />, active: true },
    { label: '推荐', icon: <Compass size={15} /> },
    { label: '视频', icon: <Film size={15} /> },
    { label: '消息', icon: <MessageSquare size={15} /> },
    { label: '刘彬', icon: <UserRound size={15} /> }
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-[#e6e6e6] bg-white">
      <div className="mx-auto flex h-[52px] w-full max-w-[1180px] items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-[#ff8200]" />
            <span className="text-sm font-semibold text-[#333]">微博</span>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <button
                key={item.label}
                className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-sm ${
                  item.active ? 'text-[#ff8200]' : 'text-[#333] hover:bg-[#f2f2f5]'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mx-4 flex w-[320px] items-center gap-2 rounded-[16px] bg-[#f2f2f5] px-3 py-1.5">
          <Search size={14} className="text-[#808080]" />
          <input
            className="w-full border-none bg-transparent text-xs text-[#333] outline-none placeholder:text-[#9f9f9f]"
            placeholder="大家都在搜：AIGC"
          />
        </div>

        <div className="flex items-center gap-2 text-[#666]">
          <button className="hidden rounded-full bg-[#ff8200] px-3 py-1 text-xs text-white md:inline-flex">发微博</button>
          <button className="rounded p-1 hover:bg-[#f2f2f5]">
            <Bell size={16} />
          </button>
          <button className="rounded p-1 hover:bg-[#f2f2f5]">
            <MessageCircle size={16} />
          </button>
          <button className="rounded p-1 hover:bg-[#f2f2f5]">
            <Menu size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}

function LeftSidebar() {
  const items = [
    { label: '首页', icon: <Home size={14} />, active: true },
    { label: '热门', icon: <Flame size={14} /> },
    { label: '视频', icon: <Film size={14} /> },
    { label: '消息', icon: <MessageSquareDot size={14} /> },
    { label: '我的', icon: <UserRound size={14} /> },
    { label: '更多', icon: <ChevronsUpDown size={14} /> }
  ]

  return (
    <aside className="space-y-3">
      <section className="rounded-[4px] border border-[#e6e6e6] bg-white p-2">
        {items.map((item) => (
          <button
            key={item.label}
            className={`mb-1 flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-sm ${
              item.active ? 'bg-[#fff4e8] text-[#ff8200]' : 'text-[#333] hover:bg-[#f8f8f8]'
            }`}
          >
            <span className={`${item.active ? 'text-[#ff8200]' : 'text-[#999]'}`}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </section>

      <section className="rounded-[4px] border border-[#e6e6e6] bg-white p-2">
        <div className="mb-2 flex items-center justify-between text-xs text-[#666]">
          <span>自定义分组</span>
          <button className="text-[#999]">管理</button>
        </div>
        {['AI机器人', '国际新闻/军事', '互联网业界', '设计', '游戏'].map((group) => (
          <button key={group} className="mb-1 flex w-full items-center gap-2 rounded-[4px] px-2 py-1 text-left text-xs text-[#666] hover:bg-[#f8f8f8]">
            <span className="text-[10px] text-[#aaa]">●</span>
            {group}
          </button>
        ))}
      </section>
    </aside>
  )
}

function RightSidebar() {
  return (
    <aside className="space-y-3">
      <section className="rounded-[4px] border border-[#e6e6e6] bg-white">
        <div className="flex items-center justify-between border-b border-[#f0f0f0] px-3 py-2">
          <h3 className="text-sm font-medium text-[#333]">微博热搜</h3>
          <button className="inline-flex items-center gap-1 text-xs text-[#999]">
            <TrendingUp size={12} />
            点击刷新
          </button>
        </div>
        <ul className="p-2">
          {hotList.map((item, idx) => (
            <li key={item.title}>
              <button className="flex w-full items-center gap-2 rounded-[4px] px-1 py-1.5 text-left hover:bg-[#f8f8f8]">
                <span className={`w-4 text-center text-xs ${idx < 3 ? 'text-[#ff8200]' : 'text-[#999]'}`}>{idx + 1}</span>
                <span className="line-clamp-1 flex-1 text-xs text-[#333]">{item.title}</span>
                <span className="text-[10px] text-[#999]">{item.heat}</span>
                {item.hot && <span className="text-[10px] text-[#ff8200]">热</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[4px] border border-[#e6e6e6] bg-white p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-[#333]">你可能感兴趣的人</h3>
          <button className="text-xs text-[#999]">换一换</button>
        </div>
        <div className="space-y-3">
          {recommends.map((item) => (
            <div key={item.name} className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <div className="h-9 w-9 rounded-full bg-[#e9ebee]" />
                <div>
                  <div className="text-xs font-medium text-[#333]">{item.name}</div>
                  <div className="line-clamp-2 text-[11px] text-[#999]">{item.desc}</div>
                </div>
              </div>
              <button className="inline-flex items-center gap-1 rounded-full border border-[#ff8200]/40 px-2 py-0.5 text-[11px] text-[#ff8200]">
                <UserPlus size={10} />
                关注
              </button>
            </div>
          ))}
        </div>
      </section>
    </aside>
  )
}

function Publisher() {
  const { publisherText, setPublisherText, aiReadyBanner, closeBanner, publisherImages, publisherVideo } = useApp()
  return (
    <div className="rounded-[4px] border border-[#e6e6e6] bg-white p-3">
      {aiReadyBanner && (
        <div className="mb-3 flex items-center justify-between rounded-[4px] bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] px-3 py-2 text-sm text-white">
          <span>AI创作内容已就绪 · 可编辑后发布</span>
          <button onClick={closeBanner}>
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex gap-3">
        <div className="h-8 w-8 rounded-full bg-[#e9ebee]" />
        <div className="flex-1">
          <textarea
            value={publisherText}
            onChange={(e) => setPublisherText(e.target.value)}
            placeholder="有什么新鲜事想分享给大家？"
            className="h-20 w-full resize-none border-none px-1 py-1 text-sm leading-6 text-[#333] outline-none placeholder:text-[#9f9f9f]"
          />
          {(publisherImages.length > 0 || publisherVideo) && (
            <div className="mb-2 rounded-[4px] border border-[#ebeef5] bg-[#f8f9ff] p-2 text-xs text-[#5f66b8]">
              {publisherImages.length > 0 && <div>已附带图片 {publisherImages.length} 张</div>}
              {publisherVideo && <div>已附带视频预览</div>}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-[#f0f0f0] pt-2">
            <div className="flex items-center gap-4 text-xs text-[#808080]">
              <button className="inline-flex items-center gap-1 hover:text-[#ff8200]">
                <Laugh size={14} /> 表情
              </button>
              <button className="inline-flex items-center gap-1 hover:text-[#ff8200]">
                <ImagePlus size={14} /> 图片
              </button>
              <button className="inline-flex items-center gap-1 hover:text-[#ff8200]">
                <Film size={14} /> 视频
              </button>
              <button className="inline-flex items-center gap-1 hover:text-[#ff8200]">
                <Hash size={14} /> 话题
              </button>
              <button className="inline-flex items-center gap-1 hover:text-[#ff8200]">
                <Vote size={14} /> 投票
              </button>
            </div>
            <button className="rounded-[14px] bg-[#ff8200] px-4 py-1 text-xs text-white">发送</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatCount(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return String(value)
}

function Feed() {
  return (
    <div className="mt-2 space-y-2">
      <div className="rounded-[4px] border border-[#e6e6e6] bg-white">
        <div className="flex items-center border-b border-[#f0f0f0] px-3">
          {['全部', '原创', '视频', '超话社区', '新鲜事'].map((tab, idx) => (
            <button
              key={tab}
              className={`mr-4 border-b-2 py-2 text-xs ${
                idx === 0 ? 'border-[#ff8200] text-[#ff8200]' : 'border-transparent text-[#666] hover:text-[#333]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {feedPosts.map((post) => (
        <article
          key={post.id}
          className="block w-full rounded-[4px] border border-[#e6e6e6] bg-white p-3 text-left"
        >
          <div className="flex gap-2">
            <div className="h-10 w-10 rounded-full bg-[#e9ebee]" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-1">
                <span className="text-sm font-medium text-[#333]">{post.name}</span>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-[#fff4e8] px-1 py-0.5 text-[10px] text-[#ff8200]">
                  <ShieldCheck size={10} /> 认证
                </span>
              </div>
              <div className="mb-2 text-[11px] text-[#999]">
                {post.time} · 来自 {post.source}
              </div>
              <p className="mb-2 text-sm leading-6 text-[#333]">{post.text}</p>

              {!!post.images?.length && (
                <div className={`mb-2 grid gap-1 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {post.images.map((img) => (
                    <img key={img} src={img} className={`rounded-[4px] object-cover ${post.images!.length === 1 ? 'max-h-60 w-full' : 'h-32 w-full'}`} />
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-[#f5f5f5] pt-2 text-xs text-[#808080]">
                <button className="inline-flex items-center gap-1 hover:text-[#ff8200]">
                  <Repeat2 size={13} />
                  转发 {formatCount(post.stat.repost)}
                </button>
                <button className="inline-flex items-center gap-1 hover:text-[#ff8200]">
                  <MessageSquare size={13} />
                  评论 {formatCount(post.stat.comment)}
                </button>
                <button className="inline-flex items-center gap-1 hover:text-[#ff8200]">
                  <Heart size={13} />
                  赞 {formatCount(post.stat.like)}
                </button>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

function QwenMark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex h-4 w-4 items-center justify-center rounded bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-[10px] font-semibold text-white ${className}`}>
      Q
    </span>
  )
}

function AICreationPanel() {
  const { startConversation, selectedModel, setSelectedModel, sendUserInput, setSelectedSkills } = useApp()
  const [text, setText] = useState('')
  const [tab, setTab] = useState<'全部' | '写作' | '图片' | '视频'>('全部')
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('writer')
  const [agentOpen, setAgentOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const agent = agentConfigs[selectedAgent]
  const filtered = templatePresets.filter((t) => (tab === '全部' ? true : t.type === tab))

  useEffect(() => {
    const recommended = agent.models.find((m) => m.recommended)?.name ?? agent.models[0].name
    if (!agent.models.some((model) => model.name === selectedModel)) {
      setSelectedModel(recommended)
    }
  }, [agent.models, selectedModel, setSelectedModel])

  const submit = () => {
    if (!text.trim()) return
    startConversation(selectedAgent, { text, model: selectedModel })
    setTimeout(() => {
      const el = document.querySelector('[data-chat-input]') as HTMLTextAreaElement | null
      el?.focus()
      sendUserInput(text)
    }, 60)
    setText('')
  }

  return (
    <div className="space-y-5 rounded-[4px] border border-[#e6e6e6] bg-white p-4">
      <div>
        <h2 className="text-2xl font-semibold text-[#1f2937]">你好，想创作什么？</h2>
        <p className="mt-1 text-sm text-[#6b7280]">选择一个智能体开始对话，或直接输入你的创作想法</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(Object.values(agentConfigs) as AgentConfig[]).map((agent) => (
          <button
            key={agent.id}
            onClick={() => {
              setSelectedAgent(agent.id)
              const recommended = agent.models.find((m) => m.recommended)?.name ?? agent.models[0].name
              setSelectedModel(recommended)
              startConversation(agent.id)
            }}
            className="flex items-center justify-between rounded-[8px] border border-[#eceef3] p-3 text-left hover:border-[#6C5CE7]/40 hover:bg-[#faf9ff]"
          >
            <div>
              <div className="mb-1 flex items-center gap-2 font-medium">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white" style={{ background: agent.color }}>
                  {agent.icon}
                </span>
                {agent.name}
              </div>
              <p className="text-xs text-[#6b7280]">{agent.description}</p>
            </div>
            <ArrowRight size={16} className="text-[#9ca3af]" />
          </button>
        ))}
      </div>

      <div className="rounded-[8px] border border-[#e5e7eb] p-3">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="告诉我你想创作什么..."
          className="h-24 w-full resize-none border-none text-sm leading-6 text-[#111827] outline-none placeholder:text-[#9ca3af]"
        />
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <div className="relative">
              <button className="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] px-3 py-1 text-xs text-[#374151]" onClick={() => setAgentOpen((v) => !v)}>
                <span className="inline-flex h-4 w-4 items-center justify-center rounded text-white" style={{ background: agent.color }}>
                  {agent.icon}
                </span>
                {agent.name}
                <ChevronDown size={12} />
              </button>
              <Dropdown open={agentOpen} onClose={() => setAgentOpen(false)} className="absolute left-0 top-full z-30 mt-2 w-52">
                <div className="rounded-[8px] border border-[#e5e7eb] bg-white p-1 shadow-xl">
                  {(Object.values(agentConfigs) as AgentConfig[]).map((item) => (
                    <button
                      key={item.id}
                      className="mb-1 flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs hover:bg-[#f9fafb]"
                      onClick={() => {
                        setSelectedAgent(item.id)
                        const recommended = item.models.find((m) => m.recommended)?.name ?? item.models[0].name
                        setSelectedModel(recommended)
                        setAgentOpen(false)
                      }}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded text-white" style={{ background: item.color }}>
                          {item.icon}
                        </span>
                        {item.name}
                      </span>
                      {selectedAgent === item.id && <Check size={12} className="text-[#6C5CE7]" />}
                    </button>
                  ))}
                </div>
              </Dropdown>
            </div>

            <div className="relative">
              <button className="inline-flex items-center gap-1 rounded-full border border-[#e5e7eb] px-3 py-1 text-xs text-[#374151]" onClick={() => setModelOpen((v) => !v)}>
                {selectedModel}
                <ChevronDown size={12} />
              </button>
              <Dropdown open={modelOpen} onClose={() => setModelOpen(false)} className="absolute left-0 top-full z-30 mt-2 w-56">
                <div className="rounded-[8px] border border-[#e5e7eb] bg-white p-1 shadow-xl">
                  {agent.models.map((model) => (
                    <button
                      key={model.name}
                      className="mb-1 flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs hover:bg-[#f9fafb]"
                      onClick={() => {
                        setSelectedModel(model.name)
                        setModelOpen(false)
                      }}
                    >
                      <span>
                        {model.name}
                        <span className="ml-1 text-[#9ca3af]">{model.provider}</span>
                      </span>
                      {selectedModel === model.name && <Check size={12} className="text-[#6C5CE7]" />}
                    </button>
                  ))}
                </div>
              </Dropdown>
            </div>

            <button className="rounded-full border border-[#e5e7eb] px-3 py-1 text-xs text-[#374151]">技能</button>
            <button className="rounded-full border border-[#e5e7eb] p-1.5 text-[#6b7280]">
              <Paperclip size={14} />
            </button>
          </div>
          <button
            onClick={submit}
            className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] px-3 py-1.5 text-xs text-white"
          >
            <Send size={13} /> 发送
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {promptTags.map((tag) => (
          <button
            key={tag.text}
            onClick={() => {
              setText(tag.text)
              setSelectedSkills([])
              setSelectedAgent(tag.agent)
              const recommended = agentConfigs[tag.agent].models.find((m) => m.recommended)?.name ?? agentConfigs[tag.agent].models[0].name
              setSelectedModel(recommended)
              inputRef.current?.focus()
            }}
            className="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] px-3 py-1 text-xs text-[#4b5563] hover:border-[#6C5CE7]/40 hover:bg-[#faf9ff]"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: agentConfigs[tag.agent].color }} />
            {tag.text}
            {tag.hot && <span className="text-[#ef4444]">热</span>}
          </button>
        ))}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-medium">模板预设</h3>
          <span className="text-xs text-gray-400">提示词 + 技能 + 智能体 + 模型</span>
        </div>
        <div className="mb-3 flex gap-2 text-sm">
          {(['全部', '写作', '图片', '视频'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1 ${tab === t ? 'bg-[#6C5CE7]/10 text-[#6C5CE7]' : 'text-[#6b7280] hover:bg-[#f3f4f6]'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-3">
          {filtered.map((tpl) => (
            <button
              key={tpl.name}
              onClick={() => startConversation(tpl.agent, { text: tpl.name, model: tpl.model, skills: tpl.skills })}
              className="rounded-[8px] border border-[#eceef3] p-3 text-left hover:border-[#6C5CE7]/40 hover:bg-[#faf9ff]"
            >
              <div className="mb-2 text-lg">{tpl.emoji}</div>
              <div className="text-sm font-semibold">{tpl.name}</div>
              <p className="mt-1 text-xs text-[#6b7280]">{tpl.desc}</p>
              <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                <span className="rounded-full px-2 py-0.5" style={{ background: `${agentConfigs[tpl.agent].color}1A`, color: agentConfigs[tpl.agent].color }}>
                  {agentConfigs[tpl.agent].name}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5">{tpl.model}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5">{tpl.skills.length}技能</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-[#6C5CE7]/20 bg-[#6C5CE7]/5 px-3 py-2 text-sm">
        <span>Wegent 智能平台 · 即将上线 · 更多智能体 · 更多模型 · 微博数据深度整合</span>
        <button className="inline-flex items-center gap-1 text-[#6C5CE7]">
          了解更多
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  )
}

function renderBoldText(text: string) {
  const chunks = text.split(/(\*\*[^*]+\*\*)/g)
  return chunks.map((chunk, idx) =>
    chunk.startsWith('**') && chunk.endsWith('**') ? (
      <strong key={`${chunk}-${idx}`}>{chunk.slice(2, -2)}</strong>
    ) : (
      <span key={`${chunk}-${idx}`}>{chunk}</span>
    )
  )
}

function ChatMessageItem({ message }: { message: ChatMessage }) {
  const { selectOption, sendToPublisher, sendUserInput } = useApp()
  const isUser = message.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[84%] ${isUser ? '' : ''}`}>
        {message.kind === 'text' && (
          <div
            className={`rounded-2xl px-4 py-2 text-sm leading-6 ${
              isUser ? 'bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white' : 'border bg-gray-50 text-gray-700'
            }`}
          >
            {message.text ? renderBoldText(message.text) : null}
          </div>
        )}

        {message.kind === 'options' && (
          <div className="rounded-2xl border bg-gray-50 p-3">
            <p className="mb-2 text-sm text-gray-700">{message.text}</p>
            <div className="flex flex-wrap gap-2">
              {message.options?.map((opt) => (
                <button
                  key={opt}
                  onClick={() => selectOption(opt, message.optionGroup!)}
                  className="rounded-full border px-3 py-1 text-xs hover:border-[#6C5CE7]/40 hover:bg-[#6C5CE7]/5"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {message.kind === 'suggestions' && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.suggestions?.map((s) => (
              <button
                key={s}
                onClick={() => sendUserInput(s)}
                className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-xs text-[#6b7280] hover:border-[#6C5CE7]/40 hover:bg-[#faf9ff]"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {message.kind === 'loading' && (
          <div className="rounded-2xl border bg-white px-4 py-3">
            <DotLoading />
          </div>
        )}

        {message.kind === 'writing-result' && (
          <div className="rounded-2xl border bg-white p-4">
            <p className="text-sm leading-7 text-gray-700">{message.content}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => sendToPublisher({ text: message.content })}
                className="rounded-full bg-[#ff8200] px-3 py-1.5 text-xs text-white"
              >
                发送到发布器
              </button>
              <button className="rounded-full border px-3 py-1.5 text-xs">生成配图</button>
              <button
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs"
                onClick={async () => {
                  await navigator.clipboard.writeText(message.content ?? '')
                  toast.success('已复制文案')
                }}
              >
                <Copy size={12} /> 复制
              </button>
            </div>
          </div>
        )}

        {message.kind === 'image-result' && (
          <div className="rounded-2xl border bg-white p-3">
            <div className="grid grid-cols-2 gap-2">
              {message.images?.map((img) => (
                <img key={img} src={img} className="h-28 w-full rounded-md object-cover" />
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => sendToPublisher({ images: message.images })} className="rounded-full bg-[#ff8200] px-3 py-1.5 text-xs text-white">
                发送到发布器
              </button>
              <button className="rounded-full border px-3 py-1.5 text-xs">重新生成</button>
            </div>
          </div>
        )}

        {message.kind === 'video-result' && (
          <div className="rounded-2xl border bg-white p-3">
            <div className="relative">
              <img src={message.video?.cover} className="h-40 w-full rounded-md object-cover" />
              <button className="absolute inset-0 m-auto h-11 w-11 rounded-full bg-white/90 text-sm">▶</button>
              <div className="absolute bottom-2 left-2 flex gap-1 text-[10px] text-white">
                <span className="rounded bg-black/50 px-1.5 py-0.5">{message.video?.duration}</span>
                <span className="rounded bg-black/50 px-1.5 py-0.5">{message.video?.resolution}</span>
                <span className="rounded bg-black/50 px-1.5 py-0.5">{message.video?.ratio}</span>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => sendToPublisher({ video: message.video?.cover })} className="rounded-full bg-[#ff8200] px-3 py-1.5 text-xs text-white">
                发送到发布器
              </button>
              <button className="rounded-full border px-3 py-1.5 text-xs">重新生成</button>
              <button className="rounded-full border px-3 py-1.5 text-xs">下载</button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function AIChatView() {
  const {
    activeConversation,
    setAIView,
    sendUserInput,
    selectedModel,
    setSelectedModel,
    selectedSkills,
    setSelectedSkills,
    extraParamValues,
    setExtraParamValues,
    conversations,
    tasks,
    toggleTaskPanel,
    startConversation,
    goToConversation
  } = useApp()

  const [modelOpen, setModelOpen] = useState(false)
  const [skillOpen, setSkillOpen] = useState(false)
  const [paramOpen, setParamOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const agent = activeConversation ? agentConfigs[activeConversation.agentType] : agentConfigs.writer
  const runningCount = tasks.filter((t) => t.status === 'in_progress').length
  const historyList = useMemo(() => conversations.slice(0, 8), [conversations])

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300)
    return () => clearTimeout(t)
  }, [activeConversation?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeConversation?.messages])

  if (!activeConversation) {
    return (
      <div className="rounded-[4px] border border-[#e6e6e6] bg-white p-6 text-sm text-gray-500">
        请选择智能体开始对话
      </div>
    )
  }

  return (
    <div className="rounded-[4px] border border-[#e6e6e6] bg-white">
      <div className="flex items-center justify-between border-b border-[#eceef3] px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setAIView('home')} className="rounded-md border border-[#e5e7eb] p-1.5 text-gray-500 hover:bg-gray-50">
            <ArrowLeft size={14} />
          </button>
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white" style={{ background: agent.color }}>
            {agent.icon}
          </div>
          <div>
            <div className="text-sm font-semibold">{agent.name}</div>
            <div className="text-xs text-gray-400">{agent.description}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => toggleTaskPanel(true)} className="relative inline-flex items-center gap-1 rounded-full bg-[#6C5CE7] px-3 py-1.5 text-xs text-white">
            <Clock3 size={12} />
            创作任务
            {runningCount > 0 && <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] text-[#6C5CE7]">{runningCount}</span>}
          </button>
          <button
            onClick={() => startConversation(activeConversation.agentType)}
            className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-xs text-[#374151] hover:bg-[#f9fafb]"
          >
            <Plus size={12} className="mr-1 inline" />
            新建对话
          </button>
          <div className="relative">
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-xs text-[#374151] hover:bg-[#f9fafb]"
            >
              <MessageCircle size={12} className="mr-1 inline" />
              对话历史
            </button>
            <Dropdown open={historyOpen} onClose={() => setHistoryOpen(false)} className="absolute right-0 top-full z-30 mt-2 w-64">
              <div className="rounded-[8px] border border-[#e5e7eb] bg-white p-2 shadow-xl">
                {historyList.length === 0 && <div className="px-2 py-3 text-xs text-[#9ca3af]">暂无历史会话</div>}
                {historyList.map((convo) => (
                  <button
                    key={convo.id}
                    onClick={() => {
                      goToConversation(convo.id)
                      setHistoryOpen(false)
                    }}
                    className="mb-1 w-full rounded-md border border-transparent px-2 py-2 text-left hover:border-[#6C5CE7]/25 hover:bg-[#faf9ff]"
                  >
                    <div className="text-xs font-medium text-[#374151]">{convo.title || `${agentConfigs[convo.agentType].name}对话`}</div>
                    <div className="mt-0.5 text-[11px] text-[#9ca3af]">
                      {agentConfigs[convo.agentType].name} · {relativeTime(convo.createdAt)}
                    </div>
                  </button>
                ))}
              </div>
            </Dropdown>
          </div>
        </div>
      </div>

      <div className="h-[500px] space-y-3 overflow-y-auto p-4 scrollbar-thin">
        {activeConversation.messages.map((m) => (
          <ChatMessageItem key={m.id} message={m} />
        ))}

        {activeConversation.messages.length <= 2 && (
          <div className="grid grid-cols-2 gap-2 rounded-xl border bg-gray-50 p-3">
            {['先给核心观点，再扩写细节', '提示词写清目标和语气', '先要草稿，再逐轮优化', '发布前检查标题和话题'].map((tip) => (
              <div key={tip} className="rounded-md bg-white px-2 py-2 text-xs text-gray-600">
                {tip}
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[#eceef3] p-3">
        <textarea
          ref={inputRef}
          data-chat-input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="继续描述你的创作需求..."
          className="h-16 w-full resize-none rounded-lg border border-[#e5e7eb] p-3 text-sm outline-none focus:border-[#6C5CE7]"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendUserInput(input)
              setInput('')
            }
          }}
        />

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-[#e5e7eb] px-2 py-1">
              <span className="h-2 w-2 rounded-full" style={{ background: agent.color }} /> {agent.name}
            </span>

            <div className="relative">
              <button className="rounded-full border border-[#e5e7eb] px-3 py-1" onClick={() => setModelOpen((v) => !v)}>
                {selectedModel} <ChevronDown size={12} className="inline" />
              </button>
              <Dropdown open={modelOpen} onClose={() => setModelOpen(false)}>
                <div className="rounded-xl border bg-white p-2 shadow-xl">
                  {agent.models.map((m) => (
                    <button
                      key={m.name}
                      className="mb-1 flex w-full items-start justify-between rounded-lg px-2 py-2 text-left text-xs hover:bg-gray-50"
                      onClick={() => {
                        setSelectedModel(m.name)
                        setModelOpen(false)
                      }}
                    >
                      <div>
                        <div className="font-medium">
                          {m.name} · {m.provider} {m.recommended && <span className="rounded bg-[#6C5CE7]/10 px-1 text-[#6C5CE7]">推荐</span>}
                        </div>
                        <div className="text-gray-400">{m.desc}</div>
                      </div>
                      {selectedModel === m.name && <Check size={12} className="text-[#6C5CE7]" />}
                    </button>
                  ))}
                </div>
              </Dropdown>
            </div>

            <div className="relative">
              <button className="rounded-full border border-[#e5e7eb] px-3 py-1" onClick={() => setSkillOpen((v) => !v)}>
                技能{selectedSkills.length > 0 ? `(${selectedSkills.length})` : ''} <ChevronDown size={12} className="inline" />
              </button>
              <Dropdown open={skillOpen} onClose={() => setSkillOpen(false)}>
                <div className="rounded-xl border bg-white p-2 shadow-xl">
                  {agent.skills.map((s) => {
                    const checked = selectedSkills.includes(s)
                    return (
                      <button
                        key={s}
                        className="mb-1 flex w-full items-center justify-between rounded-lg px-2 py-2 text-xs hover:bg-gray-50"
                        onClick={() => {
                          setSelectedSkills(checked ? selectedSkills.filter((v) => v !== s) : [...selectedSkills, s])
                        }}
                      >
                        {s}
                        {checked && <Check size={12} className="text-[#6C5CE7]" />}
                      </button>
                    )
                  })}
                  <div className="mt-1 border-t pt-2 text-center text-[11px] text-[#6C5CE7]">更多技能来自Wegent</div>
                </div>
              </Dropdown>
            </div>

            {(activeConversation.agentType === 'gallery' || activeConversation.agentType === 'studio') && (
              <div className="relative">
                <button className="rounded-full border border-[#e5e7eb] px-3 py-1" onClick={() => setParamOpen((v) => !v)}>
                  参数设置 <ChevronDown size={12} className="inline" />
                </button>
                <Dropdown open={paramOpen} onClose={() => setParamOpen(false)}>
                  <div className="rounded-xl border bg-white p-3 shadow-xl">
                    {agent.params?.map((p) => (
                      <div key={p.key} className="mb-2">
                        <div className="mb-1 text-[11px] text-gray-500">{p.label}</div>
                        <div className="flex flex-wrap gap-1">
                          {p.options.map((o) => {
                            const active = extraParamValues[p.key] === o
                            return (
                              <button
                                key={o}
                                onClick={() => setExtraParamValues({ ...extraParamValues, [p.key]: o })}
                                className={`rounded-full border px-2 py-0.5 text-[11px] ${active ? 'border-[#6C5CE7]/40 bg-[#6C5CE7]/10 text-[#6C5CE7]' : ''}`}
                              >
                                {o}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </Dropdown>
              </div>
            )}

            <button className="rounded-full border border-[#e5e7eb] p-1.5">
              <Paperclip size={13} />
            </button>
          </div>

          <button
            onClick={() => {
              sendUserInput(input)
              setInput('')
            }}
            className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] px-3 py-1.5 text-xs text-white"
          >
            <Send size={13} /> 发送
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskPanel() {
  const { isTaskPanelOpen, toggleTaskPanel, tasks, goToConversation } = useApp()
  const groups = useMemo(
    () => ({
      inProgress: tasks.filter((t) => t.status === 'in_progress'),
      completed: tasks.filter((t) => t.status === 'completed')
    }),
    [tasks]
  )

  return (
    <AnimatePresence>
      {isTaskPanelOpen && (
        <>
          <motion.button
            className="fixed inset-0 z-40 bg-black/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => toggleTaskPanel(false)}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25 }}
            className="fixed right-0 top-0 z-50 h-full w-[380px] bg-white p-4 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">创作任务</h3>
              <button onClick={() => toggleTaskPanel(false)} className="rounded-md border border-[#e5e7eb] p-1.5">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto pb-5">
              <section>
                <div className="mb-2 text-sm font-medium">进行中</div>
                <div className="space-y-2">
                  {groups.inProgress.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => goToConversation(task.conversationId)}
                      className="group w-full rounded-xl border border-[#eceef3] p-3 text-left hover:border-[#6C5CE7]/40"
                    >
                      <div className="mb-1 flex items-start justify-between">
                        <span className="inline-flex items-center gap-2 text-xs text-gray-500">
                          <span
                            className="inline-flex h-5 w-5 items-center justify-center rounded-md text-white"
                            style={{ background: agentConfigs[task.agentType].color }}
                          >
                            {agentConfigs[task.agentType].icon}
                          </span>
                          {agentConfigs[task.agentType].name}
                        </span>
                        <span className="text-[11px] text-gray-400">{relativeTime(task.createdAt)}</span>
                      </div>
                      <div className="text-sm font-medium">{task.title}</div>
                      <div className="mt-1 text-[11px] text-gray-500">{agentConfigs[task.agentType].name} · {task.model}</div>
                      <div className="mt-2 h-2 rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6]"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-[11px] text-[#9ca3af] opacity-0 transition-opacity group-hover:opacity-100">点击回到对话</span>
                        <span className="text-[11px] text-[#6C5CE7]">{task.progress}%</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-2 text-sm font-medium">已完成</div>
                <div className="space-y-2">
                  {groups.completed.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => goToConversation(task.conversationId)}
                      className="group w-full rounded-xl border border-[#eceef3] p-3 text-left hover:border-[#6C5CE7]/40"
                    >
                      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="inline-flex h-5 w-5 items-center justify-center rounded-md text-white"
                            style={{ background: agentConfigs[task.agentType].color }}
                          >
                            {agentConfigs[task.agentType].icon}
                          </span>
                          {agentConfigs[task.agentType].name}
                        </span>
                        <span>{relativeTime(task.createdAt)}</span>
                      </div>
                      <div className="text-sm font-medium">{task.title}</div>
                      <div className="mt-1 text-[11px] text-gray-500">{agentConfigs[task.agentType].name} · {task.model}</div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-[#9ca3af] opacity-0 transition-opacity group-hover:opacity-100">点击回到对话</span>
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-600">已完成</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function CenterColumn() {
  const { isAICreationMode, enterAICreation, exitAICreation, currentAIView } = useApp()
  return (
    <section>
      <div className="mb-2 rounded-[4px] border border-[#e6e6e6] bg-white p-3">
        <div className="mb-3 flex items-center gap-8 border-b border-[#eceef3] text-sm">
          <button onClick={exitAICreation} className={`relative pb-3 font-medium ${!isAICreationMode ? 'text-[#ff8200]' : 'text-[#6b7280]'}`}>
            发微博
            {!isAICreationMode && <span className="absolute -bottom-px left-0 h-0.5 w-full bg-[#ff8200]" />}
          </button>
          <button
            onClick={() => enterAICreation('home')}
            className={`relative inline-flex items-center gap-1 pb-3 font-medium ${isAICreationMode ? 'text-[#6C5CE7]' : 'text-[#6b7280]'}`}
          >
            <QwenMark /> 千问AI创作
            {isAICreationMode && <span className="absolute -bottom-px left-0 h-0.5 w-full bg-[#6C5CE7]" />}
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={isAICreationMode ? `ai-${currentAIView}` : 'publisher'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {!isAICreationMode && <Publisher />}
            {isAICreationMode && (currentAIView === 'home' ? <AICreationPanel /> : <AIChatView />)}
          </motion.div>
        </AnimatePresence>
      </div>
      <Feed />
    </section>
  )
}

function Layout() {
  return (
    <div className="min-h-screen bg-[#f2f2f5]">
      <TopNav />
      <main className="mx-auto grid w-full max-w-[1180px] grid-cols-[160px_minmax(0,1fr)_300px] gap-4 px-2 py-3">
        <LeftSidebar />
        <CenterColumn />
        <RightSidebar />
      </main>
      <TaskPanel />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Layout />
    </AppProvider>
  )
}
