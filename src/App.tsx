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
  Bot,
  Check,
  ChevronDown,
  CircleUserRound,
  Clapperboard,
  Clock3,
  Copy,
  Image,
  MessageCircle,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
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
    writerStep?: 0 | 1 | 2
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
  { emoji: '🔥', name: '热点评论', type: '写作', agent: 'writer' as AgentType, model: 'Qwen 3.0', skills: ['热点追踪'] },
  { emoji: '🛍️', name: '产品种草', type: '写作', agent: 'writer' as AgentType, model: 'Qwen 3.0', skills: ['SEO优化'] },
  { emoji: '☕', name: '日常分享', type: '写作', agent: 'writer' as AgentType, model: 'Qwen 3.0', skills: [] },
  { emoji: '📘', name: '知识科普', type: '写作', agent: 'writer' as AgentType, model: 'DeepSeek R1', skills: ['SEO优化'] },
  { emoji: '🖌️', name: '国风水墨', type: '图片', agent: 'gallery' as AgentType, model: 'SeeArt Pro', skills: [] },
  { emoji: '📣', name: '海报设计', type: '图片', agent: 'gallery' as AgentType, model: 'Midjourney v7', skills: [] },
  { emoji: '🌆', name: '风景延时', type: '视频', agent: 'studio' as AgentType, model: 'SeeDance 2.0', skills: [] },
  { emoji: '🎬', name: '产品展示', type: '视频', agent: 'studio' as AgentType, model: 'Kling 2.0', skills: [] }
]

const feedPosts = [
  {
    name: '新浪科技',
    time: '2小时前',
    text: '微博 AI 创作空间进入内测，用户可在发布前直接与智能体协作完成图文视频创作。',
    stat: '转发 182 · 评论 64 · 点赞 1.2k'
  },
  {
    name: '产品观察员',
    time: '4小时前',
    text: '试用了“千问AI创作”，从写文案到生成配图一站式完成，效率提升明显。',
    stat: '转发 98 · 评论 39 · 点赞 860'
  },
  {
    name: '设计研究社',
    time: '6小时前',
    text: '把AI入口放进主发布器是很聪明的决策，真正让创作闭环发生在首页。',
    stat: '转发 76 · 评论 25 · 点赞 531'
  },
  {
    name: '前端群星',
    time: '8小时前',
    text: 'React + Motion 做这类复杂交互很顺手，关键是状态建模清晰。',
    stat: '转发 43 · 评论 14 · 点赞 309'
  },
  {
    name: 'AI视频日报',
    time: '昨天',
    text: 'SeeDance 与 Kling 新版本都在迭代视频一致性，你更看好哪家？',
    stat: '转发 133 · 评论 82 · 点赞 974'
  }
]

