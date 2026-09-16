FROM python:3.11-slim

# 安裝 FFmpeg 與系統基礎工具
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 複製並安裝依賴
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 複製應用程式檔案
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# 建立工作目錄
RUN mkdir -p uploads/lyrics projects outputs

EXPOSE 8128

CMD ["python", "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8128"]
