# VisionVault

> **"What if reality itself became searchable?"**

We waste time every day searching for things we just put down. Not because we're careless, but because human memory is unstructured. **VisionVault** is an AI-powered system that reduces the friction between seeing and remembering. It turns physical objects into searchable memories by capturing them, storing contextual data, and allowing recall using natural language.

Built for **Hack Days Guwahati**.

---

## ✨ How It Works (Memory Pipeline)

1. **📸 Capture:** Upload or take a photo of any object.
2. **🧠 Store:** Gemini analyzes the image, extracts the object, and generates structured metadata (description, context, timestamp, location tag).
3. **🔍 Recall:** Ask questions like *"Where did I leave my keys?"* and it retrieves the most relevant memory.

---

## 🚀 Key Features

- AI-powered object detection using Google Gemini API
- Structured JSON-based memory storage
- Smart overwrite system (prevents duplicate clutter)
- Natural language search with relevance matching
- Memory vault UI to browse stored objects
- Lightweight Streamlit interface

---

## 🛠️ Tech Stack

- **Frontend:** Streamlit  
- **AI Engine:** Google Gemini API  
- **Backend:** Python  
- **Storage:** JSON (local persistence)  
- **Image Processing:** Pillow (PIL)  

---

## 💻 Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/visionvault.git
cd visionvault
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

`requirements.txt`:
```
streamlit
google-genai
pillow
python-dotenv
```

### 3. Setup environment variables
Create a `.env` file:
```env
GEMINI_API_KEY=your_api_key_here
```

### 4. Run the app
```bash
streamlit run app.py
```

---
