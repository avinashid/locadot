# 🔐 locadot

Secure your local development environment with **HTTPS** and **custom domains** like `https://local.dev`, powered by `mkcert`.

---

## ✨ Features

- ✅ Automatically generates **trusted local SSL certificates**
- 🔁 Reverse proxies `https://your.custom.domain` → `localhost:<port>`
- 🧠 Smart check for local domain mapping (127.0.0.1, 0.0.0.0, ::1, and more)
- 🖥️ Works on **Windows**, **macOS**, and **Linux**
- 🛠️ OS-specific guidance for host setup
- ⚠️ Warns and exits if domain isn’t correctly mapped to a local IP

---

## 🚀 Usage

```bash
npx locadot --host local.dev --port 3350
