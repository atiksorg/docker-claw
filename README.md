# Docker-Claw

[![GitHub Repo](https://img.shields.io/badge/GitHub-docker--claw-blue?logo=github)](https://github.com/atiksorg/docker-claw)
[![Node.js](https://img.shields.io/badge/Node.js-v18-green?logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

**AI-Powered Bash Executor in Docker Containers** with Web UI, Telegram Bot, Email Integration, PostgreSQL Persistence, and AI Routing.

Docker-Claw allows users to run bash commands in isolated Docker environments, managed via a modern web dashboard or Telegram bot. AI assists in command generation, execution, and file management. Perfect for developers, AI agents, and remote environment control.

## 🚀 Features

- **Web Dashboard**: Manage sessions, files, AI prompts, channels (Telegram, Email), tasks, skills, apps.
- **Telegram Bot**: Full control via bot – execute commands, AI chat, file send/receive, status checks.
- **ProTalk Router**: Advanced LLM (configurable model/token) processes natural language into bash commands with full context awareness and multi-turn conversational support, integrated with Telegram bot and web UI.
- **Docker Sandboxes**: Per-user isolated containers with persistent `/workspace`.
- **PostgreSQL Backend**: Sessions, balances, snapshots, plans, user data.
- **File Management**: Upload/download, snapshots, diffs.
- **Channels**: Telegram + Email (IMAP/Nodemailer) processing.
- **Balance & Plans**: Token usage tracking, subscription-like model.
- **AI Tools**: Custom tools for execution, planning, deps management.

## 📦 Quick Start (Development)

1. **Clone & Install**
   ```bash
   git clone https://github.com/atiksorg/docker-claw.git
   cd docker-claw
   npm install
   ```

2. **Environment Setup**
   Copy `config.js` or create `.env`:
   ```
   DATABASE_URL=postgresql://user:pass@localhost:5432/docker_claw
   DATA_ROOT=./data
   # Docker host config if needed
   DOCKER_HOST=unix:///var/run/docker.sock
   # AI tokens
   OPENAI_API_KEY=your_key
   ```

3. **Database**
   - Install PostgreSQL.
   - Run migrations (if any) or init via services/postgres.service.js.

4. **Run**
   ```bash
   npm start  # Production
   npm run dev  # Nodemon
   ```

5. **Access**
   - Web: http://localhost:3000
   - Setup Telegram bot token in UI (Channels → Telegram).

## 🏗️ Project Structure

```
docker-claw/
├── public/              # Frontend (HTML/JS/CSS)
│   ├── ai.html          # AI Router setup
│   ├── chat.html        # Chat interface
│   ├── console.html     # Bash console
│   ├── files.html       # File manager
│   └── ...              # tasks.html, skills.html, etc.
├── routes/              # Express API routes
│   ├── apps.routes.js
│   ├── database.routes.js
│   ├── execute.routes.js
│   └── ...              # session, files, webhook, etc.
├── services/            # Core services
│   ├── ai_router_service.js
│   ├── docker.service.js
│   ├── postgres.service.js
│   ├── session.service.js
│   └── ...              # balance, storage, snapshot
├── manage/              # Channel integrations
│   ├── telegram/        # Telegraf bot: runner.js, tools.js, etc.
│   ├── email/           # IMAP processor
│   ├── agentQueue.js
│   └── routes.js        # Manage API
├── server.js            # Express app entry
├── package.json         # Node.js deps: Express, PG, Telegraf, etc.
└── README.md            # This file
```

## 🔧 API Endpoints (Examples)

Base: `/api/`

- **Sessions**: `POST /session` – Create/execute command.
- **Files**: `GET /files` – List `/workspace`.
- **AI**: `POST /ai/chat` – AI Router.
- **Telegram**: `POST /manage/telegram/token` – Setup bot.
- **Webhook**: `/webhook/telegram` – Bot updates.

See `routes/` for full list.

## 🤖 Telegram Bot Usage

1. Get bot token from @BotFather.
2. Enter in UI: Channels → Telegram.
3. Message bot first → Get verification code → Enter in UI.
4. Commands: `status`, `ls`, `echo hi`, or natural language (AI mode).

AI mode: Bot uses LLM to interpret & execute.

## 📧 Email Channel

- IMAP fetch + Nodemailer send.
- `manage/email/processor.js` – Processes incoming mail as commands.

## ⚙️ Services Breakdown

| Service | Description |
|---------|-------------|
| `docker.service.js` | Manages user containers. |
| `session.service.js` | Exec commands, persist history. |
| `ai_router_service.js` | **ProTalk Router**: LLM routing with tools for conversational AI, handling natural language to bash execution. |
| `balance.service.js` | Token/usage tracking. |
| `plan.service.js` | Execution plans. |

## 🚀 Deployment

- **Docker Compose**: Add `docker-compose.yml` for prod (Postgres + App).
- **PM2/ systemd**: For Node.
- **Nginx**: Reverse proxy.
- Expose only necessary ports/DB.

## 🤝 Contributing

1. Fork & PR.
2. Follow code style (ES6+).
3. Add tests.

## 📄 License

MIT – See [LICENSE](LICENSE).

## 🙌 Support

- Issues: GitHub.
- Telegram: Setup your own bot!

---

*Built with ❤️ for AI x DevOps*

