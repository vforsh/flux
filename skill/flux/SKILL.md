---
name: flux
description: Использование CLI `flux` (@vforsh/flux) для генерации и редактирования изображений через Black Forest Labs (BFL) FLUX API. Используй, когда нужно: настроить ключ BFL, выбрать модель, сгенерировать изображение, отредактировать по референсам, сделать inpaint/outpaint, дождаться результата, получить credits, работать в --plain/--json режимах, разрулить типовые API ошибки (402/403/429).
---

# Flux CLI (BFL / FLUX)

CLI для генерации и редактирования изображений через BFL FLUX API.

## Быстрый старт

1) Ключ:

- env:
  - `export BFL_API_KEY="..."`
- или сохранить локально (читает из stdin; не светить в истории shell):
  - `echo "$BFL_API_KEY" | flux config set apiKey`

2) Генерация:

- `flux gen "a cat astronaut" --model flux-2-pro --width 1024 --height 1024 -o out/`

3) Редактирование по референсу:

- `flux edit "make it sunset lighting" --model flux-2-pro --input ./in.jpg -o out/`

## Команды

`flux gen [prompt]`
- text-to-image
- prompt можно передать аргументом, или `-` / stdin

`flux edit [prompt] --input <path|url|base64> [--input ...]`
- image-to-image edit по prompt + 1..N входных изображений (base + refs)

`flux fill [prompt] --image <path|url|base64> [--mask <path|url|base64>]`
- inpaint (маска отдельно или alpha канал)

`flux expand [prompt] --image <path|url|base64> [--top/--bottom/--left/--right <px>]`
- outpaint (расширение холста пикселями по сторонам)

`flux result <id> [--out <path|->]`
- статус/результат по id
- если `status=Ready` и задан `--out`, скачает результат

`flux wait <id> [--polling-url <url>] [--out <path|->]`
- ждать до `Ready`/ошибки, опционально скачать результат

`flux credits`
- показать остаток credits

`flux models`
- список ключей моделей, которые CLI знает “из коробки”

`flux config path|get|set|unset`
- локальная конфигурация (в т.ч. сохранение ключа через stdin)

## Глобальные флаги

- `--json`: один JSON объект в stdout (для скриптов)
- `--plain`: стабильный “плоский” вывод (пути/ids)
- `-q, --quiet`: меньше логов
- `-v, --verbose`: диагностика в stderr (без секретов)
- `--endpoint <host>`: API host (по умолчанию `api.bfl.ai`)
- `--region <us|eu|global>`: шорткат host
- `--timeout <ms>`: таймаут
- `--retries <n>`: ретраи для 429/5xx
- `--out-dir <dir>`: дефолтная папка для сохранения результатов

## Основные флаги генерации/редактирования

- `--model <key>`: модель (см. `flux models`)
- `--seed <n>`
- `--safety <n>`: safety_tolerance (диапазон зависит от модели)
- `--format <jpeg|png>`: output_format
- `-o, --out <path|->`: файл/директория или `-` для stdout
- `--no-wait`: не ждать; вывести `id` (+ `pollingUrl` в `--json`)
- `--poll-interval <ms>`

Advanced (escape hatch):
- `--body <json|@file>`: сырой request body (когда нужен полный контроль)

## Модели (ключи)

Официальные ключи меняются; ориентир: `flux models`.

Встроенные сейчас:
- FLUX.2: `flux-2-pro`, `flux-2-flex`, `flux-2-max`, `flux-2-klein-4b`, `flux-2-klein-9b`
- Kontext: `flux-kontext-pro`, `flux-kontext-max`
- FLUX 1.1: `flux-pro-1.1`, `flux-pro-1.1-ultra`
- Tools: `flux-pro-1.0-fill`, `flux-pro-1.0-expand`
- Passthrough (через `--body`): `flux-dev`, `flux-pro`

## Заметки по безопасности/надежности

- **Ключ**: не передавать секреты флагами; использовать env/config/stdin.
- **Signed URL**: `result.sample` обычно короткоживущий; скачивать сразу.

## Типовые ошибки (exit codes)

- `2`: неправильные аргументы/валидация
- `3`: нет ключа или `403`
- `4`: `402` (нет credits)
- `5`: `429` (rate limit)
- `6`: moderation
- `7`: прочие API/таск ошибки
