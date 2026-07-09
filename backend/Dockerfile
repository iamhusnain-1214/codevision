# CodeVision backend — Flask + Python tracer (sys.settrace) + C++ tracer (GDB/MI via pygdbmi)
FROM python:3.11-slim

# GDB + GCC/G++ are required by tracer_custom_cpp.py (spawns gdb via pygdbmi
# to trace compiled C++ code). Without these installed in the image, the
# Custom Code Visualizer's C++ mode will fail at runtime with "gdb: command
# not found" even though the Python side works fine.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    gdb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Railway/Render set $PORT dynamically — Flask needs to bind to it, not a
# hardcoded 5000, or the platform's health check will never find your app.
ENV PORT=5000
EXPOSE 5000

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT} --timeout 120 app:app"]
