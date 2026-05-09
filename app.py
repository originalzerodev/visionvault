import streamlit as st
from google import genai
from google.genai import types 
from PIL import Image
from dotenv import load_dotenv
import os
import time
import json
from datetime import datetime
import re

# 1. INITIALIZATION & SETUP
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

st.set_page_config(page_title="VisionVault", layout="centered", page_icon="👁️")

# 🔥 CREATE IMAGE STORAGE DIRECTORY
IMG_DIR = "vault_images"
os.makedirs(IMG_DIR, exist_ok=True)

# 🔥 2. SESSION STATE
if "analysis_data" not in st.session_state:
    st.session_state.analysis_data = None
if "processed_image_id" not in st.session_state:
    st.session_state.processed_image_id = None
if "recall_response" not in st.session_state:
    st.session_state.recall_response = None
if "top_recall_memory" not in st.session_state:
    st.session_state.top_recall_memory = None

# 🧠 MOBILE CSS FIX
st.markdown("""
<style>
    header {visibility: hidden;}
    footer {visibility: hidden;}
    .block-container {
        padding-top: 2rem !important; 
        padding-bottom: 2rem !important;
    }
    .stFileUploader > div > div {
        background-color: #1e1e2e;
        border-radius: 10px;
        padding: 10px;
    }
</style>
""", unsafe_allow_html=True)

# ==========================================
# HELPER FUNCTIONS
# ==========================================
def parse_ai_json(text):
    """Safely extracts JSON from Gemini's response"""
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:-3].strip()
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:-3].strip()
    return json.loads(cleaned)

def get_memory_context():
    """Load memories. Includes secret forensics for the AI's eyes only."""
    try:
        with open("memory.json", "r") as f:
            past_memories = json.load(f)
            if not past_memories:
                return "No objects memorized yet."
            
            context_list = []
            for m in past_memories:
                desc = m.get('description', '')
                forensics = m.get('secret_forensics', 'No forensic data recorded.')
                loc = m.get('secret_location', 'Unknown location.')
                context_list.append(f"- LABEL: {m['label']}\n  Details: {desc}\n  Forensics: {forensics}\n  Location: {loc}")
                
            return "\n\n".join(context_list)
    except (FileNotFoundError, json.JSONDecodeError):
        return "No objects memorized yet."

def search_relevant_memories(query, max_results=5):
    """Search through memories using keyword matching across all hidden fields."""
    try:
        with open("memory.json", "r") as f:
            memories = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []
    
    if not memories:
        return []
    
    query_lower = query.lower()
    query_words = set(re.findall(r'\w+', query_lower))
    
    scored_memories = []
    for mem in memories:
        score = 0
        label_lower = mem['label'].lower()
        desc_lower = mem.get('description', '').lower()
        forensics_lower = mem.get('secret_forensics', '').lower()
        
        # Exact match gets high priority
        if query_lower in label_lower or label_lower in query_lower:
            score += 10
        
        label_words = set(re.findall(r'\w+', label_lower))
        desc_words = set(re.findall(r'\w+', desc_lower))
        forensic_words = set(re.findall(r'\w+', forensics_lower))
        
        score += len(query_words & label_words) * 3 
        score += len(query_words & desc_words) * 1  
        score += len(query_words & forensic_words) * 1 
        
        if score > 0:
            scored_memories.append((score, mem))
    
    scored_memories.sort(reverse=True, key=lambda x: x[0])
    return [mem for score, mem in scored_memories[:max_results]]

def build_recall_context(relevant_memories):
    """Format relevant memories for the recall prompt"""
    if not relevant_memories:
        return "No relevant memories found in the vault."
    
    context_parts = []
    for i, mem in enumerate(relevant_memories, 1):
        context_parts.append(
            f"Memory #{i}:\n"
            f"  Label: {mem['label']}\n"
            f"  Secret Forensics: {mem.get('secret_forensics', 'N/A')}\n"
            f"  Secret Location: {mem.get('secret_location', 'N/A')}\n"
            f"  Last Seen: {mem['timestamp']}"
        )
    return "\n\n".join(context_parts)

