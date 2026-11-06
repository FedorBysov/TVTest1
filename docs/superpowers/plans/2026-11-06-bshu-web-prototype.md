# Учебный БЩУ: план реализации веб-прототипа

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans for sequential tasks; parallel file ownership and verification in this project are governed by `.unlazy/tvtest1-web/PLAN.md`. Use the checkboxes below to track work.

**Goal:** Создать и опубликовать реалистичный русскоязычный desktop-прототип учебного БЩУ с 3D-обзором, детальным прибором, моделью сценариев и разбором.

**Architecture:** Vite/React/TypeScript с чистым модулем учебной модели. Three.js отображает фиксированную 3D-карту, build123d экспортирует физические детали, Anatomy строит крупный изометрический SVG-модуль. Статическое приложение публикуется на GitHub Pages.

**Tech Stack:** Node 22, npm 10, React, TypeScript, Vite, Three.js, build123d 0.13.0, Anatomy, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-06-bshu-web-prototype-design.md`, `anatomy_bshu_prompt_visual_v2.md`, `docs/original_specification.txt`.

## Global Constraints

- Только desktop, контроль 1280×800, 1440×900, 1920×1080; VR и WebXR отсутствуют.
- Русский UI, постоянная пометка «Учебный прототип · условные данные · не для управления АЭС».
- Все числа и причинные правила вымышлены, шкала условная 0–100; никаких реальных уставок и процедур.
- Все создаваемые файлы находятся внутри `/Users/byssov/Desktop/TVTest1`; `engine` остаётся нетронутым.
- Три зоны: `power`, `systems`, `alarms`; профили: `vver`, `smr`; пять этапов 0–4; сценарии: `normal`, `flow`, `split`.
- Весь UI, 3D, SVG, график и журнал получают значения из одного `DisplaySnapshot`.
- GitHub Pages использует `/TVTest1/`; репозиторий становится публичным по явному решению пользователя.

## Review Focus

1. Обновление профиля во время активной тревоги: занятие сбрасывается явно, тема остаётся.
2. Квитирование активной причины: статус подтверждения меняется, серьёзность и причина остаются до отдельного устранения.
3. Переход между разделами и reload: профиль, этап, сигнал и журнал согласованы.
4. Недоступный WebGL или reduced motion: учебные действия доступны в HTML, показания и сигналы не теряются.
5. Длинные русские подписи на 1280×800: важные действия и цифры не обрезаются.

---

## Карта файлов и интерфейсов

- `src/sim/model.ts`, `tests/sim/*`: детерминированное состояние и снимки.
- `cad/generate_parts.py`, `cad/parts-list.md`, `public/assets/cad/*`: CAD-источник и сетки.
- `src/scene/ControlRoom.tsx`, `src/scene/*`, `tests/scene/*`: Three.js и кинематика.
- `src/figure/ModuleFigure.tsx`, `src/figure/*`, `tests/figure/*`: Anatomy SVG и синхронизация.
- `docs/visual-direction.md`, `src/styles/tokens.css`: визуальная грамматика и токены.
- `src/app/*`, `src/styles/app.css`, `src/main.tsx`: пять страниц и общие элементы.
- `COVERAGE.md`, `README.md`, `TASKS.md`, `.github/workflows/pages.yml`: документация и публикация.

Контракт модели: `createSession(profile?: Profile): SessionState`; `reduceSession(state: SessionState, action: SessionAction): SessionState`; `deriveSnapshot(state: SessionState): DisplaySnapshot`; `STAGES` — пять русских имён. `Profile = 'vver'|'smr'`, `ZoneId = 'power'|'systems'|'alarms'`, `ScenarioId = 'normal'|'flow'|'split'`, `StageId = 0|1|2|3|4`. Действия: `PROFILE`, `STAGE`, `SCENARIO`, `TICK`, `COMMAND`, `TRIGGER`, `ACK`, `RESOLVE`, `PAUSE`, `RESET`, `HINT`, `MODE`, `ACTOR`, `ASSIGN`. Снимок содержит `readings.power/temperature/pressure/flow/indicatorB`, `signal.kind/label/cause/acknowledged`, `stageLabel`, `time`, `command`, `profile`, `stage`, `scenario`, `systems`. Конкретные типы и допустимые диапазоны фиксирует модель; остальные модули не хранят копии показаний.

Контракт сцены: `ControlRoom({ snapshot, profile, selectedZone, onSelectZone })`. Контракт фигуры: `ModuleFigure({ snapshot, profile, zone, onCommand, onAcknowledge })`. Токены CSS: `--bg`, `--surface`, `--surface-raised`, `--ink`, `--muted`, `--line`, `--accent`, `--warning`, `--alarm`, `--success` в `:root/[data-theme]`.

## Task 1. Основа проекта (root)

- [ ] Написать `package.json`, TypeScript/Vite config и HTML entry.
- [ ] Установить локальные npm-зависимости и сохранить lockfile.
- [ ] Создать проектную `.venv`, установить build123d 0.13.0 без зависимости от `engine`.
- [ ] Добавить базовый `src/main.tsx` и стабильный hash-router.
- [ ] Запустить пустой минимальный сайт и проверить production build.

## Task 2. Учебная модель (leaf 1.1.1)

- [ ] Сначала написать тесты профилей, пяти этапов и детерминированных показаний; увидеть ожидаемый RED.
- [ ] Реализовать чистые `createSession`, `reduceSession`, `deriveSnapshot`.
- [ ] Проверить отдельные сценарии `normal`, `flow`, `split`.
- [ ] Проверить паузу, сброс, квитирование без устранения, снимки журнала и роли.
- [ ] Запустить `npm run test:sim`; выполнить обзор независимости от UI.

## Task 3. Визуальное направление и Anatomy (leaf 1.1.3)

- [ ] Написать пакет с исходными ограничениями, двумя отличающимися маршрутами и выбранным решением.
- [ ] Зафиксировать палитру, контрасты, типографику, сетку, материалы, свет, камеру, движение, права и антипаттерны.
- [ ] Создать CSS-токены двух тем с понятными ролями.
- [ ] Построить детальный физический Anatomy-модуль из локального kit.
- [ ] Подключить показание, стрелку, рукоятку, кнопку и лампу к `DisplaySnapshot`.
- [ ] Проверить структуру и состояния тестами `npm run test:figure` и осмотром на 1×/4×.

## Task 4. CAD и 3D (leaf 1.1.2)

- [ ] Написать список осмысленных деталей и опор.
- [ ] Смоделировать три типа деталей в build123d, назвать локальные оси и ход.
- [ ] Экспортировать STL в `public/assets/cad/`, добавить `--check` для повторной проверки.
- [ ] Построить цоколь, три сектора, консоль, сигнализацию, приборы и кресло в Three.js.
- [ ] Задать две различимые компоновки `vver` и `smr`.
- [ ] Связать выбор зоны и сигнальные лампы со снимком.
- [ ] Использовать `AnimationMixer` для вращения, нажатия и стрелки.
- [ ] Запустить `npm run test:scene`, проверить WebGL fallback.

## Task 5. Страницы и интеграция (root)

- [ ] Реализовать общий layout, навигацию, профиль, тему и сохранение состояния.
- [ ] Собрать обзор: сцена, кнопки зон, пять показаний.
- [ ] Собрать пульт: Figure, описание зоны, HTML-дубли органов управления.
- [ ] Собрать сценарии: пять этапов, три маршрута, часы, график и действия.
- [ ] Собрать занятие: три роли, назначение, журнал, снимки и разбор.
- [ ] Собрать помощь и ограничения.
- [ ] Проверить сохранение единого снимка при переходах и reload.

## Task 6. Документация и проверки (root)

- [ ] Заполнить `COVERAGE.md` для ТЗ-01…ТЗ-30.
- [ ] Обновить `README.md` командами запуска, картой страниц и демонстрационными маршрутами.
- [ ] Сохранить скриншоты обзора и пульта в `docs/screenshots/`.
- [ ] Запустить тесты, build и структурную проверку.
- [ ] Осмотреть браузер в двух темах и трёх desktop-размерах, пройти все маршруты.
- [ ] Повторно проверить листья, интеграционные и корневые gate-файлы.

## Task 7. Публикация (root)

- [ ] Добавить workflow сборки и публикации GitHub Pages.
- [ ] Сделать `TVTest1` публичным по решению пользователя.
- [ ] Слить проверенную работу в `main` и отправить на GitHub.
- [ ] Дождаться успешного workflow, проверить сайт по конечному URL.
- [ ] Сравнить удалённый и локальный commit; отметить фактически закрытые пункты `TASKS.md`.
