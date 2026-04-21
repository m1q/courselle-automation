# Migration Guide: Old Shell Scripts to New CLI

This guide helps you transition from the old shell scripts (`projectctl.sh`, `export-all-projects.js`, etc.) to the new unified CLI.

## Why Migrate?

The new CLI offers several advantages:

- **Unified interface**: One command (`courselle`) for all operations
- **Better error handling**: Individual slide failures don't stop entire export
- **Project manifests**: Each project has a `courselle.json` file with metadata
- **Health checks**: `doctor` command validates system and project health
- **Backward compatibility**: Old scripts continue to work

## Migration Steps

### Step 1: Install Dependencies

Ensure you have the latest version of the project:

```bash
cd courselle-automation
npm install
```

### Step 2: Migrate Existing Projects

Migrate all your existing projects to the new structure:

```bash
# Dry run first (see what will happen)
npx courselle migrate --all --dry-run

# Actually migrate
npx courselle migrate --all
```

This will:
- Create a `courselle.json` manifest for each project
- Update the legacy `export-all.js` script (if needed)
- Create a `README.md` with migration info

### Step 3: Verify Migration

Check that everything migrated correctly:

```bash
npx courselle doctor --verbose
```

Look for:
- ✅ All projects have manifests
- ✅ HTML slide counts match expectations
- ✅ System dependencies are installed

### Step 4: Test the New CLI

Test with a single project:

```bash
# Export a project using the new CLI
npx courselle export 7-hapit

# Compare with legacy export
cd projects/7-hapit
node export-all.js
```

The output PNGs should be identical.

## Command Mapping

| Old Command | New CLI Equivalent |
|-------------|-------------------|
| `./scripts/projectctl.sh prepare <name>` | `npx courselle prepare <name>` |
| `./scripts/projectctl.sh prepare <name> --single` | `npx courselle prepare <name> --single` |
| `./scripts/projectctl.sh export <name>` | `npx courselle export <name>` |
| `./scripts/projectctl.sh export <name> --first` | `npx courselle export <name> --first` |
| `./scripts/projectctl.sh export-all` | `npx courselle export-all` |
| `./scripts/projectctl.sh doctor` | `npx courselle doctor` |
| `node scripts/export-all-projects.js` | `npx courselle export-all` |
| `cd projects/<name> && node export-all.js` | `npx courselle export <name>` |

## Configuration Changes

### Old: Environment Variables in Shell Scripts

Previously, you might have set variables in `projectctl.sh` or export scripts.

### New: Multiple Configuration Layers

1. **Project manifest** (`courselle.json`): Project-specific settings
2. **Environment variables**: Override defaults
3. **CLI options**: Command-specific overrides

**Example transition:**

Old way:
```bash
export VIEWPORT_WIDTH=1200
./scripts/projectctl.sh export my-project
```

New ways (choose one):
```bash
# Option 1: Environment variable (same as before)
export VIEWPORT_WIDTH=1200
npx courselle export my-project

# Option 2: Project manifest (edit projects/my-project/courselle.json)
# Change "config.viewport.width" to 1200

# Option 3: Modify the generated export-all.js (legacy compatibility)
```

## FAQ

### Will my existing workflows break?

**No.** The old scripts continue to work exactly as before. You can migrate at your own pace.

### Do I need to modify my HTML slides?

**No.** The export process is identical. Slides should still use `.slide` class for optimal cropping.

### What about my existing PNG files?

Migration doesn't touch PNG files. They remain in the `png/` folders.

### Can I use both old and new systems simultaneously?

**Yes.** The systems are independent. You can use `projectctl.sh` for some tasks and `courselle` for others.

### What happens to my custom export-all.js scripts?

The `migrate` command only updates `export-all.js` if it doesn't exist or you use `--force`. Your customizations are preserved by default.

## Troubleshooting Migration

### "Project already has a manifest"

If a project already has `courselle.json`, migration skips it unless you use `--force`:

```bash
npx courselle migrate --all --force
```

### "No HTML files found in html/ folder"

Projects without HTML slides are skipped during migration (and during export). This is normal for template projects.

### "Windows Downloads path not found"

The CLI uses the same `WIN_DOWNLOADS` environment variable as the old scripts. Set it if needed:

```bash
export WIN_DOWNLOADS="/mnt/c/Users/YourUsername/Downloads"
```

## Next Steps After Migration

1. **Update your scripts** to use the new CLI commands
2. **Set up project-specific configurations** in `courselle.json` files
3. **Use the doctor command** regularly to monitor system health
4. **Explore advanced features** like batch export with `--first` flag

## Getting Help

- View CLI help: `npx courselle --help`
- Check system health: `npx courselle doctor --verbose`
- Refer to the [CLI Usage Guide](./CLI_USAGE.md) for detailed examples