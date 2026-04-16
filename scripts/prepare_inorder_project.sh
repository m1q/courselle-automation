#!/usr/bin/env bash
set -euo pipefail

WIN_DOWNLOADS="/mnt/c/Users/user/Downloads"
PROJECTS_ROOT="$HOME/content_projects"

PROJECT_NAME="${1:-}"
if [[ -z "$PROJECT_NAME" ]]; then
  read -rp "Enter project name: " PROJECT_NAME
fi

if [[ -z "$PROJECT_NAME" ]]; then
  echo "Project name is required."
  exit 1
fi

sanitize_name() {
  echo "$1" | sed 's#[<>:"/\\|?*]#-#g' | sed 's/[[:space:]]\+$//' | sed 's/^[[:space:]]\+//'
}

PROJECT_NAME="$(sanitize_name "$PROJECT_NAME")"
[[ -z "$PROJECT_NAME" ]] && PROJECT_NAME="project"

PROJECT_DIR="$PROJECTS_ROOT/$PROJECT_NAME"
if [[ -e "$PROJECT_DIR" ]]; then
  n=2
  while [[ -e "${PROJECT_DIR}-$n" ]]; do
    ((n++))
  done
  PROJECT_DIR="${PROJECT_DIR}-$n"
fi

HTML_DIR="$PROJECT_DIR/html"
PNG_DIR="$PROJECT_DIR/png"

mkdir -p "$HTML_DIR" "$PNG_DIR"

FILES_IN_ORDER=(
  "preview.html"
  "preview (3).html"
  "preview (2).html"
  "preview (4).html"
  "preview (6).html"
  "preview (8).html"
  "preview (9).html"
)

echo "Creating project:"
echo "$PROJECT_DIR"
echo

i=1
for file in "${FILES_IN_ORDER[@]}"; do
  src="$WIN_DOWNLOADS/$file"
  dest="$HTML_DIR/slide${i}.html"

  if [[ ! -f "$src" ]]; then
    echo "Missing file: $src"
    exit 1
  fi

  mv "$src" "$dest"
  echo "Moved: $file -> html/slide${i}.html"
  ((i++))
done

echo
echo "Done."
echo "Project: $PROJECT_DIR"
echo "HTML   : $HTML_DIR"
echo "PNG    : $PNG_DIR"
