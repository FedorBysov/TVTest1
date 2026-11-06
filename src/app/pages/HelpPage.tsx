import { Panel, SectionTitle } from '../components'

const steps = [
  ['01', 'Выберите профиль', 'В шапке переключите два вымышленных учебных варианта: ВВЭР или СМР. Смена профиля начинает занятие заново.'],
  ['02', 'Осмотрите пост', 'На обзоре нажмите «Развернуть стол»: рукоятки, пять тумблеров и кнопки на 3D-модели интерактивны. Их действия продублированы кнопками под сценой.'],
  ['03', 'Проверьте модуль', 'На странице пульта поворачивайте учебную рукоятку и сравнивайте условные числа с прибором.'],
  ['04', 'Запустите сценарий', 'Откройте пять этапов, запустите учебное время и при желании введите одно из двух отклонений.'],
  ['05', 'Разберите цепочку', 'Квитируйте сигнал, отдельно устраните причину и сравните сохранённые снимки в журнале.'],
]

export function HelpPage() {
  return <div className="page help-page">
    <SectionTitle eyebrow="05 / Помощь" title="Как работать с прототипом" />
    <p className="page-lead">Это демонстрация идеи учебного интерфейса. Все шкалы, сигналы, приборы и причины придуманы для обсуждения продукта.</p>

    <div className="help-grid">
      <Panel className="help-steps"><div className="panel-heading"><span className="panel-index">МАРШРУТ НА ПЯТЬ МИНУТ</span></div><ol>{steps.map(([number, title, text]) => <li key={number}><span>{number}</span><div><strong>{title}</strong><p>{text}</p></div></li>)}</ol></Panel>
      <div className="help-side">
        <Panel className="help-card"><div className="panel-heading"><span className="panel-index">СИГНАЛЫ И ДЕЙСТВИЯ</span></div><div className="legend-row"><span className="legend-normal">●</span><p><strong>Норма</strong><small>Причина не активна.</small></p></div><div className="legend-row"><span className="legend-warning">▲</span><p><strong>Предупреждение</strong><small>Снижение условного расхода.</small></p></div><div className="legend-row"><span className="legend-alarm">⬣</span><p><strong>Учебная тревога</strong><small>Расхождение двух вымышленных индикаторов.</small></p></div><p className="microcopy">Квитирование лишь фиксирует, что сигнал замечен. Устранение учебной причины — отдельное действие.</p></Panel>
        <Panel className="help-card"><div className="panel-heading"><span className="panel-index">ДОСТУПНОСТЬ</span></div><p>Каждую 3D-зону можно открыть соседней HTML-кнопкой. Кнопки, вкладки и выбор профиля доступны с клавиатуры. Системная настройка уменьшения движения отключает переходные анимации.</p><p>Сигналы различаются формой и словами, а значения приборов продублированы обычным текстом.</p></Panel>
      </div>
    </div>

    <Panel className="limitations-panel"><div className="panel-heading"><span className="panel-index">ГРАНИЦЫ ТЕКУЩЕЙ ВЕРСИИ</span></div><div className="limitations-grid"><p><strong>Учебные данные</strong><span>Показания — проценты условной шкалы. Это не реальные параметры установки, формулы, уставки или аварийные инструкции.</span></p><p><strong>Локальная работа</strong><span>Нет соединения с АЭС, промышленными контроллерами и живой телеметрией. Групповые роли имитируются в одном браузере.</span></p><p><strong>Desktop без VR</strong><span>VR, три гарнитуры, аппаратная совместимость, лицензия и поставка относятся к будущему полному комплексу и не реализованы здесь.</span></p></div></Panel>
  </div>
}
