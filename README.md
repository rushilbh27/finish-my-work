<p align="center">
  <a href="https://rushilbh27.github.io/finish-my-work/">
    <img src="assets/banner.png" alt="Finish My Work Banner" width="100%" />
  </a>
</p>

<p align="center">
  <a href="https://rushilbh27.github.io/finish-my-work/">
    <img src="https://img.shields.io/badge/LIVE%20WEBSITE-rushilbh27.github.io%2Ffinish--my--work-2563eb?style=for-the-badge&labelColor=0f172a" alt="Live Website" />
  </a>
  &nbsp;
  <a href="https://github.com/rushilbh27/finish-my-work/stargazers">
    <img src="https://img.shields.io/github/stars/rushilbh27/finish-my-work?style=for-the-badge&color=facc15&labelColor=0f172a" alt="GitHub Stars" />
  </a>
  &nbsp;
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge&labelColor=0f172a" alt="MIT License" />
  &nbsp;
  <img src="https://img.shields.io/badge/Manifest-V3-10b981?style=for-the-badge&labelColor=0f172a" alt="Manifest V3" />
</p>

---

## ⚡ What is Finish My Work?

**Finish My Work** is an open-source, neo-brutalist Chrome extension that autonomously solves assignments, quizzes, and assessments across university platforms.

🌐 **Landing Page & Live Demo:** [rushilbh27.github.io/finish-my-work](https://rushilbh27.github.io/finish-my-work/)

Whether your institution runs **Moodle**, **Canvas**, **Blackboard**, **Google Forms**, or the **IITM Online Degree Portal** (`seek.onlinedegree.iitm.ac.in`), Finish My Work detects questions on screen, reasons over choices using multi-engine AI, advances paginated quizzes, and completes homework without manual babysitting.

---

## 📸 Surfaces & Neo-Brutalist System

The interface is engineered around an uncompromised Neo-Brutalist design language: thick 2.5–3px ink borders, hard unblurred offset block shadows, tactile press-down buttons, zero external webfonts, and zero remote tracking scripts.

<p align="center">
  <img src="assets/landing-desktop.png" alt="Finish My Work Landing Page Preview" width="100%" />
</p>

### 1. Toolbar Popup (`popup/`) & 2. In-Page Floating HUD (`content/`)

<table width="100%">
  <tr>
    <td width="35%" align="center" valign="top">
      <strong>Toolbar Popup</strong><br/><br/>
      <img src="assets/popup-main.png" alt="Finish My Work Toolbar Popup" width="100%" />
    </td>
    <td width="65%" align="center" valign="top">
      <strong>In-Page Floating HUD (Dark Mode Host)</strong><br/><br/>
      <img src="assets/floating-module-dark.png" alt="Finish My Work In-Page HUD Dark Page" width="100%" />
      <br/><br/>
      <strong>In-Page Floating HUD (Light Mode Host)</strong><br/><br/>
      <img src="assets/floating-module-light.png" alt="Finish My Work In-Page HUD Light Page" width="100%" />
    </td>
  </tr>
</table>

- **1. Toolbar Popup (`popup/`)**: High-visibility status stamp, dominant primary Auto-Pilot hero action, agent mode dropdown, and a technical configuration drawer.
- **2. In-Page Floating HUD (`content/`)**: Dual-contrast borders and shadows (`4px 4px 0 #0f172a, 0 0 0 2px #fff`) optimized for both light and dark host pages, draggable header, stealth mode (<kbd>⌘⇧H</kbd>), and collapsible corner sticker tab (`[— FMW]`).
- **3. Landing Page (`index.html`)**: Complete standalone website with live interactive in-browser quiz simulation, bento grid, and terminal installation snippet.

---

## 🚀 The 4 Autopilot Modes

| Mode | Behavior | Ideal Use Case |
| :--- | :--- | :--- |
| **01. Draft Only** | Solves questions and marks choices silently without pressing the final submit button. | When you want to double-check answers yourself before final submission. |
| **02. Full Submit** | Solves all questions, advances paginated pages, confirms submission dialogs, and lands on review. | Turning in a single quiz or homework completely autonomously. |
| **03. Course Batch** | Automatically navigates and solves all assignments and quizzes within the current course. | Clearing an entire subject's backlog in one sitting. |
| **04. All Courses** | Sweeps across all enrolled courses on your dashboard, automatically skipping practice tests and only completing **Graded** assignments. | End-of-semester autonomous completion across all subjects. |

---

## 🤖 AI Engines Supported

- ✦ **Built-in Free AI**: Zero keys or setup required. Automatically manages 30s cooldowns so questions are never dropped.
- ⚡ **Groq Cloud (Recommended)**: Sub-second reasoning via `llama-3.3-70b-versatile` with zero wait time. Free keys at [console.groq.com](https://console.groq.com/keys).
- 🔑 **Google Gemini**: Full multimodal vision support for circuit diagrams, geometry, and schematics via [Google AI Studio](https://aistudio.google.com/app/apikey).
- 🌐 **OpenRouter**: Connect DeepSeek R1, Claude, or GPT-4o via your [OpenRouter](https://openrouter.ai/keys) key.

---

## ⌨️ Keyboard Shortcuts

| Shortcut (Mac) | Shortcut (Windows/Linux) | Action |
| :--- | :--- | :--- |
| <kbd>⌘⇧S</kbd> | <kbd>Ctrl+Shift+S</kbd> | **Solve Current Question** |
| <kbd>⌘⇧A</kbd> | <kbd>Ctrl+Shift+A</kbd> | **Start / Stop Auto-Pilot** |
| <kbd>⌘⇧H</kbd> | <kbd>Ctrl+Shift+H</kbd> | **Stealth Mode** (Toggle on-screen HUD visibility) |
| <kbd>Esc</kbd> | <kbd>Esc</kbd> | **Minimize HUD** to corner tab |

---

## 🛠️ Installation in 60 Seconds

1. Clone or download this repository:
   ```bash
   git clone https://github.com/rushilbh27/finish-my-work.git
   ```
2. Open Google Chrome (or Edge, Brave, Arc, Opera).
3. Navigate to `chrome://extensions` in the address bar.
4. Enable the **"Developer mode"** toggle in the top-right corner.
5. Click **"Load unpacked"** and select the `finish-my-work` directory.
6. Open your quiz page and press <kbd>⌘⇧S</kbd> or <kbd>⌘⇧A</kbd>.

---

## 🔒 Privacy & Architecture

- **100% Client-Side**: All DOM parsing and API calls happen directly inside your browser extension context.
- **Zero Telemetry**: No third-party analytics, tracking pixels, or external trackers.
- **Encrypted Local Storage**: API keys are saved exclusively in your browser's private `chrome.storage.local`.

---

## 📄 License

Licensed under the [MIT License](LICENSE).
