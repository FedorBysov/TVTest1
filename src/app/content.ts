import type { ScenarioId, ZoneId } from '../sim/model'

export const ZONES: Record<ZoneId, { number: string; title: string; short: string; detail: string }> = {
  power: {
    number: '01', title: 'Режим и мощность', short: 'Учебная команда и основная шкала',
    detail: 'Поверните учебную рукоятку на один фиксатор и сравните цель с текущим условным показанием.',
  },
  systems: {
    number: '02', title: 'Параметры и системы', short: 'Связанные условные показания',
    detail: 'Сопоставьте условные температуру, давление и расход. При отклонении меняется связанный прибор и журнал.',
  },
  alarms: {
    number: '03', title: 'Сигнализация', short: 'Причина, уровень и квитирование',
    detail: 'Сигнал показывает учебное отклонение. Квитирование подтверждает его просмотр, а причину устраняют отдельно.',
  },
}

export const SCENARIOS: Record<ScenarioId, { number: string; title: string; summary: string; outcome: string }> = {
  normal: {
    number: 'А', title: 'Штатный учебный маршрут',
    summary: 'Пять этапов, изменение условной цели и наблюдение согласованных показаний.',
    outcome: 'Сравните, как прибор следует за учебной командой и что записалось в журнал.',
  },
  flow: {
    number: 'Б', title: 'Снижение условного расхода',
    summary: 'Вымышленный контур показывает предупреждение на боковой зоне приборов.',
    outcome: 'Квитируйте предупреждение и отдельно устраните учебную причину.',
  },
  split: {
    number: 'В', title: 'Расхождение индикаторов',
    summary: 'Два условных индикатора расходятся и дают учебную тревогу другой формы.',
    outcome: 'Сравните оба числа, подтвердите сигнал и восстановите согласованность.',
  },
}

export const NAV = [
  { route: 'overview', number: '01', label: 'Обзор БЩУ', hint: 'Карта поста' },
  { route: 'console', number: '02', label: 'Пульт и приборы', hint: 'Физический модуль' },
  { route: 'scenarios', number: '03', label: 'Сценарии', hint: 'Пять этапов' },
  { route: 'session', number: '04', label: 'Занятие и разбор', hint: 'Хронология' },
  { route: 'help', number: '05', label: 'Помощь', hint: 'Как пользоваться' },
] as const

export const DISCLAIMER = 'Учебный прототип · условные данные · не для управления АЭС'