const hotList = ['王菲 春晚', '总台声明', '公司利润2.7亿拿1.8亿发年终奖', 'AI视频工具对比', '王鑫被查', '交警查酒驾意外见家长', '中戏已有两位表演系主任主动投案', '微博创作者中心升级', 'Veo 3 实测', '短道速滑银牌']
const recommends = ['说车的小宇', '地摊周报巫医饭', '秋晨同学', '设计灵感Bot']

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
    navigate(view === 'home' ? '/ai' : `/ai/${view}`)
  }

  const exitAICreation = () => {
    setIsAICreationMode(false)
    setCurrentAIView('home')
    navigate('/')
  }

  const setAIView = (view: AIView) => {
    setCurrentAIView(view)
    if (view !== 'home') {
      navigate(`/ai/${view}`)
    } else {
      navigate('/ai')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startConversation = (agentType: AgentType, seed?: { text?: string; model?: string; skills?: string[] }) => {
    const id = uid()
    const cfg = agentConfigs[agentType]
    const model = seed?.model ?? cfg.models.find((m) => m.recommended)?.name ?? cfg.models[0].name
    const convo: Conversation = {
      id,
      agentType,
      title: seed?.text ? seed.text.slice(0, 16) : `${cfg.name}新对话`,
      createdAt: Date.now(),
      model,
      selectedSkills: seed?.skills ?? [],
      extraParamValues: {},
      meta: { writerStep: 0 },
      messages: [
        {
          id: uid(),
          role: 'assistant',
          kind: 'text',
          text: `${cfg.name}已就绪。告诉我你的创作目标，我会一步步帮你完成。`
        },
        {
          id: uid(),
          role: 'assistant',
          kind: 'suggestions',
          suggestions: ['先给我一个创作方向', '给我三个风格版本', '输出可直接发布版本']
        }
      ]
    }
    setConversations((prev) => [convo, ...prev])
    setActiveConversation(convo)
    setSelectedModel(model)
    setSelectedSkills(convo.selectedSkills)
    setExtraParamValues({})
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
      toast.info('该任务暂无会话记录（Demo占位任务）')
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
        const options: ChatMessage = {
          id: uid(),
          role: 'assistant',
          kind: 'options',
          text: '收到，你希望从哪个角度展开？',
          optionGroup: 'angle',
          options: ['技术对比分析', '观点输出', '新闻解读', '实用建议']
        }
        patchConversation(convo.id, (c) => ({ ...c, meta: { writerStep: 1 }, messages: [...c.messages, userMsg, options] }))
      }
      return
    }

    if (convo.agentType === 'gallery') {
      const loadingId = uid()
      patchConversation(convo.id, (c) => ({
        ...c,
        messages: [
          ...c.messages,
          userMsg,
          {
            id: uid(),
            role: 'assistant',
            kind: 'text',
            text: `已确认参数：${selectedModel} · ${extraParamValues.ratio ?? '1:1方形'}，开始生成4张候选图。`
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

    if (convo.agentType === 'studio') {
      const loadingId = uid()
      patchConversation(convo.id, (c) => ({
        ...c,
        messages: [
          ...c.messages,
          userMsg,
          {
            id: uid(),
            role: 'assistant',
            kind: 'text',
            text: `已确认参数：${selectedModel} · ${extraParamValues.duration ?? '15秒'} · ${extraParamValues.resolution ?? '1080p'} · ${extraParamValues.ratio ?? '16:9横版'}，任务已创建。`
          },
          { id: loadingId, role: 'assistant', kind: 'loading', text: '正在思考...' }
        ]
      }))
      addTask({
        id: uid(),
        title: `${text.slice(0, 18)} - ${extraParamValues.resolution ?? '1080p'}视频`,
        agentType: 'studio',
        model: selectedModel,
        progress: 8,
        status: 'in_progress',
        createdAt: Date.now(),
        conversationId: convo.id,
        loadingMessageId: loadingId
      })
      toast.info('视频任务已加入创作任务')
    }
  }

  const selectOption = (option: string, group: 'angle' | 'style') => {
    if (!activeConversation || activeConversation.agentType !== 'writer') return
    const convoId = activeConversation.id
    const userMsg: ChatMessage = { id: uid(), role: 'user', kind: 'text', text: option }

    if (group === 'angle') {
      patchConversation(convoId, (c) => ({
        ...c,
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
      return
    }

    const loadingId = uid()
    patchConversation(convoId, (c) => ({
      ...c,
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
                      duration: extraParamValues.duration ?? '15秒',
                      ratio: extraParamValues.ratio ?? '16:9横版',
                      resolution: extraParamValues.resolution ?? '1080p'
                    }
                  }
                : m
            )
          }))
        })
      }
    }, 800)
    return () => clearInterval(timer)
  }, [extraParamValues])

  useEffect(() => {
    if (location.startsWith('/ai')) {
      setIsAICreationMode(true)
      const seg = location.split('/')[2]
      if (seg === 'writer' || seg === 'gallery' || seg === 'studio') {
        setCurrentAIView(seg)
      } else {
        setCurrentAIView('home')
      }
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
  return (
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-full bg-[#ff8200]" />
          <span className="text-sm font-semibold">微博</span>
        </div>
        <div className="flex w-[460px] items-center gap-2 rounded-full border bg-gray-50 px-3 py-2">
          <Search size={15} className="text-gray-400" />
          <input className="w-full border-none bg-transparent text-sm outline-none" placeholder="搜索微博" />
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <button className="rounded-full bg-[#ff8200] px-3 py-1.5 text-white">发布</button>
          <MessageCircle size={18} />
          <CircleUserRound size={20} />
          <span>刘彬</span>
        </div>
      </div>
    </header>
  )
}

function LeftSidebar() {
  const items = ['首页', '热门', '视频', '消息', '我的', '更多']
  return (
    <aside className="space-y-2 rounded-xl bg-white p-3 shadow-sm">
      {items.map((item, idx) => (
        <button
          key={item}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
            idx === 0 ? 'bg-orange-50 text-[#ff8200]' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs">{idx + 1}</span>
          {item}
        </button>
      ))}
    </aside>
  )
}

function RightSidebar() {
  return (
    <aside className="space-y-3">
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">微博热搜</h3>
          <span className="text-xs text-gray-400">点击刷新</span>
        </div>
        <ul className="space-y-2">
          {hotList.map((h, idx) => (
            <li key={h} className="flex items-center gap-2 text-sm">
              <span className={`w-5 text-xs ${idx < 3 ? 'text-[#ff8200]' : 'text-gray-400'}`}>{idx + 1}</span>
              <span className="line-clamp-1 flex-1">{h}</span>
              {idx < 4 && <span className="text-[10px] text-rose-500">热</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold">推荐关注</h3>
        <div className="space-y-3">
          {recommends.map((name) => (
            <div key={name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gray-200" />
                <span className="text-sm">{name}</span>
              </div>
              <button className="rounded-full border px-3 py-1 text-xs text-gray-600">关注</button>
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
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      {aiReadyBanner && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] px-3 py-2 text-sm text-white">
          <span>AI创作内容已就绪 · 可编辑后发布</span>
          <button onClick={closeBanner}>
            <X size={14} />
          </button>
        </div>
      )}
      <div className="mb-3 flex gap-3">
        <div className="h-9 w-9 rounded-full bg-gray-200" />
        <textarea
          value={publisherText}
          onChange={(e) => setPublisherText(e.target.value)}
          placeholder="有什么新鲜事想分享给大家？"
          className="h-24 w-full resize-none rounded-lg border p-3 text-sm outline-none focus:border-[#ff8200]"
        />
      </div>
      {(publisherImages.length > 0 || publisherVideo) && (
        <div className="mb-3 rounded-lg border bg-gray-50 p-2 text-xs text-gray-600">
          {publisherImages.length > 0 && <div>已附带图片 {publisherImages.length} 张</div>}
          {publisherVideo && <div>已附带视频预览</div>}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>图片</span>
          <span>视频</span>
          <span>话题</span>
          <span>表情</span>
          <span>投票</span>
        </div>
        <button className="rounded-full bg-[#ff8200] px-4 py-1.5 text-sm text-white">发布</button>
      </div>
    </div>
  )
}

function Feed() {
  return (
    <div className="mt-3 space-y-3">
      {feedPosts.map((p) => (
        <article key={`${p.name}-${p.time}`} className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm">
            <div className="h-8 w-8 rounded-full bg-gray-200" />
            <span className="font-medium">{p.name}</span>
            <span className="text-gray-400">{p.time}</span>
          </div>
          <p className="mb-3 text-sm leading-6 text-gray-700">{p.text}</p>
          <div className="text-xs text-gray-400">{p.stat}</div>
        </article>
      ))}
    </div>
  )
}

function AICreationPanel() {
  const { startConversation, selectedModel, setSelectedModel, sendUserInput, setAIView, setSelectedSkills } = useApp()
  const [text, setText] = useState('')
  const [tab, setTab] = useState<'全部' | '写作' | '图片' | '视频'>('全部')

  const submit = () => {
    if (!text.trim()) return
    startConversation('writer', { text, model: selectedModel })
    setAIView('writer')
    setTimeout(() => {
      const el = document.querySelector('[data-chat-input]') as HTMLTextAreaElement | null
      el?.focus()
      sendUserInput(text)
    }, 60)
    setText('')
  }

  const filtered = templatePresets.filter((t) => (tab === '全部' ? true : t.type === tab))

  return (
    <div className="space-y-5 rounded-xl border bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-2xl font-semibold">你好，想创作什么？</h2>
        <p className="mt-1 text-sm text-gray-500">选择一个智能体开始对话，或直接输入你的创作想法</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(Object.values(agentConfigs) as AgentConfig[]).map((agent) => (
          <button
            key={agent.id}
            onClick={() => startConversation(agent.id)}
            className="flex items-center justify-between rounded-xl border p-3 text-left hover:border-[#6C5CE7]/40"
          >
            <div>
              <div className="mb-1 flex items-center gap-2 font-medium">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white" style={{ background: agent.color }}>
                  {agent.icon}
                </span>
                {agent.name}
              </div>
              <p className="text-xs text-gray-500">{agent.description}</p>
            </div>
            <ArrowRight size={16} className="text-gray-400" />
          </button>
        ))}
      </div>

      <div className="rounded-xl border p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="告诉我你想创作什么..."
          className="h-24 w-full resize-none border-none text-sm outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <select
              value={'AI妙笔'}
              className="rounded-md border px-2 py-1 text-xs"
              onChange={(e) => {
                const name = e.target.value
                const agent = (Object.values(agentConfigs) as AgentConfig[]).find((a) => a.name === name)
                if (agent) setAIView(agent.id)
              }}
            >
              <option>AI妙笔</option>
              <option>AI画廊</option>
              <option>AI影室</option>
            </select>
            <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="rounded-md border px-2 py-1 text-xs">
              <option>Qwen 3.0</option>
              <option>DeepSeek R1</option>
              <option>SeeArt Pro</option>
              <option>SeeDance 2.0</option>
            </select>
            <button className="rounded-md border px-2 py-1 text-xs">技能</button>
            <button className="rounded-md border p-1">
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
              setAIView(tag.agent)
            }}
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-gray-600 hover:border-[#6C5CE7]/40"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: agentConfigs[tag.agent].color }} />
            {tag.text}
            {tag.hot && <span className="text-rose-500">热</span>}
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
              className={`rounded-full px-3 py-1 ${tab === t ? 'bg-[#6C5CE7]/10 text-[#6C5CE7]' : 'text-gray-500 hover:bg-gray-100'}`}
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
              className="rounded-xl border p-3 text-left hover:border-[#6C5CE7]/40"
            >
              <div className="mb-2 text-lg">{tpl.emoji}</div>
              <div className="text-sm font-semibold">{tpl.name}</div>
              <p className="mt-1 text-xs text-gray-500">{tpl.type}模板，快速生成首版内容</p>
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
        <button className="text-[#6C5CE7]">了解更多</button>
      </div>
    </div>
  )
}

function ChatMessageItem({ message }: { message: ChatMessage }) {
  const { selectOption, sendToPublisher } = useApp()
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
            {message.text}
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
              <span key={s} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                {s}
              </span>
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
    tasks,
    toggleTaskPanel
  } = useApp()

  const [modelOpen, setModelOpen] = useState(false)
  const [skillOpen, setSkillOpen] = useState(false)
  const [paramOpen, setParamOpen] = useState(false)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const agent = activeConversation ? agentConfigs[activeConversation.agentType] : agentConfigs.writer
  const runningCount = tasks.filter((t) => t.status === 'in_progress').length

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300)
    return () => clearTimeout(t)
  }, [activeConversation?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeConversation?.messages])

  if (!activeConversation) {
    return (
      <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">
        请选择智能体开始对话
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setAIView('home')} className="rounded-md border p-1.5 text-gray-500 hover:bg-gray-50">
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
          <button onClick={() => toggleTaskPanel(true)} className="relative rounded-full bg-[#6C5CE7] px-3 py-1.5 text-xs text-white">
            创作任务
            {runningCount > 0 && <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] text-[#6C5CE7]">{runningCount}</span>}
          </button>
          <button className="rounded-full border px-3 py-1.5 text-xs"><Plus size={12} className="inline" /> 新建对话</button>
          <button className="rounded-full border px-3 py-1.5 text-xs"><MessageCircle size={12} className="inline" /> 对话历史</button>
        </div>
      </div>

      <div className="h-[460px] space-y-3 overflow-y-auto p-4 scrollbar-thin">
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

      <div className="border-t p-3">
        <textarea
          ref={inputRef}
          data-chat-input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="继续描述你的创作需求..."
          className="h-16 w-full resize-none rounded-lg border p-3 text-sm outline-none focus:border-[#6C5CE7]"
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
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
              <span className="h-2 w-2 rounded-full" style={{ background: agent.color }} /> {agent.name}
            </span>

            <div className="relative">
              <button className="rounded-full border px-3 py-1" onClick={() => setModelOpen((v) => !v)}>
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
              <button className="rounded-full border px-3 py-1" onClick={() => setSkillOpen((v) => !v)}>
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
                <button className="rounded-full border px-3 py-1" onClick={() => setParamOpen((v) => !v)}>
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

            <button className="rounded-full border p-1.5">
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
              <button onClick={() => toggleTaskPanel(false)} className="rounded-md border p-1.5">
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
                      className="w-full rounded-xl border p-3 text-left hover:border-[#6C5CE7]/40"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <span className="h-2 w-2 rounded-full" style={{ background: agentConfigs[task.agentType].color }} />
                          {agentConfigs[task.agentType].name}
                        </span>
                        <span className="text-[11px] text-gray-400">{relativeTime(task.createdAt)}</span>
                      </div>
                      <div className="text-sm font-medium">{task.title}</div>
                      <div className="mt-1 text-[11px] text-gray-500">{task.model}</div>
                      <div className="mt-2 h-2 rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6]"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <div className="mt-1 text-right text-[11px] text-[#6C5CE7]">{task.progress}%</div>
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
                      className="w-full rounded-xl border p-3 text-left hover:border-[#6C5CE7]/40"
                    >
                      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                        <span>{agentConfigs[task.agentType].name}</span>
                        <span>{relativeTime(task.createdAt)}</span>
                      </div>
                      <div className="text-sm font-medium">{task.title}</div>
                      <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-600">已完成</div>
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
      <div className="mb-3 rounded-xl border bg-white p-3">
        <div className="mb-3 flex items-center gap-8 border-b text-sm">
          <button onClick={exitAICreation} className={`relative pb-3 font-medium ${!isAICreationMode ? 'text-[#ff8200]' : 'text-gray-500'}`}>
            发微博
            {!isAICreationMode && <span className="absolute -bottom-px left-0 h-0.5 w-full bg-[#ff8200]" />}
          </button>
          <button onClick={() => enterAICreation('home')} className={`relative inline-flex items-center gap-1 pb-3 font-medium ${isAICreationMode ? 'text-[#6C5CE7]' : 'text-gray-500'}`}>
            <Sparkles size={13} /> 千问AI创作
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
    <div className="min-h-screen bg-[#f7f8fa]">
      <TopNav />
      <main className="mx-auto grid w-full max-w-[1280px] grid-cols-[220px_minmax(0,1fr)_320px] gap-4 px-4 py-4">
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
