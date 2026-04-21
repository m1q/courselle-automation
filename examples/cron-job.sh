#!/bin/bash

# Example cron job script for automating Courselle exports
# This script can be scheduled with cron to run daily, weekly, etc.

# Set working directory to the project root
cd "$(dirname "$0")/.." || exit 1

# Load environment variables (optional)
# export VIEWPORT_WIDTH=1200
# export VIEWPORT_HEIGHT=1500
# export WAIT_MS=1000

# Log file location
LOG_FILE="logs/export-$(date +%Y%m%d-%H%M%S).log"
mkdir -p logs

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Start export
log "Starting scheduled Courselle export"

# Run doctor first to check system health
log "Running system health check..."
if ! npx courselle doctor > /dev/null 2>&1; then
    log "ERROR: System health check failed. Please run 'npx courselle doctor --verbose' for details."
    exit 1
fi

# Export all projects (first slide only for quick preview)
log "Exporting first slide of all projects (preview mode)..."
if npx courselle export-all --first 2>&1 | tee -a "$LOG_FILE"; then
    log "Preview export completed successfully"
else
    log "WARNING: Preview export had some failures"
fi

# Full export of specific important projects
IMPORTANT_PROJECTS=("7-hapit" "Framex" "ads")
for project in "${IMPORTANT_PROJECTS[@]}"; do
    log "Exporting all slides of project: $project"
    if npx courselle export "$project" 2>&1 | tee -a "$LOG_FILE"; then
        log "Project $project exported successfully"
    else
        log "ERROR: Failed to export project $project"
    fi
done

# Generate summary
log "Export summary:"
npx courselle doctor --verbose 2>&1 | grep -A5 "Projects processed" | tee -a "$LOG_FILE"

log "Scheduled export completed successfully"
log "Log saved to: $LOG_FILE"