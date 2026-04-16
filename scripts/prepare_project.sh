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

shopt -s nullglob
files=("$WIN_DOWNLOADS"/preview.html "$WIN_DOWNLOADS"/preview\ \(*\).html "$WIN_DOWNLOADS"/slide*.html)
shopt -u nullglob

if [[ ${#files[@]} -eq 0 ]]; then
  echo "No HTML files found in $WIN_DOWNLOADS"
  echo "Expected files like: preview.html, preview (1).html, preview (2).html ..."
  exit 1
fi

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

echo "Creating project:"
echo "$PROJECT_DIR"
echo

for f in "${files[@]}"; do
  num="$(get_slide_num "$f")"
  [[ "$num" == "9999" ]] && continue

  dest="$HTML_DIR/slide${num}.html"
  mv "$f" "$dest"
  echo "Moved: $(basename "$f") -> html/$(basename "$dest")"
done

echo
echo "Done."
echo "Project: $PROJECT_DIR"
echo "HTML   : $HTML_DIR"
echo "PNG    : $PNG_DIR"
