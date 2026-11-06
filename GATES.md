# Gates: короткое видео TVTest1

OWNS: scripts/demo/**, docs/demo-video/**, public/media/**, src/app/pages/OverviewPage.tsx, src/styles/app.css, README.md, TASKS.md, GATES.md, package.json, package-lock.json

Scope: воспроизводимое короткое русскоязычное видео настоящего desktop-прототипа, встроенное в публичный сайт GitHub Pages.

- [x] G1: запись и монтаж показывают реальные действия, а текст озвучки соответствует кадрам
  EVIDENCE: Playwright открыл опубликованный URL, выполнил проверенный щелчок по 3D-органу управления и записал 6 глав; вручную сопоставлены таймкоды текста и финальные кадры ВВЭР, СМР, предупреждения, квитирования и разбора из .cache/demo/. Проверены и исправлены пустые WebGL-кадры СМР в интервале 26,96–27,08 с.

- [x] G2: финальный MP4 имеет H.264, ненулевую AAC-дорожку, ограниченную длительность и русские субтитры
  CHECK: node scripts/demo/verify.mjs media
  EXPECT: MEDIA_OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=c40d7efdc8a42d5c2f1d944eda502cfb16c5ab5f4d81f746298171ce9a9e48e0; exit=0; EXPECT=matched; output-sha256=2a6cf7a6a52a911ad089727ed66f9f85469105dfaa538ba380b5222e6e18f982; output-bytes=24; shell=/bin/sh; cwd=/Users/byssov/Desktop/TVTest1; path=5bde1bdd0bf8/37 entries

- [x] G3: production-сборка содержит медиафайлы и подключает плеер и VTT через базовый путь
  CHECK: node scripts/demo/verify.mjs site
  EXPECT: SITE_MEDIA_OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=7e67147fce0c612a388ac0536eefe83a605c2c219749b1f129347e1232be767f; exit=0; EXPECT=matched; output-sha256=c90ec43d6566850351512fc68c332f71a6e2eb217ae3ea20d633d8332eb58579; output-bytes=38; shell=/bin/sh; cwd=/Users/byssov/Desktop/TVTest1; path=5bde1bdd0bf8/37 entries

- [x] G4: сборка, тесты и проверка структуры проходят после встраивания ролика
  CHECK: node scripts/demo/verify.mjs integration
  EXPECT: INTEGRATION_OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=0990bf99c59c13cdfad9b4d2ccec2cf849244a2a1ebe4d580054de026fefa888; exit=0; EXPECT=matched; output-sha256=1a4d7f338f8f10041b2b6aa09aeeb774e22fd903415d82341a8cda6405bcaff7; output-bytes=53; shell=/bin/sh; cwd=/Users/byssov/Desktop/TVTest1; path=5bde1bdd0bf8/37 entries

- [x] G5: репозиторий и GitHub Pages содержат и воспроизводят финальный ролик
  EVIDENCE: GitHub Actions run 42205709666 для коммита c641e35 завершился success; на https://fedorbysov.github.io/TVTest1/ MP4, VTT и JPEG возвращают HTTP 200, Chrome воспроизвёл 1,9 с видео 1600×900 с 16 русскими cue и без ошибок страницы.
