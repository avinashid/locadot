# 🔐 locadot

Secure your local development environment with **HTTPS** and **custom domains** like `https://dev.localhost`, powered by `mkcert`.

---

## ✨ Features

- ✅ Automatically generates **trusted local SSL certificates**
- 🔁 Reverse proxies `https://your.custom.domain` → `app.localhost`
- 🖥️ Works on **Windows**, **macOS**, and **Linux**
- 🛠️ OS-specific guidance for host setup
- ⚠️ Warns and exits if domain isn’t correctly mapped to a local IP

---

## 🚀 Usage

```bash
npx locadot --host dev.localhost --port 3350