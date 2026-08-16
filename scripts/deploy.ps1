<#
.SYNOPSIS
  Ручной деплой Kino-app, пока GitHub Actions заблокированы флагом T&S.

.DESCRIPTION
  Пока на аккаунте Arsid0305 висит флаг, не работают ни Actions, ни
  GitHub-интеграции Vercel и Supabase. Этот скрипт заменяет их одной командой:
  подтягивает main, ставит зависимости, гоняет проверки и деплоит фронт на Vercel.
  Edge functions деплоятся отдельным ключом -Functions (нужен Supabase CLI).

.PARAMETER SkipChecks
  Пропустить tsc и тесты. Только когда точно знаешь, что делаешь.

.PARAMETER Functions
  Дополнительно задеплоить edge functions ai-chat и movie-recommendation.

.PARAMETER DryRun
  Всё проверить и собрать, но не публиковать.

.EXAMPLE
  .\scripts\deploy.ps1
  .\scripts\deploy.ps1 -Functions
#>

[CmdletBinding()]
param(
    [switch]$SkipChecks,
    [switch]$Functions,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$ProjectRef = 'ovhwxfdtkzwxfomdlgjv'

function Write-Step($text) { Write-Host "`n=== $text ===" -ForegroundColor Cyan }
function Write-Ok($text)   { Write-Host "  OK  $text" -ForegroundColor Green }
function Fail($text)       { Write-Host "`nОСТАНОВ: $text" -ForegroundColor Red; exit 1 }

# git и npm пишут UTF-8, а консоль по умолчанию читает их в cp866 —
# русский текст в выводе (сообщения коммитов, ошибки) превращался в кракозябры.
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {
    # Не в интерактивной консоли — не беда, на сам деплой не влияет.
}

# Работаем от корня репозитория, а не от папки, где лежит скрипт.
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot
Write-Host "Репозиторий: $repoRoot" -ForegroundColor DarkGray

Write-Step 'Проверка рабочей копии'
if (-not (Test-Path '.git')) { Fail 'это не git-репозиторий' }

# Незакоммиченные правки уехали бы в прод: vercel отправляет файлы как есть.
$dirty = git status --porcelain
if ($dirty) {
    Write-Host $dirty -ForegroundColor Yellow
    Fail 'есть незакоммиченные изменения. Закоммить, спрячь в stash или деплой из чистого клона.'
}
Write-Ok 'рабочая копия чистая'

Write-Step 'Синхронизация с main'
git checkout main | Out-Null
git pull origin main
if ($LASTEXITCODE -ne 0) { Fail 'git pull не прошёл' }
$head = git log --oneline -1
Write-Ok "HEAD: $head"

Write-Step 'Зависимости'
# npm ci быстрее и воспроизводимее, чем install, и не трогает package-lock.
npm ci
if ($LASTEXITCODE -ne 0) { Fail 'npm ci не прошёл' }
Write-Ok 'зависимости установлены'

if (-not $SkipChecks) {
    Write-Step 'Проверки'

    npx tsc --noEmit
    if ($LASTEXITCODE -ne 0) { Fail 'tsc нашёл ошибки типов' }
    Write-Ok 'tsc чисто'

    npm test -- --run
    if ($LASTEXITCODE -ne 0) { Fail 'тесты красные' }
    Write-Ok 'тесты зелёные'
} else {
    Write-Host 'Проверки пропущены (-SkipChecks)' -ForegroundColor Yellow
}

Write-Step 'Сборка'
npm run build
if ($LASTEXITCODE -ne 0) { Fail 'сборка упала' }
Write-Ok 'собралось'

if ($DryRun) {
    Write-Host "`nDryRun: всё готово, публикация пропущена." -ForegroundColor Yellow
    exit 0
}

Write-Step 'Деплой фронта на Vercel'
if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Fail 'vercel CLI не найден. Установи: npm i -g vercel, затем vercel login (входи по email, не через GitHub)'
}
vercel --prod
if ($LASTEXITCODE -ne 0) { Fail 'vercel деплой не прошёл' }
Write-Ok 'фронт задеплоен'

if ($Functions) {
    Write-Step 'Деплой edge functions'
    if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
        Fail 'supabase CLI не найден. Установи: scoop install supabase, затем supabase login'
    }
    foreach ($fn in @('ai-chat', 'movie-recommendation')) {
        supabase functions deploy $fn --project-ref $ProjectRef
        if ($LASTEXITCODE -ne 0) { Fail "не задеплоилась функция $fn" }
        Write-Ok "$fn задеплоена"
    }
}

Write-Host "`nГотово." -ForegroundColor Green
Write-Host 'На телефоне обнови страницу с очисткой кеша — если приложение стоит как иконка, закрой и открой заново.' -ForegroundColor DarkGray
if (-not $Functions) {
    Write-Host 'Edge functions не трогали. Если менялись supabase/functions/** — перезапусти с ключом -Functions.' -ForegroundColor DarkGray
}
