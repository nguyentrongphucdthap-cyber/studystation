import base64
import io
import os
import uuid

import fitz  # PyMuPDF
import mammoth
import requests
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI()
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Allow CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

IMGBB_API_KEY = "cba4af8f08a1654c46570add6d3f1055"
IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload"


def upload_image_bytes(image_bytes: bytes, extension: str = "png") -> str:
    try:
        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        payload = {
            "key": IMGBB_API_KEY,
            "image": b64_image
        }
        response = requests.post(IMGBB_UPLOAD_URL, data=payload, timeout=30)
        if response.status_code == 200:
            data = response.json()
            return data["data"]["url"]
        else:
            raise Exception(f"ImgBB upload failed with status {response.status_code}: {response.text}")
    except Exception as e:
        raise Exception(f"Failed to upload image to ImgBB: {str(e)}")


def extract_page_items(page: fitz.Page) -> list[dict]:
    items = []
    page_dict = page.get_text("dict")

    for block in page_dict.get("blocks", []):
        block_type = block.get("type")
        bbox = block.get("bbox", [0, 0, 0, 0])
        x0 = bbox[0] if len(bbox) > 0 else 0
        y0 = bbox[1] if len(bbox) > 1 else 0

        if block_type == 0:
            lines = []
            for line in block.get("lines", []):
                spans = [span.get("text", "") for span in line.get("spans", [])]
                line_text = "".join(spans).strip()
                if line_text:
                    lines.append(line_text)
            text = "\n".join(lines).strip()
            if text:
                items.append({
                    "type": "text",
                    "x": x0,
                    "y": y0,
                    "content": text,
                })
        elif block_type == 1:
            image_bytes = block.get("image")
            if image_bytes:
                ext = block.get("ext", "png")
                image_url = upload_image_bytes(image_bytes, ext)
                items.append({
                    "type": "image",
                    "x": x0,
                    "y": y0,
                    "content": f"![page-image]({image_url})",
                })

    return sorted(items, key=lambda item: (round(item["y"], 1), round(item["x"], 1)))


def extract_pdf(file_bytes: bytes) -> str:
    text_content = []
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            page_items = extract_page_items(page)
            page_parts = [item["content"] for item in page_items]
            if page_parts:
                text_content.append("\n\n".join(page_parts))
        return "\n\n".join(text_content)
    except Exception as e:
        raise Exception(f"Failed to extract PDF: {str(e)}")

def extract_docx(file_bytes: bytes) -> str:
    try:
        def handle_image(image):
            with image.open() as image_bytes:
                raw_bytes = image_bytes.read()
                image_url = upload_image_bytes(raw_bytes)
                return {"src": image_url}
            
        # Convert docx to markdown using mammoth, saving images to ImgBB
        result = mammoth.convert_to_markdown(
            io.BytesIO(file_bytes),
            convert_image=mammoth.images.inline(handle_image)
        )
        return result.value
    except Exception as e:
        raise Exception(f"Failed to extract DOCX: {str(e)}")

@app.post("/api/extract")
async def extract_document(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    try:
        contents = await file.read()
        
        extracted_text = ""
        if file.filename.lower().endswith('.pdf'):
            extracted_text = extract_pdf(contents)
        elif file.filename.lower().endswith('.docx'):
            extracted_text = extract_docx(contents)
        elif file.filename.lower().endswith('.txt'):
            extracted_text = contents.decode("utf-8")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload PDF, DOCX, or TXT.")
        
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Document appears to be empty or content could not be extracted.")
            
        return {"text": extracted_text}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
