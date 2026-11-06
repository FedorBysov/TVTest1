import { Panel, SectionTitle } from '../components'

const steps = [
  ['01', 'Выберите профиль', 'В шапке переключите два вымышленных учебных варианта: ВВЭР или СМР. Смена профиля начинает занятие заново.'],
  ['02', 'Осмотрите пост', 'ВВЭР показывает длинную приборную стену, СМР — компактный экранный пост. В расширенном 3D-виде выберите зону, масштабируйте и перетаскивайте щит; основные органы управления кликабельны.'],
  ['03', 'Запишите наблюдение', 'На странице пульта выберите зону, сопоставьте условное показание с командой и нажмите «Записать наблюдение этой зоны». Событие попадёт в журнал и учебный чеклист.'],
  ['04', 'Пройдите сценарий', 'На странице сценариев выполните контрольные действия пяти этапов. Для двух отклонений следуйте отдельным чеклистам: наблюдение, квитирование, устранение причины и повторная проверка.'],
  ['05', 'Разберите результат', 'Откройте занятие: отчёт покажет выполненные, пропущенные и нарушенные по порядку действия с основаниями. Исторический снимок не меняет текущее состояние; разбор можно скачать в JSON.'],
]

export function HelpPage() {
  return <div className="page help-page">
    <SectionTitle eyebrow="05 / Помощь" title="Как работать с прототипом" />
    <p className="page-lead">Это демонстрация идеи учебного интерфейса. Все шкалы, сигналы, приборы и причины придуманы для обсуждения продукта.</p>

    <div className="help-grid">
      <Panel className="help-steps"><div className="panel-heading"><span className="panel-index">МАРШРУТ НА ПЯТЬ МИНУТ</span></div><ol>{steps.map(([number, title, text]) => <li key={number}><span>{number}</span><div><strong>{title}</strong><p>{text}</p></div></li>)}</ol></Panel>
      <div className="help-side">
        <Panel className="help-card"><div className="panel-heading"><span className="panel-index">СИГНАЛЫ И ДЕЙСТВИЯ</span></div><div className="legend-row"><span className="legend-normal">●</span><p><strong>Норма</strong><small>Причина не активна.</small></p></div><div className="legend-row"><span className="legend-warning">▲</span><p><strong>Предупреждение</strong><small>Снижение условного расхода.</small></p></div><div className="legend-row"><span className="legend-alarm">⬣</span><p><strong>Учебная тревога</strong><small>Расхождение двух вымышленных индикаторов.</small></p></div><p className="microcopy">Квитирование лишь фиксирует, что сигнал замечен. Устранение учебной причины — отдельное действие.</p></Panel>
        <Panel className="help-card"><div className="panel-heading"><span className="panel-index">ГРУППА ВКЛАДОК</span></div><p>В разделе «Занятие» ведущая вкладка создаёт код группы. Ещё одна или две вкладки того же сайта и браузерного профиля подключаются как оператор или наблюдатель. Инструктор управляет сценарием и временем, оператор — разрешёнными органами щита, наблюдатель записывает наблюдения.</p><p className="microcopy">Общий снимок передаётся через BroadcastChannel. При потере ведущей вкладки действия участников блокируются. Код не служит аутентификацией; разные устройства без отдельного сервера не синхронизируются.</p></Panel>
        <Panel className="help-card"><div className="panel-heading"><span className="panel-index">ДОКУМЕНТАЦИЯ</span></div><p>Подробности текущей версии доступны в открытом репозитории:</p><ul><li><a href="https://github.com/FedorBysov/TVTest1/blob/main/docs/user-guide.md">Руководство пользователя</a></li><li><a href="https://github.com/FedorBysov/TVTest1/blob/main/docs/technical-description.md">Техническое описание</a></li><li><a href="https://github.com/FedorBysov/TVTest1/blob/main/docs/demo-runbook.md">Сценарий демонстрации</a></li><li><a href="https://github.com/FedorBysov/TVTest1/blob/main/docs/references.md">Реестр референсов</a></li></ul></Panel>
        <Panel className="help-card"><div className="panel-heading"><span className="panel-index">ДОСТУПНОСТЬ</span></div><p>Каждую 3D-зону можно открыть соседней HTML-кнопкой. Кнопки, вкладки и выбор профиля доступны с клавиатуры. Системная настройка уменьшения движения отключает переходные анимации.</p><p>Сигналы различаются формой и словами, а значения приборов продублированы обычным текстом.</p></Panel>
      </div>
    </div>

    <Panel className="limitations-panel"><div className="panel-heading"><span className="panel-index">ГРАНИЦЫ ТЕКУЩЕЙ ВЕРСИИ</span></div><div className="limitations-grid"><p><strong>Учебные данные</strong><span>Показания — проценты условной шкалы. Щит собран по открытым референсам и не повторяет конкретную АЭС 1:1; чеклисты не являются эксплуатационными инструкциями или аттестацией персонала.</span></p><p><strong>Локальная группа</strong><span>Синхронизируются только вкладки одного origin. Нет соединения с АЭС, промышленными контроллерами, живой телеметрией и сервером удалённых занятий.</span></p><p><strong>Desktop без VR</strong><span>VR исключён из объёма этой версии. Лицензия продукта, инструктаж, гарантия и физическая поставка веб-прототипом не подтверждаются.</span></p></div></Panel>
  </div>
}
