from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uvicorn
import google.generativeai as genai
import os
import base64
import json
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env in the backend folder
backend_dir = Path(__file__).parent
load_dotenv(backend_dir / '.env')

# Configure Gemini API
api_key = os.getenv('GEMINI_API_KEY')
if api_key:
    genai.configure(api_key=api_key)
else:
    print(f"API Key loaded: {bool(os.getenv('GEMINI_API_KEY'))}")

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data model for incoming payload
class ScanPayload(BaseModel):
    front: Optional[Dict[str, Any]] = None
    back: Optional[Dict[str, Any]] = None
    history: list = []

class SearchPayload(BaseModel):
    query: str
    history: list

def base64_to_bytes(base64_str: str) -> bytes:
    """Convert a base64 string (with or without data URI prefix) to bytes."""
    if base64_str.startswith('data:image'):
        # Remove the data URI prefix
        base64_str = base64_str.split(',')[1]
    return base64.b64decode(base64_str)

HISTORY_FILE = backend_dir / "vault_history.json"

@app.get("/api/history")
async def get_history():
    print("Loading history from hard drive...")
    if HISTORY_FILE.exists():
        try:
            with open(HISTORY_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading history: {e}")
            return [] 
    return []

@app.post("/api/history")
async def save_history(request: Request):
    print("Saving history to hard drive...")
    try:
        data = await request.json()
        with open(HISTORY_FILE, "w") as f:
            json.dump(data, f)
        return {"status": "success"}
    except Exception as e:
        print(f"Error saving history: {e}")
        return {"status": "error", "message": str(e)}

import asyncio
import json

# --- AGENT 1: THE FORENSIC IDENTIFIER (CROPS ONLY) ---
async def run_agent_1(payload: ScanPayload, history_json: str):
    content = []
    if payload.front and payload.front.get('crop'):
        content.append("--- THIS NEXT IMAGE IS THE: Front View Crop ---")
        content.append({'mime_type': 'image/webp', 'data': base64_to_bytes(payload.front['crop'])})
    if payload.back and payload.back.get('crop'):
        content.append("--- THIS NEXT IMAGE IS THE: Back View Crop ---")
        content.append({'mime_type': 'image/webp', 'data': base64_to_bytes(payload.back['crop'])})

    if not content:
        return {"status": "error", "message": "No crop images provided"}

    prompt = f"""CRITICAL VERIFICATION RULE: Analyze ONLY the CROP images. 
You are a forensic micro-inspector. Scan every pixel and identify the primary object.
CRITICAL OCR RULE: You MUST actively read and extract any visible text, logos, or brand names (e.g., 'Logitech', 'Google', 'MLH', 'Dell'). 

If comparing to historical data, be EXTREMELY strict. A black mouse with 'Logitech' is fundamentally a DIFFERENT object than a black mouse with 'Ant Esports', even if the shape is identical. Do not merge them. Match them ONLY if the brand, text, and physical hardware perfectly align.

If the crops depict ONLY empty space or a bare surface without ANY distinct object, you MUST abort and return the status as "error".

Return ONLY a valid JSON object with these exact fields:
- status: String ("new_object", "update", or "error")
- matched_id: Integer or null 
- similarity_score: Integer 0-100
- hardware_identity: String (Include brand name if visible!)
- unique_identifiers: Array of Strings (List exact textures, TEXT, logos, colors, or marks)
- view_invariance: String (What features match across the front and back views)
- suggested_labels: Array of Strings (3-5 tags, prioritize text/brands)
- certainty_score: Integer 0-100
Historical data: {history_json}
Ensure the response is valid JSON only, no markdown."""
    content.append(prompt)

    try:
        model = genai.GenerativeModel('gemini-3.1-flash-lite')
        # Use ASYNC generation for parallel computing
        response = await model.generate_content_async(content)
        text = response.text.strip()
        
        # Safely parse markdown blocks
        if '```json' in text:
            text = text.split('```json')[1].split('```')[0].strip()
        elif '```' in text:
            text = text.split('```')[1].split('```')[0].strip()
            
        return json.loads(text)
    except Exception as e:
        print(f"Agent 1 Error: {e}")
        return {"status": "error", "hardware_identity": "Error identifying object"}


# --- AGENT 2: THE SPATIAL LOCATOR (ORIGINALS ONLY) ---
async def run_agent_2(payload: ScanPayload):
    content = []
    if payload.front and payload.front.get('original'):
        content.append("--- THIS NEXT IMAGE IS THE: Original Room Background ---")
        content.append({'mime_type': 'image/webp', 'data': base64_to_bytes(payload.front['original'])})
    # We only really need one background to find the location, saving tokens
    elif payload.back and payload.back.get('original'):
        content.append("--- THIS NEXT IMAGE IS THE: Original Room Background ---")
        content.append({'mime_type': 'image/webp', 'data': base64_to_bytes(payload.back['original'])})

    if not content:
         return {"spatial_context": "No background image provided."}

    prompt = """You are a spatial analysis engine looking at a room environment. 
Find the most prominent object in the center of the image. Treat this central object as a strictly defined variable named [TARGET_OBJECT].
STRICT RULE: Do not attempt to guess or name what [TARGET_OBJECT] is. Your ONLY job is to describe its location relative to other items in the environment.
Example valid output: {"spatial_context": "[TARGET_OBJECT] is resting on a white piece of paper on a wooden desk, positioned near a laptop."}

Return ONLY a valid JSON object with this EXACT single field:
- spatial_context: String
Ensure the response is valid JSON only, no markdown."""
    content.append(prompt)

    try:
        model = genai.GenerativeModel('gemini-3.1-flash-lite')
        # Use ASYNC generation for parallel computing
        response = await model.generate_content_async(content)
        text = response.text.strip()
        
        if '```json' in text:
            text = text.split('```json')[1].split('```')[0].strip()
        elif '```' in text:
            text = text.split('```')[1].split('```')[0].strip()
            
        return json.loads(text)
    except Exception as e:
        print(f"Agent 2 Error: {e}")
        return {"spatial_context": "Failed to analyze surroundings."}


# --- THE MAIN ENDPOINT: STITCHING IT ALL TOGETHER ---
@app.post("/api/scan")
async def scan(payload: ScanPayload):
    print("Executing Dual-Agent Parallel Pipeline...")
    try:
        history_json = json.dumps(payload.history or [])

        # 1. Fire both agents simultaneously
        task1 = run_agent_1(payload, history_json)
        task2 = run_agent_2(payload)
        
        # Await them both at the same time (Parallel compute)
        results = await asyncio.gather(task1, task2)
        agent1_data = results[0]
        agent2_data = results[1]

        # 2. Check for critical failure
        if agent1_data.get("status") == "error":
            return agent1_data

        # 3. The Compiler Stitch
        # Grab the identity from Agent 1 and the raw location from Agent 2
        identity = agent1_data.get("hardware_identity", "The object")
        raw_location = agent2_data.get("spatial_context", "[TARGET_OBJECT] is in the room.")
        
        # Replace the variable pointer with the actual identity
        stitched_location = raw_location.replace("[TARGET_OBJECT]", identity)

        # 4. Final Payload Assembly (React sees this as one normal object)
        final_payload = agent1_data
        final_payload["spatial_context"] = stitched_location

        return final_payload
            
    except Exception as e:
        print(f"Master Error in scan pipeline: {str(e)}")
        return {"status": "error", "message": str(e)}

@app.post("/api/search")
async def search(payload: SearchPayload):
    """AI-powered semantic search matching vault history items."""
    print(f"Executing Deep AI Search for: {payload.query}")
    
    if not payload.query or not payload.history:
        return {"matched_ids": []}

    # Build the context string (STRIPPING SPATIAL CONTEXT)
    history_context = ""
    for item in payload.history:
        item_id = item.get("id", "unknown_id")
        title = item.get("title", "Unknown Object")
        marks = item.get("marks_and_dents", [])
        marks_str = ", ".join(marks) if isinstance(marks, list) else marks
        
        history_context += f"- ID: {item_id} | Label: {title} | Details: {marks_str}\n"

    # The Strict Search Prompt
    prompt = f"""You are a semantic search routing engine. 
The user is looking for an item using this query: "{payload.query}"

Here is the current vault history:
{history_context}

Your ONLY job is to figure out which items match the user's query. 
Return ONLY a valid JSON object with a single field "matched_ids" containing an array of the matching string IDs.
If no matches are found, return {{"matched_ids": []}}.
Do not include any markdown formatting or explanation."""

    try:
        model = genai.GenerativeModel('gemini-3.1-flash-lite')
        # Use async generation
        response = await model.generate_content_async(prompt)
        text = response.text.strip()
        
        # SAFE PARSING: Removing markdown without typing backticks together
        text = text.replace("`", "")
        text = text.replace("json", "")
        text = text.strip()
        
        return json.loads(text)

    except Exception as e:
        print(f"Search error: {str(e)}")
        return {"matched_ids": []}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)