# VisionVault: Spatial Memory Assistant

VisionVault is a Gemini-powered multimodal intelligence layer for physical assets. It acts as an external memory system, extracting structured, forensic data (like hardware branding, marks/dents, and view invariance) from objects and placing them into a semantic, searchable digital ledger.

> **"Converting physical reality into structured, identity-aware metadata."**

## 🏗️ System Architecture
This project evolved from a rapid Python/Streamlit prototype into a decoupled, production-ready system with a flat React frontend and an isolated AI backend.

* **`/` (Root)**: The React frontend. Handles complex state management, real-time UI syncing, high-speed fuzzy search, and the forensic metadata display panel.
* **`/visionvault-core`**: The FastAPI backend engine. Houses the dual-agent AI pipeline (Identity Extraction + Spatial Mapping) running via `asyncio`, semantic search engines, and the atomic local-first JSON persistence layer.
* **`/archive/v1-streamlit-prototype`**: The original monolithic Python MVP built during the Hackdays Hackathon.

## 🚀 Core Capabilities
1. **Dual-Agent Parallel Pipeline:** Uses Gemini Multimodal AI to execute OCR identity extraction and spatial mapping simultaneously, ignoring background distractions to strictly isolate the target hardware.
2. **Forensic Information Extraction:** Analyzes physical geometry (view invariance) and unique identifiers (marks, dents, specs) rather than relying on generic image tags.
3. **Dual-Engine Search:** Features a lightning-fast local fuzzy search for exact text matches, backed by a deep semantic search engine for conceptual lookups.
4. **Local-First Persistence:** Crash-resilient memory records using atomic saves to a local `memory.json` ledger.

## 💻 Tech Stack
* **AI/Vision Engine:** Google Gemini
* **Backend:** Python, FastAPI, Asyncio
* **Frontend:** React.js
* **Storage Engine:** Local JSON File I/O 

## ⚙️ Execution Instructions

**1. Clone the repository**
\`\`\`bash
git clone https://github.com/originalzerodev/visionvault.git
cd visionvault
\`\`\`

**2. Boot the AI Backend Engine**
Open a terminal and start the API server:
\`\`\`bash
cd visionvault-core
pip install -r requirements.txt
# Ensure your GEMINI_API_KEY is configured in your environment
python app.py
\`\`\`

**3. Boot the Frontend Interface**
Open a **new** terminal in the root directory:
\`\`\`bash
npm install
npm start
\`\`\`
