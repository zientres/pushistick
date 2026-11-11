import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity, ArrowRight, Bot, Check, ChevronRight, CircleHelp, Clock3, Command,
  Cpu, FilePlus2, FolderKanban, Gauge, History, LayoutDashboard, ListOrdered,
  LoaderCircle, MoreHorizontal, Play, Plus, Search, Settings2, ShieldCheck,
  Square, Terminal, Trash2, Workflow as WorkflowIcon, X, Zap
} from 'lucide-react'
import type { CliStatus, RunEvent, RunRecord, Workflow, WorkflowStep } from '../shared/types'

type Page = 'home' | 'templates' | 'runs' | 'queue' | 'settings'

const makeStep = (): WorkflowStep => ({ id: crypto.randomUUID(), prompt: '' })
const makeWorkflow = (): Workflow => ({
  id: crypto.randomUUID(), name: 'Новый шаблон', description: '',
  steps: [{ id: crypto.randomUUID(), prompt: '{{input}}' }],
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
})

function App() {
  const [page, setPage] = useState<Page>('home')
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [cli, setCli] = useState<CliStatus | null>(null)
  const [events, setEvents] = useState<RunEvent[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<Workflow | null>(null)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [pendingWorkflowId, setPendingWorkflowId] = useState<string | null>(null)
  const [initialInput, setInitialInput] = useState('')

  const refresh = async () => {
    const [nextWorkflows, nextRuns] = await Promise.all([window.pushistick.getWorkflows(), window.pushistick.getRuns()])
    setWorkflows(nextWorkflows)
    setRuns(nextRuns)
  }

  useEffect(() => {
    void refresh()
    void window.pushistick.checkAntigravity().then(setCli)
    const unsubscribe = window.pushistick.onRunEvent((event) => {
      setEvents((current) => [event, ...current].slice(0, 30))
      void refresh()
    })
    return unsubscribe
  }, [])

  const current = workflows.find((item) => item.id === selected) ?? workflows[0] ?? null
  const filtered = useMemo(() => workflows.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())), [workflows, search])
  const activeRun = runs.find((run) => run.status === 'running' || run.status === 'queued')

  const createNew = () => {
    const draft = makeWorkflow()
    setEditing(draft)
    setPage('templates')
  }

  const save = async () => {
    if (!editing) return
    setBusy(true)
    try {
      const next = await window.pushistick.saveWorkflow({
        id: editing.id, name: editing.name, description: editing.description, steps: editing.steps
      })
      setWorkflows(next)
      setSelected(editing.id)
      setEditing(null)
      setNotice('Шаблон сохранён')
      window.setTimeout(() => setNotice(''), 2400)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    } finally { setBusy(false) }
  }

  const launch = async (id: string, initialPrompt = '') => {
    try {
      const { runId } = await window.pushistick.runWorkflow(id, initialPrompt)
      setNotice('Запуск создан: ' + runId.slice(0, 8))
      setPage('runs')
      await refresh()
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)) }
  }

  const start = async (id: string) => {
    const workflow = workflows.find((item) => item.id === id)
    const needsInput = workflow?.steps.some((step) => step.prompt.includes('{{input}}')) ?? false
    if (needsInput) {
      setPendingWorkflowId(id)
      setInitialInput('')
      return
    }
    await launch(id)
  }

  const confirmLaunch = async () => {
    if (!pendingWorkflowId || !initialInput.trim()) return
    const id = pendingWorkflowId
    setPendingWorkflowId(null)
    await launch(id, initialInput)
  }

  const remove = async (id: string) => {
    if (!window.confirm('Удалить этот шаблон?')) return
    setWorkflows(await window.pushistick.deleteWorkflow(id))
    if (selected === id) setSelected(null)
    if (editing?.id === id) setEditing(null)
  }

  const nav = [
    { id: 'home' as const, label: 'Обзор', icon: LayoutDashboard },
    { id: 'templates' as const, label: 'Мои шаблоны', icon: WorkflowIcon, count: workflows.length },
    { id: 'runs' as const, label: 'Запуски', icon: Activity },
    { id: 'queue' as const, label: 'Очередь', icon: ListOrdered }
  ]

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Zap size={19} fill="currentColor" /></div><div><b>Pushistick</b><span>DESKTOP AUTOMATION</span></div></div>
      <div className="workspace"><div className="workspace-dot" /><div><b>Локальное рабочее пространство</b><span>Этот компьютер</span></div><ChevronRight size={15} /></div>
      <div className="nav-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <nav>{nav.map((item) => <button key={item.id} className={'nav-item ' + (page === item.id ? 'active' : '')} onClick={() => { setPage(item.id); setEditing(null) }}><item.icon size={17} /><span>{item.label}</span>{item.count !== undefined && <small>{item.count}</small>}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="connection-card"><div className="connection-top"><span className={'status-dot ' + (cli?.installed ? 'online' : 'offline')} /> <b>Antigravity CLI</b></div><p>{cli?.installed ? cli.version : cli ? 'Не найден' : 'Проверка подключения…'}</p><button onClick={() => { setPage('settings'); void window.pushistick.checkAntigravity().then(setCli) }}>Настроить подключение <ArrowRight size={13}/></button></div>
        <button className="nav-item" onClick={() => setPage('settings')}><Settings2 size={17}/><span>Настройки</span></button>
        <div className="profile"><div className="avatar">P</div><div><b>Pushistick</b><span>Локальная версия</span></div><MoreHorizontal size={18}/></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><span>Pushistick</span><ChevronRight size={14}/><b>{nav.find((item) => item.id === page)?.label ?? 'Настройки'}</b></div><div className="top-actions"><div className="system-pill"><span className={'status-dot ' + (cli?.installed ? 'online' : 'offline')}/>{cli?.installed ? 'CLI подключён' : 'CLI не подключён'}</div><button className="icon-button" title="Справка"><CircleHelp size={17}/></button></div></header>
      <div className="page-content">
        {notice && <div className="toast"><Check size={15}/>{notice}<button onClick={() => setNotice('')}><X size={14}/></button></div>}
        {pendingWorkflowId && <div className="modal-backdrop"><section className="input-modal"><div className="modal-head"><div><div className="eyebrow">ПЕРЕМЕННЫЙ ПРОМПТ</div><h2>Входные данные для запуска</h2></div><button className="icon-button" onClick={() => setPendingWorkflowId(null)}><X size={17}/></button></div><p>Этот текст будет подставлен вместо <code>{'{{input}}'}</code> во всех шагах шаблона.</p><textarea autoFocus rows={8} value={initialInput} onChange={(e) => setInitialInput(e.target.value)} placeholder="Введи тему статьи, описание проекта или исходную задачу..."/><div className="modal-actions"><button className="secondary-button" onClick={() => setPendingWorkflowId(null)}>Отмена</button><button className="primary-button" disabled={!initialInput.trim()} onClick={() => void confirmLaunch()}><Play size={14} fill="currentColor"/> Запустить сценарий</button></div></section></div>}

        {page === 'home' && <>
          <div className="page-heading"><div><div className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</div><h1>Добро пожаловать в Pushistick</h1><p>Собирай повторяющиеся задачи в сценарии и запускай их одной кнопкой.</p></div><button className="primary-button" onClick={createNew}><Plus size={16}/> Создать шаблон</button></div>
          <section className="hero-panel"><div className="hero-copy"><div className="hero-kicker"><span className="pulse-dot"/> AUTOMATION ENGINE</div><h2>Меньше рутины.<br/><em>Больше результата.</em></h2><p>Pushistick последовательно отправляет запросы в Antigravity, ждёт завершения каждого шага и сохраняет историю выполнения.</p><button className="hero-button" onClick={() => setPage('templates')}>Открыть шаблоны <ArrowRight size={15}/></button></div><div className="workflow-art"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-core"><Zap size={31}/></div><div className="art-node node-a"><Terminal size={16}/></div><div className="art-node node-b"><Bot size={16}/></div><div className="art-node node-c"><Check size={16}/></div><div className="art-caption">SEQUENTIAL EXECUTION</div></div></section>
          <div className="section-title"><div><h3>Обзор</h3><p>Состояние вашего рабочего пространства</p></div></div>
          <div className="stats-grid"><div className="stat-card"><div className="stat-icon purple"><WorkflowIcon size={18}/></div><span>Всего шаблонов</span><b>{workflows.length}</b><small>Сохранено локально</small></div><div className="stat-card"><div className="stat-icon blue"><Activity size={18}/></div><span>Всего запусков</span><b>{runs.length}</b><small>Последние 100 запусков</small></div><div className="stat-card"><div className="stat-icon green"><Check size={18}/></div><span>Завершено</span><b>{runs.filter((run) => run.status === 'completed').length}</b><small>Успешные сценарии</small></div><div className="stat-card"><div className="stat-icon amber"><Cpu size={18}/></div><span>Antigravity CLI</span><b className="stat-word">{cli?.installed ? 'Готов' : 'Не найден'}</b><small>{cli?.version ?? 'Проверь установку CLI'}</small></div></div>
          <div className="split-grid"><section className="content-card"><div className="card-heading"><div><h3>Недавние шаблоны</h3><p>Быстрый доступ к сценариям</p></div><button className="text-button" onClick={() => setPage('templates')}>Все шаблоны <ArrowRight size={14}/></button></div>{workflows.length === 0 ? <Empty icon={<FolderKanban size={22}/>} title="Пока нет шаблонов" text="Создай первый сценарий из нескольких промптов." action={createNew}/> : workflows.slice(0, 4).map((workflow) => <div className="workflow-row" key={workflow.id}><div className="row-icon"><WorkflowIcon size={17}/></div><div className="row-main"><b>{workflow.name}</b><span>{workflow.steps.length} шагов · {workflow.description || 'Без описания'}</span></div><button className="run-small" onClick={() => void start(workflow.id)}><Play size={13} fill="currentColor"/> Запустить</button></div>)}</section>
          <section className="content-card"><div className="card-heading"><div><h3>Последние запуски</h3><p>Активность автоматизации</p></div><button className="icon-button" onClick={() => setPage('runs')}><ArrowRight size={16}/></button></div>{runs.length === 0 ? <Empty icon={<History size={22}/>} title="История пока пуста" text="Здесь появятся результаты запусков."/> : runs.slice(0, 4).map((run) => <div className="run-row" key={run.id}><div className={'run-status ' + run.status}>{run.status === 'completed' ? <Check size={14}/> : run.status === 'running' ? <LoaderCircle size={14}/> : <Square size={11}/>}</div><div className="row-main"><b>{run.workflowName}</b><span>{new Date(run.startedAt).toLocaleString('ru-RU')}</span></div><span className={'tag ' + run.status}>{statusLabel(run.status)}</span></div>)}</section></div>
        </>}

        {page === 'templates' && <><div className="page-heading"><div><div className="eyebrow">АВТОМАТИЗАЦИЯ</div><h1>Мои шаблоны</h1><p>Создавай сценарии из последовательных промптов.</p></div><button className="primary-button" onClick={createNew}><Plus size={16}/> Новый шаблон</button></div>
          {editing ? <section className="editor-card"><div className="editor-header"><div><div className="eyebrow">РЕДАКТОР СЦЕНАРИЯ</div><h2>{editing.id && workflows.some((w) => w.id === editing.id) ? 'Редактирование шаблона' : 'Новый шаблон'}</h2></div><button className="icon-button" onClick={() => setEditing(null)}><X size={18}/></button></div><label className="field-label">Название шаблона<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Например, Подготовка статьи"/></label><label className="field-label">Описание<input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Для чего нужен этот сценарий?"/></label><div className="steps-heading"><div><h3>Шаги выполнения</h3><p>Запросы отправляются строго по порядку. Следующий шаг начнётся после ответа на предыдущий.</p></div><span>{editing.steps.length} шага(ов)</span></div><div className="step-list">{editing.steps.map((step, index) => <div className="step-editor" key={step.id}><div className="step-number">{String(index + 1).padStart(2, '0')}</div><div className="step-input"><div className="step-label">ПРОМПТ · ШАГ {index + 1}</div><textarea value={step.prompt} onChange={(e) => setEditing({ ...editing, steps: editing.steps.map((item) => item.id === step.id ? { ...item, prompt: e.target.value } : item) })} placeholder="Напиши инструкцию для Antigravity..." rows={3}/><div className="variable-hint">Используй <code>{'{{input}}'}</code>, чтобы запросить текст у пользователя при запуске.</div></div><button className="icon-button danger-ghost" title="Удалить шаг" onClick={() => setEditing({ ...editing, steps: editing.steps.filter((item) => item.id !== step.id) })}><Trash2 size={16}/></button></div>)}</div><button className="add-step" onClick={() => setEditing({ ...editing, steps: [...editing.steps, makeStep()] })}><Plus size={15}/> Добавить шаг</button><div className="editor-footer"><button className="secondary-button" onClick={() => setEditing(null)}>Отмена</button><button className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? <LoaderCircle size={15} className="spin"/> : <Check size={15}/>} Сохранить шаблон</button></div></section> : <><div className="toolbar"><div className="search-box"><Search size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск шаблонов..."/></div><span>{filtered.length} шаблонов</span></div>{filtered.length === 0 ? <Empty icon={<WorkflowIcon size={22}/>} title="Шаблоны не найдены" text="Создай шаблон или измени поисковый запрос." action={createNew}/> : <div className="template-grid">{filtered.map((workflow) => <div className="template-card" key={workflow.id}><div className="template-card-top"><div className="template-icon"><WorkflowIcon size={19}/></div><button className="icon-button" onClick={() => setEditing(workflow)}><Settings2 size={16}/></button></div><h3>{workflow.name}</h3><p>{workflow.description || 'Нет описания'}</p><div className="template-meta"><span><ListOrdered size={14}/>{workflow.steps.length} шагов</span><span><Clock3 size={14}/>{new Date(workflow.updatedAt).toLocaleDateString('ru-RU')}</span></div><div className="template-actions"><button className="primary-button" onClick={() => void start(workflow.id)}><Play size={14} fill="currentColor"/> Запустить</button><button className="secondary-button" onClick={() => setEditing(workflow)}>Изменить</button><button className="icon-button danger-ghost" onClick={() => void remove(workflow.id)}><Trash2 size={15}/></button></div></div>)}</div>}</>}
        </>}

        {page === 'runs' && <><div className="page-heading"><div><div className="eyebrow">МОНИТОРИНГ</div><h1>Запуски</h1><p>Следи за выполнением сценариев и результатами шагов.</p></div><button className="secondary-button" onClick={() => void refresh()}><Activity size={15}/> Обновить</button></div><div className="content-card runs-list"><div className="card-heading"><div><h3>История выполнения</h3><p>Последние 100 запусков</p></div><span className="muted-count">{runs.length} записей</span></div>{runs.length === 0 ? <Empty icon={<History size={22}/>} title="Запусков ещё нет" text="Выбери шаблон и нажми «Запустить»."/> : runs.map((run) => <div className="history-item" key={run.id}><div className={'run-status ' + run.status}>{run.status === 'completed' ? <Check size={14}/> : run.status === 'running' ? <LoaderCircle size={14}/> : run.status === 'failed' ? <X size={14}/> : <Square size={11}/>}</div><div className="row-main"><b>{run.workflowName}</b><span>{new Date(run.startedAt).toLocaleString('ru-RU')} {run.finishedAt ? ' · завершён ' + new Date(run.finishedAt).toLocaleTimeString('ru-RU') : ''}</span>{run.error && <small className="error-text">{run.error}</small>}{run.results?.length > 0 && <details className="run-results"><summary>Показать ответы ({run.results.length})</summary>{run.results.map((result, index) => <div className="saved-result" key={index}><b>Шаг {index + 1}</b><p>{result}</p></div>)}</details>}</div><span className={'tag ' + run.status}>{statusLabel(run.status)}</span></div>)}</div><div className="content-card live-log"><div className="card-heading"><div><h3>Журнал событий</h3><p>События текущего сеанса</p></div><span className="live-indicator"><i/> LIVE</span></div>{events.length === 0 ? <p className="empty-log">События появятся после запуска шаблона.</p> : events.map((event, index) => <div className="log-line" key={index}><span>{new Date().toLocaleTimeString('ru-RU')}</span><b>{event.type}</b><p>{event.message || event.response || event.prompt || event.status || ''}</p></div>)}</div></>}

        {page === 'queue' && <><div className="page-heading"><div><div className="eyebrow">УПРАВЛЕНИЕ ЗАДАЧАМИ</div><h1>Очередь</h1><p>Активные и ожидающие выполнения сценарии.</p></div></div><div className="content-card"><div className="card-heading"><div><h3>Текущие задачи</h3><p>Сейчас выполняемые процессы</p></div></div>{activeRun ? <div className="history-item"><div className="run-status running"><LoaderCircle size={14}/></div><div className="row-main"><b>{activeRun.workflowName}</b><span>Выполняется с {new Date(activeRun.startedAt).toLocaleTimeString('ru-RU')}</span></div><span className="tag running">В работе</span><button className="secondary-button danger-button" onClick={() => void window.pushistick.stopRun(activeRun.id)}>Остановить</button></div> : <Empty icon={<ListOrdered size={22}/>} title="Очередь пуста" text="Пока нет выполняемых задач. Запусти любой шаблон." action={() => setPage('templates')}/>}</div><div className="info-banner"><ShieldCheck size={18}/><div><b>Последовательное выполнение</b><p>В текущей версии один сценарий выполняется за раз. Параллельная очередь и расписания появятся в следующих версиях.</p></div></div></>}

        {page === 'settings' && <><div className="page-heading"><div><div className="eyebrow">ПРИЛОЖЕНИЕ</div><h1>Настройки</h1><p>Подключение к Antigravity и параметры Pushistick.</p></div></div><section className="content-card settings-card"><div className="settings-title"><div className="settings-icon"><Bot size={20}/></div><div><h3>Google Antigravity CLI</h3><p>Локальный интерфейс для выполнения промптов</p></div><span className={'tag ' + (cli?.installed ? 'completed' : 'failed')}>{cli?.installed ? 'Найден' : 'Не найден'}</span></div><div className="settings-detail"><span>Команда</span><code>agy</code></div><div className="settings-detail"><span>Версия</span><b>{cli?.version ?? 'Не определена'}</b></div><div className="settings-detail"><span>Авторизация</span><b>Проверяется при первом запуске</b></div>{cli?.error && <p className="error-text">{cli.error}</p>}<div className="settings-actions"><button className="secondary-button" onClick={() => void window.pushistick.checkAntigravity().then(setCli)}><Activity size={15}/> Проверить снова</button></div><div className="setup-hint"><b>Как подключить Antigravity</b><ol><li>Установи Google Antigravity CLI согласно официальной инструкции.</li><li>Открой PowerShell и выполни команду <code>agy</code>.</li><li>Заверши вход в свой Google-аккаунт.</li><li>Вернись в Pushistick и нажми «Проверить снова».</li></ol><a href="https://antigravity.google/docs/cli/headless/" target="_blank" rel="noreferrer">Официальная документация CLI <ArrowRight size={13}/></a></div></section><div className="info-banner"><ShieldCheck size={18}/><div><b>Локальная безопасность</b><p>Google-логин и данные авторизации не передаются Pushistick. Приложение запускает установленную на компьютере команду agy и использует стандартные разрешения Antigravity.</p></div></div><div className="about-line"><span>Pushistick Desktop</span><span>Версия 0.1.0 · Windows</span></div></>}
      </div>
    </main>
  </div>
}

function statusLabel(status: string) {
  return ({ queued: 'В очереди', running: 'В работе', completed: 'Завершён', failed: 'Ошибка', stopped: 'Остановлен' } as Record<string, string>)[status] ?? status
}

function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: () => void }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><b>{title}</b><p>{text}</p>{action && <button className="secondary-button" onClick={action}><Plus size={14}/> Создать шаблон</button>}</div>
}

export default App
