# Publishing Guide

This guide explains how to publish kode-acp to npm and Deno registries.

## Prerequisites

1. **GitHub Repository**: Create a GitHub repository for the project
2. **npm Account**: Create an account on [npmjs.com](https://www.npmjs.com/)
3. **Deno Account**: Create an account on [deno.land](https://deno.land/)

## Setup

### 1. Configure Git Remote

```bash
# Add your repository URL
git remote add origin https://github.com/soddygo/kode-acp.git
git push -u origin main
```

### 2. npm Setup

```bash
# Login to npm
npm login

# Verify login
npm whoami
```

### 3. Update package.json

Make sure the following fields in `package.json` are correctly set:

- `author.email`: Your actual email (currently: soddygo@example.com)
- `author.url`: Your GitHub URL (currently: https://github.com/soddygo/kode-acp)
- `repository.url`: Your repository URL (currently: git+https://github.com/soddygo/kode-acp.git)
- `bugs.url`: Your issues URL (currently: https://github.com/soddygo/kode-acp/issues)
- `homepage`: Your project homepage (currently: https://github.com/soddygo/kode-acp#readme)

## Publishing Process

### Automated Publishing (Recommended)

```bash
# Check if everything is ready
npm run publish:check

# Publish with automated script (patch version)
npm run publish:auto

# Publish with specific version type
npm run publish:auto minor
npm run publish:auto major

# Dry run (no actual publishing)
npm run publish:auto -- --dry-run
```

### Manual Publishing

1. **Update Version**
   ```bash
   # Update version in package.json
   npm version patch  # or minor, major
   ```

2. **Build and Test**
   ```bash
   npm run build
   npm run check
   ```

3. **Commit and Tag**
   ```bash
   git add package.json
   git commit -m "Release v0.1.0"
   git tag v0.1.0
   git push origin main
   git push --tags
   ```

4. **Publish to npm**
   ```bash
   npm publish
   ```

5. **Publish to Deno**
   ```bash
   deno publish --allow-scratch
   ```

## Post-Publishing

### 1. Create GitHub Release

1. Go to your repository on GitHub
2. Click "Releases"
3. "Create a new release"
4. Choose the tag you just pushed
5. Add release notes
6. Publish the release

### 2. Update Documentation

Update README.md with any new information about the release.

### 3. Test Installation

```bash
# Test npm installation
npm install -g kode-acp
kode-acp --help

# Test Deno installation
deno install --allow-read --allow-write --allow-net --allow-env --allow-run --allow-sys -n kode-acp https://deno.land/x/kode-acp/mod.ts
kode-acp --help
```

## Troubleshooting

### Common Issues

1. **npm publish fails with 403**
   - Make sure you're logged in: `npm login`
   - Check if the package name is available
   - Verify you have publish permissions

2. **Version already exists**
   - Update the version in package.json
   - Run `npm version patch/minor/major`

3. **Git working directory not clean**
   - Commit all changes
   - Make sure no untracked files exist

4. **Deno publish fails**
   - Make sure you have a deno.json file
   - Check that all required fields are filled
   - Verify your Deno account setup

### Useful Commands

```bash
# Check package info
npm info kode-acp

# Check who you're logged in as
npm whoami

# Check git status
git status

# Check remote URL
git remote -v

# List published versions
npm view kode-acp versions

# Unpublish a version (emergency only)
npm unpublish kode-acp@0.1.0
```

## Best Practices

1. **Semantic Versioning**: Follow semantic versioning (major.minor.patch)
2. **Changelog**: Maintain a changelog for releases
3. **Testing**: Always test locally before publishing
4. **Documentation**: Keep documentation up to date
5. **Security**: Use 2FA for npm and GitHub accounts

## Support

If you encounter any issues during publishing:

1. Check the [npm documentation](https://docs.npmjs.com/)
2. Check the [Deno publishing guide](https://deno.land/manual@v1.40.0/publishing)
3. Check the [JSR documentation](https://jsr.io/docs)
4. Create an issue in the [GitHub repository](https://github.com/soddygo/kode-acp/issues)