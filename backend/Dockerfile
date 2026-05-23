# my-online-game/backend/Dockerfile
# --- Dockerfile for FastAPI Backend ---

# 1. Base Image
# ใช้ Python slim image เพื่อความเบาและรวดเร็ว
FROM python:3.11-slim

# 2. Metadata & Setup
LABEL maintainer="Admin Dev"
LABEL description="AI Game Logic Proxy Backend for Survival Runner"

# 3. Set Working Directory
WORKDIR /app

# 4. Copy Requirements & Install
# สร้างเลเยอร์ของ dependencies แยกเพื่อการ Caching ที่ดีเยี่ยม
COPY my-online-game/backend/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy Application Code
COPY my-online-game/backend/app.py .

# 6. Expose Port
EXPOSE 8000

# 7. Command to Run
# คำสั่งที่จะรัน API Server เมื่อ Container ถูกเปิดขึ้นมา
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
