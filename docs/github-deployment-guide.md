# GitHub Deployment Guide for Local Linux VMs

This guide explains how to deploy a GitHub-hosted project to a local Linux VM using GitHub Actions and self-hosted runners. It covers new and existing runners, environments, Docker usage, Nginx setups (fresh or already running), and rollback strategies. Use it as a template for any repo.

## 1) Deployment model

- **Source of truth:** GitHub repo (commits, tags, releases)
- **Deploy target:** Local VM (e.g., `/opt/<app>`)
- **CI/CD:** GitHub Actions builds and deploys via a self-hosted runner on the VM
- **Runtime:** System services (systemd), Docker services (e.g., Postgres), and Nginx for reverse proxy

## 2) Repo as version + file storage

- Deploy a specific commit SHA or tag. The repo is the release artifact.
- Keep build outputs on the VM (`dist/`, venvs, etc.). Avoid committing them.
- Use tags for stable releases:
  ```bash
  git tag -a v1.2.3 -m "release v1.2.3"
  git push --tags
  ```

## 3) Environment separation

Use environment-specific files on the VM and keep them out of Git:

- **Local dev:** `.env.local`, `.env.development`, etc.
- **Production VM:** `.env`, `.env.production`
- **GitHub Actions:** use repository secrets to render these files at deploy time

Example layout:
```
/opt/<app>/backend/.env
/opt/<app>/frontend/.env.production
```

## 4) Self-hosted runners

### A) New runner (recommended)
Use a dedicated runner for this repo so it is always available.

1) Create directory:
```bash
sudo mkdir -p /opt/actions-runner-<app>
sudo chown -R <user>:<user> /opt/actions-runner-<app>
cd /opt/actions-runner-<app>
```

2) Download and extract:
```bash
curl -o actions-runner.tar.gz -L https://github.com/actions/runner/releases/latest/download/actions-runner-linux-x64-2.321.0.tar.gz
tar xzf actions-runner.tar.gz
```

3) Configure with label and name:
```bash
./config.sh --url https://github.com/<org>/<repo> --token <TOKEN> --labels <app> --name <vm-name>
```

4) Install as a service:
```bash
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
```

### B) Existing runner
If the VM already has a **repo-level** runner, it can only run workflows for that repo. You must register a new runner for this repo.

If the existing runner is **org-level**, add this repo and reuse it. Update the workflow to target labels:
```yaml
runs-on: [self-hosted, <app>]
```

## 5) CI/CD pipeline (GitHub Actions)

Typical jobs:

1) **Test/build** (hosted runner)
   - install deps
   - run tests
   - build frontend

2) **Deploy** (self-hosted runner)
   - pull repo to `/opt/<app>`
   - write env files from GitHub secrets
   - build frontend on VM
   - install backend deps
   - restart service

Example deploy steps:
```yaml
deploy:
  runs-on: [self-hosted, <app>]
  needs: test
  if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
  steps:
    - name: Ensure repo at /opt/<app>
      run: |
        if [ -d /opt/<app>/.git ]; then
          git -C /opt/<app> fetch --prune
          git -C /opt/<app> checkout main
          git -C /opt/<app> pull --ff-only
        else
          git clone https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git /opt/<app>
        fi

    - name: Write backend env
      run: |
        cat > /opt/<app>/backend/.env <<'EOF'
        DATABASE_URL="${{ secrets.APP_DATABASE_URL }}"
        ENVIRONMENT="production"
        EOF

    - name: Write frontend env
      run: |
        cat > /opt/<app>/frontend/.env.production <<'EOF'
        VITE_API_URL=${{ secrets.APP_API_URL }}
        EOF

    - name: Build frontend
      run: |
        cd /opt/<app>/frontend
        npm ci
        npm run build

    - name: Restart API
      run: sudo systemctl restart <app>-api
```

## 6) Secrets + environment variables

Store secrets in **GitHub → Settings → Secrets and variables → Actions**.

Example secrets:
- `APP_DATABASE_URL`
- `APP_API_URL`
- `APP_WEBHOOK_URL`

Avoid committing `.env` files. Use `.env.example` for documentation.

## 7) Docker services (Postgres, etc.)

### A) Fresh Docker setup
If the VM has no conflicting containers:
```bash
cd /opt/<app>
docker compose up -d
```

### B) Existing containers present
- Avoid port conflicts (e.g., 5432 already in use)
- If needed, map a different host port:
```yaml
ports:
  - "5433:5432"
```
- Update `DATABASE_URL` accordingly.

### C) Where to place compose files
Keep service-specific compose files **inside the app directory** so deployments are scoped to the project:
```
/opt/<app>/docker-compose.yml
```

## 8) Nginx setup

### A) Existing Nginx
Find the active server block:
```bash
sudo nginx -T | grep -n "server_name"
```
Add new locations **before** a catch-all `location / {}`:
```
location /<app>-api/ { proxy_pass http://localhost:8010/api/; }
location /<app>/ { alias /opt/<app>/frontend/dist/; try_files $uri $uri/ /<app>/index.html; }
```
Reload:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### B) Fresh Nginx
Create a site file in `/etc/nginx/sites-available/<app>` and enable it:
```bash
sudo ln -s /etc/nginx/sites-available/<app> /etc/nginx/sites-enabled/<app>
sudo nginx -t && sudo systemctl reload nginx
```

## 9) Systemd service

Create a unit file such as `/etc/systemd/system/<app>-api.service`:
```
[Unit]
Description=<App> API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/<app>/backend
EnvironmentFile=/opt/<app>/backend/.env
ExecStart=/opt/<app>/backend/.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now <app>-api
```

## 10) Permissions for CI/CD

If the runner user cannot restart services, allow a **limited sudo** command:
```
echo "<user> ALL=NOPASSWD: /bin/systemctl restart <app>-api" | sudo tee /etc/sudoers.d/<app>-api-restart
sudo chmod 440 /etc/sudoers.d/<app>-api-restart
```

## 11) Rollback

### A) Reset to a previous commit on the VM
```bash
sudo systemctl stop <app>-api
git -C /opt/<app> reset --hard <GOOD_SHA>
cd /opt/<app>/frontend && npm ci && npm run build
sudo systemctl start <app>-api
```

### B) Git revert and redeploy
```bash
git revert <BAD_SHA>
git push
```

## 12) Verification checklist

- `docker compose ps` shows required containers running
- `systemctl status <app>-api` is active
- API reachable: `curl http://localhost:8010/api/health`
- UI reachable in browser via Nginx

---

Use this guide as a base. Adjust ports, paths, and secrets to match your project.