# ==========================================
# MAIN APP EXECUTION
# ==========================================
if not api_key:
    st.error("API Key missing! Please check your .env file.")
else:
    try:
        client = genai.Client(api_key=api_key)
        
        st.title("# VisionVault")
        
        # 📸 SECTION 1: IMAGE CAPTURE
        img_buffer = st.file_uploader("📸 Tap to open Camera or Gallery", type=["png", "jpg", "jpeg"])

        if img_buffer:
            img = Image.open(img_buffer)
            st.image(img, use_container_width=True)
            
            if img_buffer.file_id != st.session_state.processed_image_id:
                st.session_state.analysis_data = None
                
                ai_img = img.copy()
                ai_img.thumbnail((1600, 1600)) 
                if ai_img.mode != 'RGB':
                    ai_img = ai_img.convert('RGB') 
                
                target_model = "gemini-3.1-flash-lite" 
                
                with st.status("🧠 Analyzing instantly...", expanded=True) as status:
                    status.update(label="🔍 Querying Vault...", state="running")
                    context = get_memory_context()
                    
                    status.update(label=f"🛰️ Reasoning via {target_model}...", state="running")
                    
                    prompt = f"""
                    You are a strict visual memory assistant. 
                    Below is your 'Vault' of memorized items:
                    {context}

                    CRITICAL RULES:
                    1. Identify the SINGLE, PRIMARY subject taking up the center of this new image.
                    2. Check if this PRIMARY subject matches an item in your Vault.
                    3. ABSOLUTE PROHIBITION: Ignore any background or edge items. Do NOT trigger a recognition for them.
                    4. You MUST format your entire response as a valid JSON object exactly like this, with no markdown formatting outside of it:
                    {{
                        "match_status": "RECOGNIZED" or "NEW",
                        "matched_label": "The exact label from the vault if recognized, otherwise null",
                        "ui_description": "A short, friendly 1-2 sentence description of what the main object is.",
                        "secret_forensics": "Extremely detailed physical traits of the object ONLY: scratches, dents, M.R.P., QR codes, brand text, dust.",
                        "secret_location": "Extremely detailed description of the surroundings: exactly what the object is sitting on or next to."
                    }}
                    """

                    safe_config = types.GenerateContentConfig(
                        response_mime_type="application/json",
                        safety_settings=[
                            types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold=types.HarmBlockThreshold.BLOCK_ONLY_HIGH),
                            types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold=types.HarmBlockThreshold.BLOCK_ONLY_HIGH),
                            types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold=types.HarmBlockThreshold.BLOCK_ONLY_HIGH),
                            types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_HARASSMENT, threshold=types.HarmBlockThreshold.BLOCK_ONLY_HIGH),
                        ]
                    )

                    max_retries = 8
                    for attempt in range(max_retries):
                        try:
                            response = client.models.generate_content(
                                model=target_model,
                                contents=[prompt, ai_img],
                                config=safe_config
                            )
                            
                            if not response.candidates or not response.candidates[0].content:
                                status.update(label="🛑 Blocked by AI Safety Filters", state="error")
                                st.error("Gemini refused to process this image due to safety filters.")
                                break
                                
                            parsed_data = parse_ai_json(response.text)
                            st.session_state.analysis_data = parsed_data
                            st.session_state.processed_image_id = img_buffer.file_id
                            status.update(label="✅ Analysis Complete", state="complete")
                            break 
                            
                        except Exception as e:
                            error_msg = str(e)
                            if "SSL" in error_msg or "EOF" in error_msg:
                                if attempt < max_retries - 1:
                                    status.update(label=f"⚠️ Network drop. Retrying ({attempt + 1}/{max_retries})...", state="running")
                                    time.sleep(1.5)
                                    continue
                                else:
                                    status.update(label="🛑 Network Error", state="error")
                                    st.error(f"Connection failed: {error_msg}")
                                    break
                            elif "503" in error_msg:
                                status.update(label="⚠️ Server busy, re-routing...", state="running")
                                time.sleep(3)
                            elif "JSONDecodeError" in str(type(e)):
                                status.update(label="🛑 Parser Error", state="error")
                                st.error("AI failed to return valid JSON format.")
                                break
                            else:
                                status.update(label="🛑 API Error", state="error")
                                st.error(f"API Error: {error_msg}")
                                break

            # RENDER UI FROM SESSION STATE DATA
            if st.session_state.analysis_data:
                data = st.session_state.analysis_data
                st.divider()
                
                if data.get("match_status") == "RECOGNIZED":
                    st.toast("🎯 Vault Match Found!", icon="✅")
                    st.success(f"Recognized: {data.get('matched_label')}")
                else:
                    st.info("New Object Detected")

                st.write(data.get("ui_description", "No description available."))

                st.divider()
                st.subheader("📥 Add to Vault")
                
                default_label = data.get("matched_label") if data.get("match_status") == "RECOGNIZED" else ""
                item_label = st.text_input("Label this object (e.g., 'My Red Suitcase')", value=default_label, key="label_input")
                
                if st.button("Save to Memory"):
                    clean_label = item_label.strip() if item_label.strip() else "Unlabeled Object"
                    
                    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
                    img_filename = f"mem_{timestamp_str}.jpg"
                    img_path = os.path.join(IMG_DIR, img_filename)
                    ai_img = Image.open(img_buffer)
                    ai_img.thumbnail((1600, 1600))
                    if ai_img.mode != 'RGB':
                        ai_img = ai_img.convert('RGB')
                    ai_img.save(img_path, "JPEG")
                    
                    new_memory = {
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "label": clean_label,
                        "description": data.get("ui_description", ""),
                        "secret_forensics": data.get("secret_forensics", ""),
                        "secret_location": data.get("secret_location", ""),
                        "image_path": img_path 
                    }
                    
                    try:
                        with open("memory.json", "r") as f:
                            memories_data = json.load(f)
                    except (FileNotFoundError, json.JSONDecodeError):
                        memories_data = []
                    
                    # 🔥 NEW LOGIC: Update existing label instead of duplicating
                    existing_index = None
                    for i, mem in enumerate(memories_data):
                        if mem['label'].lower() == clean_label.lower():
                            existing_index = i
                            break
                            
                    if existing_index is not None:
                        # Clean up the old image file to save space
                        old_img = memories_data[existing_index].get("image_path")
                        if old_img and os.path.exists(old_img) and old_img != img_path:
                            try:
                                os.remove(old_img)
                            except OSError:
                                pass
                        # Overwrite with the latest scan
                        memories_data[existing_index] = new_memory
                        st.toast(f"Updated memory for: {clean_label}", icon="🔄")
                    else:
                        memories_data.append(new_memory)
                        st.toast(f"Saved new memory: {clean_label}", icon="💾")

                    with open("memory.json", "w") as f:
                        json.dump(memories_data, f, indent=4)
                    
                    st.rerun()

        # 🔍 SECTION 2: RECALL SYSTEM
        st.divider()
        st.subheader("🔍 Ask VisionVault")
        st.caption("Ask about your items: 'Where did I leave my keys?'")
        
        col1, col2 = st.columns([4, 1])
        with col1:
            recall_query = st.text_input("Query", placeholder="What are you looking for?", label_visibility="collapsed", key="recall_input")
        with col2:
            recall_button = st.button("Recall", use_container_width=True)
        
        if recall_button and recall_query.strip():
            with st.status("🔎 Searching memory...", expanded=True) as status:
                relevant_memories = search_relevant_memories(recall_query)
                
                if not relevant_memories:
                    status.update(label="🤷 No matching memories found.", state="error")
                    st.session_state.top_recall_memory = None
                    st.warning("Have you scanned this object before?")
                else:
                    st.session_state.top_recall_memory = relevant_memories[0]
                    
                    status.update(label="🧠 Formulating recall response...", state="running")
                    recall_context = build_recall_context(relevant_memories)
                    
                    recall_prompt = f"""
                    You are VisionVault's Memory Assistant. Answer the user based on their past visual memories.

                    USER QUERY: "{recall_query}"

                    RELEVANT VAULT MEMORIES:
                    {recall_context}

                    YOUR TASK:
                    1. Analyze the memories against the query to find the correct object.
                    2. Provide a conversational, helpful response focusing heavily on LOCATION. 
                    3. If you find a match, tell them EXACTLY WHERE it was last seen based on the Secret Location data, and give the timestamp.
                    4. CRITICAL: DO NOT recite the Secret Forensics description UNLESS the user explicitly asks for details, "everything", "whatever you know", condition, or physical traits. If they ask for everything, give them ALL the forensic details you have.
                    """
                    
                    safe_config = types.GenerateContentConfig(
                        safety_settings=[
                            types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold=types.HarmBlockThreshold.BLOCK_ONLY_HIGH),
                            types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold=types.HarmBlockThreshold.BLOCK_ONLY_HIGH),
                            types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold=types.HarmBlockThreshold.BLOCK_ONLY_HIGH),
                            types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_HARASSMENT, threshold=types.HarmBlockThreshold.BLOCK_ONLY_HIGH),
                        ]
                    )
                    
                    max_retries = 3
                    for attempt in range(max_retries):
                        try:
                            recall_resp = client.models.generate_content(
                                model="gemini-3.1-flash-lite",
                                contents=recall_prompt,
                                config=safe_config
                            )
                            st.session_state.recall_response = recall_resp.text
                            status.update(label="✅ Memory Recalled", state="complete")
                            break
                        except Exception as e:
                            error_msg = str(e)
                            if "SSL" in error_msg or "EOF" in error_msg:
                                if attempt < max_retries - 1:
                                    status.update(label=f"⚠️ Network drop. Retrying ({attempt + 1}/{max_retries})...", state="running")
                                    time.sleep(1.5)
                                    continue
                                else:
                                    status.update(label="🛑 Network Error", state="error")
                                    st.error(f"Connection failed: {error_msg}")
                                    break
                            elif "503" in error_msg:
                                status.update(label="⚠️ Server busy, re-routing...", state="running")
                                time.sleep(3)
                            else:
                                status.update(label="🛑 API Error", state="error")
                                st.error(f"Recall Error: {error_msg}")
                                break
        
        if st.session_state.recall_response:
            st.info(st.session_state.recall_response)
            
            top_mem = st.session_state.top_recall_memory
            if top_mem and top_mem.get("image_path") and os.path.exists(top_mem["image_path"]):
                with st.expander("📷 Show Latest Image"):
                    st.image(top_mem["image_path"], caption=f"Snapshot from {top_mem['timestamp']}", use_container_width=True)

        # 📁 SECTION 3: VAULT HISTORY WITH DELETE BUTTONS
        st.divider()
        with st.expander("📁 Your Vault History", expanded=False):
            try:
                with open("memory.json", "r") as f:
                    memories = json.load(f)
                
                if memories:
                    # Loop backward safely by index so we can pop elements without breaking the loop
                    for i in range(len(memories) - 1, -1, -1):
                        mem = memories[i]
                        with st.expander(f"🏷️ {mem['label']} ({mem['timestamp']})"):
                            st.write(mem.get('description', 'No description recorded.'))
                            
                            if mem.get("image_path") and os.path.exists(mem["image_path"]):
                                st.image(mem["image_path"], use_container_width=True)
                            
                            # 🔥 DELETE BUTTON
                            if st.button("🗑️ Delete Memory", key=f"del_{i}"):
                                # Remove image file
                                img_to_del = mem.get("image_path")
                                if img_to_del and os.path.exists(img_to_del):
                                    try:
                                        os.remove(img_to_del)
                                    except OSError:
                                        pass
                                
                                # Remove from JSON
                                memories.pop(i)
                                with open("memory.json", "w") as f:
                                    json.dump(memories, f, indent=4)
                                
                                st.toast("Memory deleted.", icon="🗑️")
                                st.rerun()
                else:
                    st.info("The vault is currently empty.")
            except (FileNotFoundError, json.JSONDecodeError):
                st.info("No memories found yet.")

    except Exception as e:
        st.error(f"System Interrupt: {e}")