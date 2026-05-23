# backend/app.py – Nebula AI: Rogue Defender
# Unified server: FastAPI game-AI endpoints + static frontend assets.
# Railway-compatible: reads $PORT environment variable.

import os
import math
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="Nebula AI: Rogue Defender")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic Schema ───────────────────────────────────────────────────────────
class GameState(BaseModel):
    player_x: float
    player_y: float
    enemy_x: float
    enemy_y: float
    player_hp: float
    enemy_hp: float
    score: int
    difficulty_level: int

# ── Game AI Endpoint ──────────────────────────────────────────────────────────
@app.post("/api/game_turn")
async def process_game_turn(state: GameState):
    dx = state.player_x - state.enemy_x
    dy = state.player_y - state.enemy_y
    distance = math.hypot(dx, dy)

    action  = "STAY"
    message = "รักษาระดับการลาดตระเวน"

    # ── Decision Matrix ──────────────────────────────────────────────────────
    if state.player_hp < 40:
        message = "🚨 [CRITICAL HP] ตรวจพบระดับพลังงานต่ำ! ถอยร่นเพื่อหลบหลีกศัตรู"
        action = ("MOVE_RIGHT" if dx > 0 else "MOVE_LEFT") if abs(dx) > abs(dy) \
                 else ("MOVE_DOWN" if dy > 0 else "MOVE_UP")

    elif 0 < state.enemy_hp < 30:
        message = "🎯 [AGGRESSIVE] ตรวจพบศัตรูเสียหายหนัก! บินเข้าประชิดเพื่อกวาดล้าง"
        action = ("MOVE_LEFT" if dx > 0 else "MOVE_RIGHT") if abs(dx) > abs(dy) \
                 else ("MOVE_UP" if dy > 0 else "MOVE_DOWN")

    elif distance < 150:
        message = "🛡️ [TACTICAL] ศัตรูเข้าใกล้เกินไป! รักษาความปลอดภัยและถอยฉาก"
        action = ("MOVE_RIGHT" if dx > 0 else "MOVE_LEFT") if abs(dx) > abs(dy) \
                 else ("MOVE_DOWN" if dy > 0 else "MOVE_UP")

    elif distance > 350:
        message = "🚀 [APPROACH] ค้นหาข้าศึก... เร่งความเร็วเข้าสู่ระยะเลเซอร์"
        action = ("MOVE_LEFT" if dx > 0 else "MOVE_RIGHT") if abs(dx) > abs(dy) \
                 else ("MOVE_UP" if dy > 0 else "MOVE_DOWN")

    else:
        message = "🔫 [ENGAGING] อนุมัติระบบล็อกเป้าเลเซอร์อัตโนมัติ"
        if abs(dx) > 20:
            action = "MOVE_LEFT" if dx > 0 else "MOVE_RIGHT"
        else:
            action = "MOVE_UP" if dy > 0 else "MOVE_DOWN"

    # ── Edge clamps ──────────────────────────────────────────────────────────
    if state.player_x < 50 and action == "MOVE_LEFT":
        action = "MOVE_UP" if state.player_y > 300 else "MOVE_DOWN"
    elif state.player_x > 750 and action == "MOVE_RIGHT":
        action = "MOVE_UP" if state.player_y > 300 else "MOVE_DOWN"
    if state.player_y < 50 and action == "MOVE_UP":
        action = "MOVE_RIGHT" if state.player_x < 400 else "MOVE_LEFT"
    elif state.player_y > 550 and action == "MOVE_DOWN":
        action = "MOVE_RIGHT" if state.player_x < 400 else "MOVE_LEFT"

    print(f"[AI] HP:{state.player_hp:.0f} Dist:{distance:.0f} → {action}")
    return {"success": True, "ai_command": action, "message": message}

# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "API Online", "message": "Nebula AI Backend is running. CORS enabled."}

# ── Static Frontend (must be mounted LAST so API routes win) ──────────────────
# In production (Docker / Railway) the frontend dir sits at ../frontend relative
# to this file; StaticFiles with html=True serves index.html for "/".
_here = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(_here, "..", "frontend"))

if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")
    print(f"[STATIC] Serving frontend from: {FRONTEND_DIR}")
else:
    print(f"[STATIC] Frontend dir not found at {FRONTEND_DIR} – static assets disabled.")

# ── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print("=" * 60)
    print("  NEBULA AI: ROGUE DEFENDER – BACKEND STARTING")
    print(f"  Listening on http://0.0.0.0:{port}")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=port)