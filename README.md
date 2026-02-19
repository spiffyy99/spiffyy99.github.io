# spiffyy99.github.io

Multi-project GitHub Pages site hosting various projects.

## Projects

- **Music Theory App** - `/music` - Interactive music theory learning tool

## Deployment

### Quick Deploy (Music Project)
```powershell
.\deploy.ps1
```

### Deploy All Projects
```powershell
.\deploy-all.ps1
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions on adding new projects.

## Setup

1. Install Node.js (includes npm)
2. Install dependencies: `npm install`
3. Build and deploy: `.\deploy.ps1`

## GitHub Pages

Configured to serve from the root directory. Each project is available at:
- `https://spiffyy99.github.io/music/`
- `https://spiffyy99.github.io/[project-name]/`