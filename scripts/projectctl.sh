#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

WIN_DOWNLOADS="${WIN_DOWNLOADS:-/mnt/c/Users/user/Downloads}"
PROJECTS_ROOT="${PROJECTS_ROOT:-$REPO_ROOT/projects}"
VIEWPORT_WIDTH="${VIEWPORT_WIDTH:-1080}"
VIEWPORT_HEIGHT="${VIEWPORT_HEIGHT:-1350}"
WAIT_MS="${WAIT_MS:-700}"

usage() {
  cat <<EOF
Usage:
  $(basename "$0") prepare <project-name> [--single] [--empty]
  $(basename "$0") export <project-name> [--first]
  $(basename "$0") export-all
  $(basename "$0") doctor
  $(basename "$0") help

Examples:
  ./scripts/projectctl.sh prepare framex
  ./scripts/projectctl.sh prepare poster1 --single
  ./scripts/projectctl.sh prepare draft-post --empty
  ./scripts/projectctl.sh export framex
  ./scripts/projectctl.sh export poster1 --first
EOF
}


log()  { echo "[$(date +'%H:%M:%S')] $*"; }
warn() { echo "⚠️  $*" >&2; }
die()  { echo "❌ $*" >&2; exit 1; }

sanitize_name() {
  echo "$1" \
    | sed 's#[<>:"/\\|?*]#-#g' \
    | sed 's/^[[:space:]]\+//' \
    | sed 's/[[:space:]]\+$//'
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

ensure_node() {
  require_cmd node
  require_cmd npm
}

ensure_root_package() {
  cd "$REPO_ROOT"

  if [[ ! -f package.json ]]; then
    log "package.json not found in repo root. Creating one..."
    npm init -y >/dev/null 2>&1
  fi

  if [[ ! -d "$REPO_ROOT/node_modules/playwright" ]]; then
    log "Installing Playwright in repo root..."
    npm install -D playwright
  fi
}

ensure_browser() {
  cd "$REPO_ROOT"

  if [[ ! -d "$HOME/.cache/ms-playwright" ]]; then
    log "Installing Chromium for Playwright..."
    npx playwright install chromium
  fi
}

project_dir() {
  echo "$PROJECTS_ROOT/$1"
}

get_slide_num() {
  local base
  base="$(basename "$1")"

  if [[ "$base" =~ ^preview\.html$ ]]; then
    echo 1
    return
  fi

  if [[ "$base" =~ ^preview\ \(([0-9]+)\)\.html$ ]]; then
    echo $(( ${BASH_REMATCH[1]} + 1 ))
    return
  fi

  if [[ "$base" =~ ^slide([0-9]+)\.html$ ]]; then
    echo "${BASH_REMATCH[1]}"
    return
  fi

  echo 9999
}

ensure_export_script() {
  local pdir="$1"
  local script_path="$pdir/export-all.js"

  cat > "$script_path" <<EOF
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const VIEWPORT_WIDTH = parseInt(process.env.VIEWPORT_WIDTH || '${VIEWPORT_WIDTH}', 10);
const VIEWPORT_HEIGHT = parseInt(process.env.VIEWPORT_HEIGHT || '${VIEWPORT_HEIGHT}', 10);
const WAIT_MS = parseInt(process.env.WAIT_MS || '${WAIT_MS}', 10);
const EXPORT_FIRST_ONLY = process.env.EXPORT_FIRST_ONLY === '1';

function getSlideNumber(filename) {
  const match = filename.match(/^slide(\\d+)\\.html\$/i);
  return match ? parseInt(match[1], 10) : 9999;
}

(async () => {
  const projectDir = __dirname;
  const htmlDir = path.join(projectDir, 'html');
  const pngDir = path.join(projectDir, 'png');

  if (!fs.existsSync(htmlDir)) {
    console.error('HTML folder not found:', htmlDir);
    process.exit(1);
  }

  fs.mkdirSync(pngDir, { recursive: true });

  let htmlFiles = fs
    .readdirSync(htmlDir)
    .filter(file => /^slide\\d+\\.html\$/i.test(file))
    .sort((a, b) => getSlideNumber(a) - getSlideNumber(b));

  if (htmlFiles.length === 0) {
    console.error('No slide HTML files found in html folder.');
    process.exit(1);
  }

  if (EXPORT_FIRST_ONLY) {
    htmlFiles = [htmlFiles[0]];
  }

  const browser = await chromium.launch({ headless: true });

  for (const file of htmlFiles) {
    const page = await browser.newPage({
      viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }
    });

    try {
      const filePath = 'file://' + path.join(htmlDir, file);
      const outputName = file.replace(/\\.html\$/i, '.png');

      await page.goto(filePath, { waitUntil: 'load' });
      await page.emulateMedia({ media: 'screen' });

      await page.evaluate(async () => {
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
      });

      await page.waitForTimeout(WAIT_MS);

      const slide = page.locator('.slide');

      if (await slide.count()) {
        await slide.first().screenshot({
          path: path.join(pngDir, outputName)
        });
      } else {
        await page.screenshot({
          path: path.join(pngDir, outputName),
          fullPage: false
        });
      }

      console.log(\`✅ Exported: \${file} -> png/\${outputName}\`);
    } catch (error) {
      console.error(\`❌ Failed: \${file}\`);
      console.error(error.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log('🎉 Done.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
EOF
}

cmd_prepare() {
  local name="${1:-}"
  shift || true

  [[ -z "$name" ]] && read -rp "Enter project name: " name
  [[ -z "$name" ]] && die "Project name is required."

  local single_mode=false
  local empty_mode=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --single) single_mode=true ;;
      --empty)  empty_mode=true ;;
      *) die "Unknown option for prepare: $1" ;;
    esac
    shift
  done

  if $single_mode && $empty_mode; then
    die "Use either --single or --empty, not both."
  fi

  name="$(sanitize_name "$name")"
  [[ -z "$name" ]] && name="project"

  local pdir
  pdir="$(project_dir "$name")"

  if [[ -e "$pdir" ]]; then
    local n=2
    while [[ -e "${pdir}-$n" ]]; do
      ((n++))
    done
    pdir="${pdir}-$n"
  fi

  local html_dir="$pdir/html"
  local png_dir="$pdir/png"

  mkdir -p "$html_dir" "$png_dir"
  ensure_export_script "$pdir"

  log "Creating project: $pdir"

  if $empty_mode; then
    echo "Created empty project structure only."
    echo
    echo "✅ Project ready"
    echo "Project: $pdir"
    echo "HTML   : $html_dir"
    echo "PNG    : $png_dir"
    return 0
  fi

  shopt -s nullglob
  local files=(
    "$WIN_DOWNLOADS"/preview.html
    "$WIN_DOWNLOADS"/preview\ \(*\).html
    "$WIN_DOWNLOADS"/slide*.html
  )
  shopt -u nullglob

  [[ ${#files[@]} -eq 0 ]] && die "No HTML files found in $WIN_DOWNLOADS (or use --empty)"

  if $single_mode; then
    local chosen_file=""
    local best_num=9999
    local f

    for f in "${files[@]}"; do
      local num
      num="$(get_slide_num "$f")"
      [[ "$num" == "9999" ]] && continue

      if (( num < best_num )); then
        best_num="$num"
        chosen_file="$f"
      fi
    done

    [[ -z "$chosen_file" ]] && die "No valid HTML file found for single mode."

    local dest="$html_dir/slide1.html"
    mv "$chosen_file" "$dest"
    echo "Moved(single): $(basename "$chosen_file") -> html/slide1.html"
  else
    local f
    for f in "${files[@]}"; do
      local num
      num="$(get_slide_num "$f")"
      [[ "$num" == "9999" ]] && continue

      local dest="$html_dir/slide${num}.html"
      mv "$f" "$dest"
      echo "Moved: $(basename "$f") -> html/$(basename "$dest")"
    done
  fi

  echo
  echo "✅ Project ready"
  echo "Project: $pdir"
  echo "HTML   : $html_dir"
  echo "PNG    : $png_dir"
}

cmd_export() {
  local name="${1:-}"
  local mode="${2:-}"

  [[ -z "$name" ]] && read -rp "Enter project name to export: " name
  [[ -z "$name" ]] && die "Project name is required."

  local first_only=0
  [[ "$mode" == "--first" ]] && first_only=1

  local pdir
  pdir="$(project_dir "$name")"
  local html_dir="$pdir/html"
  local png_dir="$pdir/png"

  [[ -d "$pdir" ]] || die "Project folder not found: $pdir"
  [[ -d "$html_dir" ]] || die "HTML folder not found: $html_dir"

  mkdir -p "$png_dir"

  ensure_node
  ensure_root_package
  ensure_browser
  ensure_export_script "$pdir"

  log "Exporting project: $name"

  (
    cd "$REPO_ROOT"
    VIEWPORT_WIDTH="$VIEWPORT_WIDTH" \
    VIEWPORT_HEIGHT="$VIEWPORT_HEIGHT" \
    WAIT_MS="$WAIT_MS" \
    EXPORT_FIRST_ONLY="$first_only" \
    node "$pdir/export-all.js"
  )

  echo
  echo "✅ Export finished"
  echo "PNG folder: $png_dir"
}

cmd_export_all() {
  [[ -d "$PROJECTS_ROOT" ]] || die "Projects root not found: $PROJECTS_ROOT"

  ensure_node
  ensure_root_package
  ensure_browser

  shopt -s nullglob
  local dirs=("$PROJECTS_ROOT"/*)
  shopt -u nullglob

  local count=0
  local ok=0
  local fail=0

  for d in "${dirs[@]}"; do
    [[ -d "$d" ]] || continue
    local name
    name="$(basename "$d")"

    if [[ ! -d "$d/html" ]]; then
      warn "Skipping $name (no html folder)"
      continue
    fi

    ((count+=1))
    echo
    echo "========================================"
    echo "🚀 Exporting: $name"
    echo "========================================"

    if cmd_export "$name"; then
      ((ok+=1))
    else
      ((fail+=1))
      warn "Failed: $name"
    fi
  done

  echo
  echo "========================================"
  echo "📊 Summary"
  echo "Projects processed: $count"
  echo "Success          : $ok"
  echo "Failed           : $fail"
  echo "========================================"
}

cmd_doctor() {
  echo "Repo root      : $REPO_ROOT"
  echo "Projects root  : $PROJECTS_ROOT"
  echo "Downloads      : $WIN_DOWNLOADS"
  echo "Viewport       : ${VIEWPORT_WIDTH}x${VIEWPORT_HEIGHT}"
  echo "Wait ms        : $WAIT_MS"
  echo

  command -v node >/dev/null 2>&1 && echo "✅ node: $(node -v)" || echo "❌ node not found"
  command -v npm >/dev/null 2>&1 && echo "✅ npm : $(npm -v)" || echo "❌ npm not found"

  if [[ -f "$REPO_ROOT/package.json" ]]; then
    echo "✅ package.json exists in repo root"
  else
    echo "⚠️  package.json missing in repo root"
  fi

  if [[ -d "$REPO_ROOT/node_modules/playwright" ]]; then
    echo "✅ playwright installed in repo root"
  else
    echo "⚠️  playwright not installed in repo root"
  fi

  if [[ -d "$PROJECTS_ROOT" ]]; then
    echo "✅ projects folder exists"
  else
    echo "❌ projects folder missing"
  fi

  if [[ -d "$WIN_DOWNLOADS" ]]; then
    echo "✅ downloads path exists"
  else
    echo "❌ downloads path missing"
  fi
}

main() {
  local cmd="${1:-help}"
  shift || true

  case "$cmd" in
    prepare)    cmd_prepare "$@" ;;
    export)     cmd_export "$@" ;;
    export-all) cmd_export_all "$@" ;;
    doctor)     cmd_doctor "$@" ;;
    help|-h|--help) usage ;;
    *) die "Unknown command: $cmd" ;;
  esac
}

main "$@"