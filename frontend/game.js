// game.js - Nebula AI: Rogue Defender Core Logic

// 1. Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

// 2. Audio Engine (Web Audio API Synthesizer)
let audioCtx = null;
let soundEnabled = true;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (!soundEnabled) return;
    try {
        initAudio();
        if (!audioCtx) return;

        const now = audioCtx.currentTime;
        
        if (type === 'laser') {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.12);
            
            gainNode.gain.setValueAtTime(0.08, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            
            osc.start(now);
            osc.stop(now + 0.12);
        } 
        else if (type === 'explosion') {
            // Noise blast simulation using filtered low frequency sweep
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(250, now);
            osc.frequency.exponentialRampToValueAtTime(20, now + 0.4);
            
            gainNode.gain.setValueAtTime(0.3, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            
            osc.start(now);
            osc.stop(now + 0.4);
        }
        else if (type === 'hit') {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);
            
            gainNode.gain.setValueAtTime(0.15, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            
            osc.start(now);
            osc.stop(now + 0.08);
        }
        else if (type === 'shield_hit') {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.linearRampToValueAtTime(1200, now + 0.08);
            
            gainNode.gain.setValueAtTime(0.12, now);
            gainNode.gain.linearRampToValueAtTime(0.001, now + 0.08);
            
            osc.start(now);
            osc.stop(now + 0.08);
        }
        else if (type === 'powerup') {
            // Rapid upward arpeggio
            [300, 450, 600, 750].forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                osc.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.05);
                
                gainNode.gain.setValueAtTime(0.06, now + idx * 0.05);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.1);
                
                osc.start(now + idx * 0.05);
                osc.stop(now + idx * 0.05 + 0.1);
            });
        }
        else if (type === 'upgrade') {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(554, now + 0.08);
            osc.frequency.setValueAtTime(659, now + 0.16);
            
            gainNode.gain.setValueAtTime(0.08, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            
            osc.start(now);
            osc.stop(now + 0.25);
        }
        else if (type === 'gameover') {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.8);
            
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
            
            osc.start(now);
            osc.stop(now + 0.8);
        }
    } catch (e) {
        console.error("Audio Synthesis Error:", e);
    }
}

// 3. Game State Variables
let gameRunning = false;
let score = 0;
let kills = 0;
let scrap = 0;
let wave = 1;
let mode = 'manual'; // 'manual' or 'ai'
let keys = {};
let mouse = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };

// Entity lists
let player = null;
let enemies = [];
let bullets = [];
let powerups = [];
let scraps = [];
let particles = [];
let starfield = [];

// Upgrade Stats
const upgrades = {
    firerate: { lvl: 1, max: 5, baseCost: 15 },
    damage: { lvl: 1, max: 5, baseCost: 20 },
    shield: { lvl: 1, max: 5, baseCost: 25 },
    speed: { lvl: 1, max: 5, baseCost: 10 }
};

// Target stats calculator
function getPlayerStat(type) {
    const lvl = upgrades[type].lvl;
    if (type === 'speed') {
        return 4 + lvl; // Speed levels: 5, 6, 7, 8, 9
    }
    if (type === 'firerate') {
        return Math.max(120, 500 - (lvl - 1) * 80); // Reload delay in ms: 500, 420, 340, 260, 180
    }
    if (type === 'damage') {
        return 15 + (lvl - 1) * 10; // Laser damage: 15, 25, 35, 45, 55
    }
    if (type === 'shield') {
        return 4000 + (lvl - 1) * 1500; // Shield duration in ms: 4s, 5.5s, 7s, 8.5s, 10s
    }
}

function getUpgradeCost(type) {
    const lvl = upgrades[type].lvl;
    if (lvl >= upgrades[type].max) return Infinity;
    return Math.floor(upgrades[type].baseCost * Math.pow(1.6, lvl - 1));
}

// 4. Initializers
function createStarfield() {
    starfield = [];
    for (let i = 0; i < 80; i++) {
        starfield.push({
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * CANVAS_HEIGHT,
            size: Math.random() * 2,
            speed: Math.random() * 1.5 + 0.5
        });
    }
}

function resetGame() {
    score = 0;
    kills = 0;
    scrap = 0;
    wave = 1;
    
    // Reset upgrades to lvl 1
    Object.keys(upgrades).forEach(key => upgrades[key].lvl = 1);
    
    player = {
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT * 0.75,
        vx: 0,
        vy: 0,
        size: 15,
        hp: 100,
        maxHp: 100,
        shieldActive: true,
        shieldExpiryTime: Date.now() + 4000, // Starts with 4s shield
        lastShotTime: 0,
        angle: -Math.PI / 2
    };

    enemies = [];
    bullets = [];
    powerups = [];
    scraps = [];
    particles = [];
    
    createStarfield();
    updateHUD();
    logToAIConsole("เริ่มต้นระบบความปลอดภัยยานรบ... ด่านที่ " + wave);
    spawnWave();
}

// 5. Drawing Utilities
function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    // Engine thruster fire animation
    if (Math.abs(player.vx) > 0.5 || Math.abs(player.vy) > 0.5 || mode === 'ai') {
        ctx.fillStyle = Math.random() > 0.5 ? '#ffcc00' : '#ff3b30';
        ctx.beginPath();
        ctx.moveTo(-10, -5);
        ctx.lineTo(-20 - Math.random() * 10, 0);
        ctx.lineTo(-10, 5);
        ctx.closePath();
        ctx.fill();
    }

    // Ship body
    ctx.fillStyle = '#00ffff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    
    ctx.beginPath();
    ctx.moveTo(18, 0);       // Nose
    ctx.lineTo(-10, -12);    // Left wing
    ctx.lineTo(-6, -4);      // Back indent left
    ctx.lineTo(-6, 4);       // Back indent right
    ctx.lineTo(-10, 12);     // Right wing
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cabin glass
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-2, -4);
    ctx.lineTo(-2, 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Shield forcefield effect
    if (player.shieldActive) {
        const timeLeft = player.shieldExpiryTime - Date.now();
        if (timeLeft > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.size + 15, 0, Math.PI * 2);
            
            // Pulsing effect
            const alpha = 0.25 + Math.sin(Date.now() * 0.01) * 0.1;
            const gradient = ctx.createRadialGradient(player.x, player.y, player.size, player.x, player.y, player.size + 18);
            gradient.addColorStop(0, 'rgba(0, 255, 255, 0)');
            gradient.addColorStop(0.8, `rgba(0, 255, 255, ${alpha})`);
            gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
            
            ctx.fillStyle = gradient;
            ctx.fill();
            
            ctx.strokeStyle = `rgba(0, 255, 255, ${alpha + 0.2})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        } else {
            player.shieldActive = false;
            updateHUD();
        }
    }

    // HP Bar above player
    drawMiniHPBar(player.x, player.y + 25, player.hp, player.maxHp);
}

function drawMiniHPBar(x, y, hp, maxHp) {
    const barWidth = 36;
    const barHeight = 4;
    const pct = Math.max(0, hp / maxHp);
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x - barWidth / 2, y - barHeight / 2, barWidth, barHeight);
    
    // Fill
    ctx.fillStyle = pct > 0.5 ? '#39ff14' : pct > 0.25 ? '#ffcc00' : '#ff3b30';
    ctx.fillRect(x - barWidth / 2, y - barHeight / 2, barWidth * pct, barHeight);
}

function drawEnemies() {
    enemies.forEach(e => {
        ctx.save();
        ctx.translate(e.x, e.y);

        if (e.type === 'chaser') {
            // Sleek red drone
            ctx.fillStyle = '#ff3b30';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            
            ctx.beginPath();
            ctx.moveTo(e.size, 0);
            ctx.lineTo(-e.size/2, -e.size);
            ctx.lineTo(-e.size/2, e.size);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Core light
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.fill();
        } 
        else if (e.type === 'cruiser') {
            // Heavy purple spaceship
            ctx.fillStyle = '#bd00ff';
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 1.5;
            
            ctx.beginPath();
            ctx.moveTo(e.size, 0);
            ctx.lineTo(-e.size/2, -e.size);
            ctx.lineTo(-e.size, -e.size/3);
            ctx.lineTo(-e.size, e.size/3);
            ctx.lineTo(-e.size/2, e.size);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Engine lights
            ctx.fillStyle = '#00ffff';
            ctx.fillRect(-e.size + 2, -4, 3, 8);
        }
        else if (e.type === 'asteroid') {
            // Rocky brown outline with craters
            ctx.fillStyle = '#3a3a45';
            ctx.strokeStyle = '#7c7c8c';
            ctx.lineWidth = 2;
            
            // Drawing a bumpy circle
            ctx.beginPath();
            const numPoints = 8;
            for (let i = 0; i < numPoints; i++) {
                const angle = (i / numPoints) * Math.PI * 2;
                const offset = 3 + Math.sin(i * 1.7) * 4;
                const r = e.size - offset;
                const px = Math.cos(angle) * r;
                const py = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Craters inside asteroid
            ctx.fillStyle = '#22222a';
            ctx.beginPath();
            ctx.arc(-e.size/3, -e.size/4, e.size/5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(e.size/4, e.size/3, e.size/6, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
        
        // Mini HP for bigger enemies
        if (e.hp < e.maxHp) {
            drawMiniHPBar(e.x, e.y + e.size + 8, e.hp, e.maxHp);
        }
    });
}

function drawProjectiles() {
    bullets.forEach(b => {
        ctx.beginPath();
        if (b.fromPlayer) {
            // Electric cyan laser beam
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = b.size;
            ctx.moveTo(b.x - b.vx * 1.5, b.y - b.vy * 1.5);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        } else {
            // Pulse plasma red bullet
            ctx.fillStyle = '#ff3b30';
            ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
            ctx.fill();
            
            // Outer glow
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    });
}

function drawCollectibles() {
    // Powerups
    powerups.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        
        // Pulse ring
        ctx.beginPath();
        const pulse = 4 + Math.sin(Date.now() * 0.015) * 3;
        ctx.arc(0, 0, p.size + pulse, 0, Math.PI * 2);
        ctx.fillStyle = p.type === 'SHIELD' ? 'rgba(0, 255, 255, 0.12)' : p.type === 'SPEED' ? 'rgba(255, 204, 0, 0.12)' : 'rgba(57, 255, 20, 0.12)';
        ctx.fill();

        // Core icon (Pulsing diamond)
        ctx.rotate(Date.now() * 0.002);
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size, 0);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size, 0);
        ctx.closePath();
        
        ctx.fillStyle = p.type === 'SHIELD' ? '#00ffff' : p.type === 'SPEED' ? '#ffcc00' : '#39ff14';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
    });

    // Scrap items
    scraps.forEach(s => {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(Date.now() * 0.005);
        
        // Scrap looks like a glowing golden metal piece
        ctx.fillStyle = '#39ff14';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 0.5;
        ctx.fillRect(-s.size/2, -s.size/2, s.size, s.size);
        ctx.strokeRect(-s.size/2, -s.size/2, s.size, s.size);
        
        ctx.restore();
    });
}

function drawParticles() {
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        
        if (p.text) {
            // Floating text (Score popups, upgrades, warnings)
            ctx.save();
            ctx.font = `bold ${p.fontSize}px 'Orbitron', monospace`;
            ctx.fillStyle = p.color;
            ctx.textAlign = 'center';
            ctx.fillText(p.text, p.x, p.y);
            ctx.restore();
        } else {
            // Normal explosion particle
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

function drawBackground() {
    // Canvas Backdrop Grid (Cyberpunk tactical radar feel)
    ctx.fillStyle = '#020208';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw starfield
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    starfield.forEach(s => {
        ctx.fillRect(s.x, s.y, s.size, s.size);
        // Scroll stars downward
        s.y += s.speed;
        if (s.y > CANVAS_HEIGHT) {
            s.y = 0;
            s.x = Math.random() * CANVAS_WIDTH;
        }
    });

    // Grid lines
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridSpacing = 40;
    
    for (let x = 0; x < CANVAS_WIDTH; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
    }

    // Outer warning border if player low health
    if (player && player.hp < 30) {
        const pulse = Math.abs(Math.sin(Date.now() * 0.007)) * 0.4;
        ctx.strokeStyle = `rgba(255, 59, 48, ${pulse})`;
        ctx.lineWidth = 8;
        ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
}

// 6. Spawn Logic
function spawnWave() {
    // Compute enemy configurations based on wave number
    const chaserCount = 3 + wave * 2;
    const cruiserCount = Math.floor(wave / 2);
    const asteroidCount = 1 + wave;

    // Helper: spawn out of boundaries
    const getSpawnPos = () => {
        // Spawns from top region or borders
        const x = Math.random() * CANVAS_WIDTH;
        const y = -50 - Math.random() * 150;
        return { x, y };
    };

    // Spawn Scouts/Chasers
    for (let i = 0; i < chaserCount; i++) {
        const pos = getSpawnPos();
        enemies.push({
            id: 'chaser_' + i + '_' + Date.now(),
            x: pos.x,
            y: pos.y,
            type: 'chaser',
            hp: 20 + wave * 2,
            maxHp: 20 + wave * 2,
            size: 12,
            speed: 2 + Math.min(2, wave * 0.15)
        });
    }

    // Spawn Cruisers
    for (let i = 0; i < cruiserCount; i++) {
        const pos = getSpawnPos();
        enemies.push({
            id: 'cruiser_' + i + '_' + Date.now(),
            x: pos.x,
            y: pos.y,
            type: 'cruiser',
            hp: 50 + wave * 5,
            maxHp: 50 + wave * 5,
            size: 22,
            speed: 0.8 + Math.min(1, wave * 0.08),
            lastShotTime: Date.now() + Math.random() * 2000
        });
    }

    // Spawn Asteroids
    for (let i = 0; i < asteroidCount; i++) {
        const x = Math.random() * CANVAS_WIDTH;
        const y = -100 - Math.random() * 200;
        
        // Random horizontal drift direction
        const vx = (Math.random() - 0.5) * 1.5;
        const vy = Math.random() * 0.6 + 0.4;
        
        enemies.push({
            id: 'asteroid_' + i + '_' + Date.now(),
            x: x,
            y: y,
            vx: vx,
            vy: vy,
            type: 'asteroid',
            hp: 40 + wave * 10,
            maxHp: 40 + wave * 10,
            size: 25,
            speed: 0.8
        });
    }

    logToAIConsole(`[WAVE START] คลื่นศัตรูระลอกที่ ${wave} ตรวจพบบริเวณเรดาร์!`, 'warn');
}

function spawnPowerup(x, y) {
    const types = ['SHIELD', 'SPEED', 'REPAIR'];
    const rType = types[Math.floor(Math.random() * types.length)];
    powerups.push({
        x: x || Math.random() * (CANVAS_WIDTH - 60) + 30,
        y: y || Math.random() * (CANVAS_HEIGHT / 2) + 50,
        type: rType,
        size: 10,
        vy: 0.6
    });
}

function spawnScrapExplosion(x, y, count) {
    for (let i = 0; i < count; i++) {
        scraps.push({
            x: x + (Math.random() - 0.5) * 10,
            y: y + (Math.random() - 0.5) * 10,
            size: 6,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4 - 1
        });
    }
}

function spawnParticles(x, y, color, count = 10, text = null, fontSize = 14) {
    if (text) {
        // Spawn single floating text element
        particles.push({
            x, y,
            color,
            text,
            fontSize,
            vx: 0,
            vy: -0.8,
            life: 1.0,
            decay: 0.02
        });
    } else {
        // Spawn sparks
        for (let i = 0; i < count; i++) {
            particles.push({
                x, y,
                color,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                size: Math.random() * 3 + 1,
                life: 1.0,
                decay: 0.02 + Math.random() * 0.03
            });
        }
    }
}

// 7. Core Update Loop
function updateGame() {
    // 7.1. Player Engine Trail Particles
    if (gameRunning && (Math.random() < 0.25)) {
        particles.push({
            x: player.x - Math.cos(player.angle) * 10,
            y: player.y - Math.sin(player.angle) * 10,
            color: 'rgba(0, 255, 255, 0.4)',
            vx: -Math.cos(player.angle) * 1.5 + (Math.random() - 0.5) * 0.5,
            vy: -Math.sin(player.angle) * 1.5 + (Math.random() - 0.5) * 0.5,
            size: Math.random() * 3 + 1,
            life: 0.6,
            decay: 0.04
        });
    }

    // 7.2. Player Controls (Keyboard) in Manual Mode
    if (mode === 'manual') {
        const speed = getPlayerStat('speed');
        
        let dx = 0;
        let dy = 0;
        
        if (keys['w'] || keys['arrowup']) dy -= 1;
        if (keys['s'] || keys['arrowdown']) dy += 1;
        if (keys['a'] || keys['arrowleft']) dx -= 1;
        if (keys['d'] || keys['arrowright']) dx += 1;
        
        // Normalize vector for diagonals
        if (dx !== 0 && dy !== 0) {
            dx *= 0.7071;
            dy *= 0.7071;
        }

        // Apply smooth movement
        player.vx = player.vx * 0.8 + dx * speed * 0.2;
        player.vy = player.vy * 0.8 + dy * speed * 0.2;
        
        player.x += player.vx;
        player.y += player.vy;

        // Angle faces the mouse
        const angleToMouse = Math.atan2(mouse.y - player.y, mouse.x - player.x);
        player.angle = angleToMouse;
    }

    // Border clamps
    player.x = Math.max(player.size, Math.min(CANVAS_WIDTH - player.size, player.x));
    player.y = Math.max(player.size, Math.min(CANVAS_HEIGHT - player.size, player.y));

    // 7.3. Handle Bullets
    bullets = bullets.filter(b => {
        b.x += b.vx;
        b.y += b.vy;
        
        // Boundary check
        if (b.x < 0 || b.x > CANVAS_WIDTH || b.y < 0 || b.y > CANVAS_HEIGHT) {
            return false;
        }

        // Collision logic
        if (b.fromPlayer) {
            // Hits Enemy
            for (let i = 0; i < enemies.length; i++) {
                const e = enemies[i];
                const dist = Math.hypot(b.x - e.x, b.y - e.y);
                if (dist < e.size) {
                    const dmg = getPlayerStat('damage');
                    e.hp -= dmg;
                    playSound('hit');
                    spawnParticles(b.x, b.y, '#00ffff', 4);
                    
                    if (e.hp <= 0) {
                        handleEnemyKilled(e);
                        enemies.splice(i, 1);
                    }
                    return false; // remove bullet
                }
            }
        } else {
            // Hits Player
            const dist = Math.hypot(b.x - player.x, b.y - player.y);
            if (dist < player.size) {
                damagePlayer(b.damage, b.x, b.y);
                return false; // remove bullet
            }
        }
        return true;
    });

    // 7.4. Handle Enemies
    enemies.forEach(e => {
        if (e.type === 'chaser') {
            // Aggressive direct chasing
            const dx = player.x - e.x;
            const dy = player.y - e.y;
            const dist = Math.hypot(dx, dy) || 1;
            
            e.x += (dx / dist) * e.speed;
            e.y += (dy / dist) * e.speed;
        } 
        else if (e.type === 'cruiser') {
            // Approaches player, hovers around, and shoots bullets
            const dx = player.x - e.x;
            const dy = player.y - e.y;
            const dist = Math.hypot(dx, dy) || 1;
            
            // Stay at medium range (200px)
            if (dist > 250) {
                e.x += (dx / dist) * e.speed;
                e.y += (dy / dist) * e.speed;
            } else if (dist < 150) {
                // Back off slightly
                e.x -= (dx / dist) * e.speed * 0.7;
                e.y -= (dy / dist) * e.speed * 0.7;
            } else {
                // Sideways orbit drifting
                e.x += (-dy / dist) * e.speed * 0.5;
                e.y += (dx / dist) * e.speed * 0.5;
            }

            // Keep inside boundaries loosely
            e.y += 0.2; // Slowly drifts down

            // Shooting logic
            if (Date.now() - e.lastShotTime > 2500) {
                e.lastShotTime = Date.now();
                
                // Shoot bullet towards player
                const bulletSpeed = 4;
                const angle = Math.atan2(player.y - e.y, player.x - e.x);
                bullets.push({
                    x: e.x,
                    y: e.y,
                    vx: Math.cos(angle) * bulletSpeed,
                    vy: Math.sin(angle) * bulletSpeed,
                    size: 5,
                    fromPlayer: false,
                    damage: 25
                });
                
                playSound('hit');
            }
        }
        else if (e.type === 'asteroid') {
            // Linear drifting path
            e.x += e.vx;
            e.y += e.vy;

            // Bounce off sides
            if (e.x < e.size || e.x > CANVAS_WIDTH - e.size) {
                e.vx = -e.vx;
            }
            // Recycle if drifts past bottom screen completely
            if (e.y > CANVAS_HEIGHT + 100) {
                e.y = -50;
                e.x = Math.random() * CANVAS_WIDTH;
            }
        }

        // Contact Damage to Player
        const dist = Math.hypot(e.x - player.x, e.y - player.y);
        if (dist < player.size + e.size) {
            let contactDmg = 15;
            if (e.type === 'cruiser') contactDmg = 25;
            if (e.type === 'asteroid') contactDmg = 20;
            
            damagePlayer(contactDmg, e.x, e.y);
            
            // Bounce impact
            const pushAngle = Math.atan2(player.y - e.y, player.x - e.x);
            player.vx = Math.cos(pushAngle) * 8;
            player.vy = Math.sin(pushAngle) * 8;
        }
    });

    // 7.5. Collectibles & Magnets
    // Magnet scraps towards player
    scraps.forEach(s => {
        s.x += s.vx;
        s.y += s.vy;
        
        // Add physics drag / friction
        s.vx *= 0.95;
        s.vy *= 0.95;

        // Magnet range (120px)
        const dist = Math.hypot(player.x - s.x, player.y - s.y);
        if (dist < 120) {
            const pullForce = 0.5 + (120 - dist) * 0.08;
            s.x += ((player.x - s.x) / dist) * pullForce;
            s.y += ((player.y - s.y) / dist) * pullForce;
        }
    });

    // Scrap collection
    scraps = scraps.filter(s => {
        const dist = Math.hypot(player.x - s.x, player.y - s.y);
        if (dist < player.size + s.size) {
            const amount = Math.floor(Math.random() * 2) + 1; // 1-2 Scrap
            scrap += amount;
            score += amount * 10;
            playSound('powerup');
            spawnParticles(s.x, s.y, '#39ff14', 1, `+${amount} SCRAP`, 11);
            updateHUD();
            return false;
        }
        return true;
    });

    // Powerups movement
    powerups.forEach(p => {
        p.y += p.vy;
    });

    // Powerups collection
    powerups = powerups.filter(p => {
        const dist = Math.hypot(player.x - p.x, player.y - p.y);
        if (dist < player.size + p.size) {
            applyPowerup(p.type);
            spawnParticles(p.x, p.y, '#ffffff', 12);
            return false;
        }
        // Remove if off screen
        if (p.y > CANVAS_HEIGHT + 20) return false;
        return true;
    });

    // 7.6. Particles update
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        
        // Fade opacity logic represented inside color string is complex,
        // so we'll just handle it during draw or drop particles that expire.
        return p.life > 0;
    });

    // 7.7. Check Wave Over Condition
    if (enemies.length === 0 && gameRunning) {
        wave += 1;
        updateHUD();
        spawnWave();
        
        // Spawn a repair kit as wave bonus
        spawnPowerup(CANVAS_WIDTH / 2, 80);
        playSound('upgrade');
        spawnParticles(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '#ffcc00', 1, `WAVE ${wave} STARTED!`, 20);
    }
}

// 8. Damage & Powerup Handler functions
function damagePlayer(amount, hitX, hitY) {
    if (player.shieldActive) {
        playSound('shield_hit');
        spawnParticles(hitX || player.x, hitY || player.y, '#00ffff', 6);
        spawnParticles(player.x, player.y - 20, '#00ffff', 1, "SHIELD BLOCKED", 11);
        return;
    }

    player.hp -= amount;
    playSound('hit');
    spawnParticles(hitX || player.x, hitY || player.y, '#ff3b30', 12);
    spawnParticles(player.x, player.y - 20, '#ff3b30', 1, `-${amount} HP`, 12);
    
    // Low health alarm sound trigger locally if HP dips low
    if (player.hp <= 30) {
        logToAIConsole("🚨 แจ้งเตือน! โครงสร้างยานเสียหายหนัก! พลังชีวิตต่ำ!", "warn");
    }

    updateHUD();

    if (player.hp <= 0) {
        endGame('LOSING');
    }
}

function applyPowerup(type) {
    playSound('powerup');
    if (type === 'SHIELD') {
        player.shieldActive = true;
        const dur = getPlayerStat('shield');
        player.shieldExpiryTime = Date.now() + dur;
        logToAIConsole("🛡️ [SYSTEM] เปิดใช้งานเกราะบาเรียป้องกันความเสียหาย (" + (dur/1000).toFixed(1) + " วินาที)");
        spawnParticles(player.x, player.y - 25, '#00ffff', 1, "SHIELD ACTIVE!", 14);
    } 
    else if (type === 'SPEED') {
        // Give short double fire-rate & extreme speed boost
        logToAIConsole("⚡ [SYSTEM] กระตุ้นเตาปฏิกรณ์ฟิวชัน เพิ่มความเร็วปืนและยานชั่วคราว");
        spawnParticles(player.x, player.y - 25, '#ffcc00', 1, "SPEED OVERDRIVE!", 14);
        
        const originalLvl = upgrades.speed.lvl;
        const originalFr = upgrades.firerate.lvl;
        
        // Temp upgrade boosts
        upgrades.speed.lvl = Math.min(5, upgrades.speed.lvl + 2);
        upgrades.firerate.lvl = Math.min(5, upgrades.firerate.lvl + 2);
        
        setTimeout(() => {
            if (gameRunning) {
                upgrades.speed.lvl = originalLvl;
                upgrades.firerate.lvl = originalFr;
                logToAIConsole("⚡ [SYSTEM] สิ้นสุดการ Overdrive เตาปฏิกรณ์ฟิวชัน");
            }
        }, 6000);
    }
    else if (type === 'REPAIR') {
        const healAmt = 35;
        player.hp = Math.min(player.maxHp, player.hp + healAmt);
        logToAIConsole("💚 [SYSTEM] ทำการดูดซับนาโนบอทเพื่อซ่อมแซมตัวถัง (+35 HP)");
        spawnParticles(player.x, player.y - 25, '#39ff14', 1, "+35 HULL REPAIR", 14);
    }
    updateHUD();
}

function handleEnemyKilled(e) {
    kills += 1;
    let baseScore = 100;
    let scrapReward = 1;
    
    if (e.type === 'chaser') {
        baseScore = 80;
        scrapReward = 1;
    } else if (e.type === 'cruiser') {
        baseScore = 250;
        scrapReward = 3;
    } else if (e.type === 'asteroid') {
        baseScore = 120;
        scrapReward = 2;
        
        // Asteroid Splitting mechanic: Spawn 2 smaller drifting asteroids
        for (let i = 0; i < 2; i++) {
            const angle = (i === 0 ? 0.8 : -0.8) + Math.atan2(e.vy, e.vx);
            const speed = 1.6;
            enemies.push({
                id: 'asteroid_split_' + Date.now() + '_' + i + '_' + Math.random(),
                x: e.x,
                y: e.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                type: 'asteroid',
                hp: 15,
                maxHp: 15,
                size: 13,
                speed: 1.5
            });
        }
        logToAIConsole("☄️ อุกกาบาตแตกออกเป็นชิ้นส่วนย่อย!");
    }

    score += baseScore;
    playSound('explosion');
    spawnParticles(e.x, e.y, e.type === 'chaser' ? '#ff3b30' : e.type === 'cruiser' ? '#bd00ff' : '#7c7c8c', 15);
    
    // Spawn float text
    spawnParticles(e.x, e.y - 15, '#ffcc00', 1, `+${baseScore}`, 12);
    
    // Spawn scrap physically
    spawnScrapExplosion(e.x, e.y, scrapReward);

    // Random chance to drop a direct Powerup block (12%)
    if (Math.random() < 0.12) {
        spawnPowerup(e.x, e.y);
    }

    updateHUD();
}

// 9. AI Control and Fallback Decider Telemetry Proxy
async function queryFastAPIServer() {
    // Collect game state to send to backend
    const state = {
        player_x: player.x,
        player_y: player.y,
        enemy_x: enemies.length > 0 ? enemies[0].x : CANVAS_WIDTH / 2, // nearest coordinates
        enemy_y: enemies.length > 0 ? enemies[0].y : 0,
        player_hp: player.hp,
        enemy_hp: enemies.length > 0 ? enemies[0].hp : 0,
        score: score,
        difficulty_level: wave
    };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600); // Tight timeout so fallback kicks in quickly
        
        // Use relative URL when served from the FastAPI backend (Railway / any host).
        // Fall back to localhost only when opening the HTML file directly via file://.
        const apiBase = window.location.protocol === 'file:'
            ? 'http://localhost:8000'
            : '';
        const res = await fetch(apiBase + '/api/game_turn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error("HTTP-Error: " + res.status);
        const data = await res.json();
        
        // Update Indicator to Green
        const statusDot = document.getElementById('status-dot');
        statusDot.className = 'status-dot online';
        document.getElementById('status-text').textContent = 'API ONLINE';
        
        return data;
    } catch (e) {
        // API Offline: Switch indicator to yellow (Local fallback)
        const statusDot = document.getElementById('status-dot');
        statusDot.className = 'status-dot local';
        document.getElementById('status-text').textContent = 'LOCAL AI (FALLBACK)';
        
        return null;
    }
}

// Local steering AI algorithm
function calculateLocalAISteering() {
    let moveDirX = 0;
    let moveDirY = 0;
    let debugMessage = "ตรวจสอบความปลอดภัย...";

    // 9a. Avoid dangerous bullets
    let threatBullet = null;
    let minBulletDist = 120; // evade threshold
    bullets.forEach(b => {
        if (!b.fromPlayer) {
            const dist = Math.hypot(b.x - player.x, b.y - player.y);
            if (dist < minBulletDist) {
                minBulletDist = dist;
                threatBullet = b;
            }
        }
    });

    if (threatBullet) {
        // Flee from bullet (vector pointing away from bullet direction)
        const dx = player.x - threatBullet.x;
        const dy = player.y - threatBullet.y;
        const dist = Math.hypot(dx, dy) || 1;
        moveDirX = (dx / dist);
        moveDirY = (dy / dist);
        
        // Dodge sideways to bullet velocity is better
        const perpX = -threatBullet.vy;
        const perpY = threatBullet.vx;
        const pDist = Math.hypot(perpX, perpY) || 1;
        moveDirX += (perpX / pDist) * 0.8;
        moveDirY += (perpY / pDist) * 0.8;
        
        debugMessage = "⚠️ [EVADE] ตรวจพบกระสุนพลาสมา! กำลังเบี่ยงวิถีเพื่อหลบหลีก";
    }
    // 9b. Flee from extremely close enemies (within 90px)
    else {
        let threatEnemy = null;
        let minEnemyDist = 90;
        enemies.forEach(e => {
            const dist = Math.hypot(e.x - player.x, e.y - player.y);
            if (dist < minEnemyDist) {
                minEnemyDist = dist;
                threatEnemy = e;
            }
        });

        if (threatEnemy) {
            const dx = player.x - threatEnemy.x;
            const dy = player.y - threatEnemy.y;
            const dist = Math.hypot(dx, dy) || 1;
            moveDirX = dx / dist;
            moveDirY = dy / dist;
            debugMessage = `⚠️ [EVADE] ศัตรูประชิดตัวเกินไป! บินหนีจาก ${threatEnemy.type}`;
        }
        // 9c. Seek critical powerups (Nanite Heal if low, Shields if shield inactive)
        else {
            let targetItem = null;
            let targetDist = Infinity;
            
            powerups.forEach(p => {
                const dist = Math.hypot(p.x - player.x, p.y - player.y);
                if (p.type === 'REPAIR' && player.hp < 60) {
                    if (dist < targetDist) {
                        targetDist = dist;
                        targetItem = p;
                    }
                }
                if (p.type === 'SHIELD' && !player.shieldActive) {
                    if (dist < targetDist) {
                        targetDist = dist;
                        targetItem = p;
                    }
                }
            });

            // 9d. Seek Scrap or Powerups under normal state
            if (!targetItem) {
                // Seek nearest scrap
                scraps.forEach(s => {
                    const dist = Math.hypot(s.x - player.x, s.y - player.y);
                    if (dist < targetDist) {
                        targetDist = dist;
                        targetItem = s;
                    }
                });
                // Fallback to seeking any powerup
                if (!targetItem && powerups.length > 0) {
                    powerups.forEach(p => {
                        const dist = Math.hypot(p.x - player.x, p.y - player.y);
                        if (dist < targetDist) {
                            targetDist = dist;
                            targetItem = p;
                        }
                    });
                }
            }

            if (targetItem) {
                const dx = targetItem.x - player.x;
                const dy = targetItem.y - player.y;
                const dist = Math.hypot(dx, dy) || 1;
                moveDirX = dx / dist;
                moveDirY = dy / dist;
                debugMessage = `🎯 [SEEK] กำลังเคลื่อนตัวไปเก็บ: ${targetItem.type || 'SCRAP'}`;
            } else {
                // If idle, cruise near lower center area of arena
                const dx = CANVAS_WIDTH / 2 - player.x;
                const dy = (CANVAS_HEIGHT * 0.75) - player.y;
                const dist = Math.hypot(dx, dy) || 1;
                if (dist > 50) {
                    moveDirX = dx / dist;
                    moveDirY = dy / dist;
                    debugMessage = "🛡️ [STANDBY] ลาดตระเวนพื้นที่ส่วนกลางและรักษาความมั่นคง";
                }
            }
        }
    }

    // Aiming calculation (Always aim at the closest enemy to destroy them)
    let closestEnemy = null;
    let closestDist = Infinity;
    enemies.forEach(e => {
        const dist = Math.hypot(e.x - player.x, e.y - player.y);
        if (dist < closestDist) {
            closestDist = dist;
            closestEnemy = e;
        }
    });

    let targetAngle = player.angle;
    let shouldShoot = false;
    if (closestEnemy) {
        targetAngle = Math.atan2(closestEnemy.y - player.x, closestEnemy.x - player.x); // Wait, fix typo in coordinates!
        // CORRECTION:
        targetAngle = Math.atan2(closestEnemy.y - player.y, closestEnemy.x - player.x);
        shouldShoot = true;
    }

    return {
        moveX: moveDirX,
        moveY: moveDirY,
        angle: targetAngle,
        shoot: shouldShoot,
        message: debugMessage
    };
}

function processAICmd(aiCmd) {
    if (!aiCmd) {
        // Fallback steering
        const localDecision = calculateLocalAISteering();
        applySteeringToPlayer(localDecision);
        return;
    }

    // Process commands coming from FastAPI server
    let dx = 0;
    let dy = 0;
    
    // Convert text actions into directions
    const action = aiCmd.ai_command;
    if (action === 'MOVE_LEFT') dx = -1;
    else if (action === 'MOVE_RIGHT') dx = 1;
    else if (action === 'MOVE_UP') dy = -1;
    else if (action === 'MOVE_DOWN') dy = 1;
    
    // Calculate steering based on these directional flags
    const speed = getPlayerStat('speed');
    player.vx = player.vx * 0.8 + dx * speed * 0.2;
    player.vy = player.vy * 0.8 + dy * speed * 0.2;
    
    player.x += player.vx;
    player.y += player.vy;

    // Aim at closest enemy when under remote AI control
    let closestEnemy = null;
    let closestDist = Infinity;
    enemies.forEach(e => {
        const dist = Math.hypot(e.x - player.x, e.y - player.y);
        if (dist < closestDist) {
            closestDist = dist;
            closestEnemy = e;
        }
    });

    if (closestEnemy) {
        player.angle = Math.atan2(closestEnemy.y - player.y, closestEnemy.x - player.x);
        // Autoshot check
        const reloadTime = getPlayerStat('firerate');
        if (Date.now() - player.lastShotTime > reloadTime) {
            firePlayerLaser();
        }
    }

    if (aiCmd.message) {
        logToAIConsole(`[REMOTE AI] ${aiCmd.message}`);
    }
}

function applySteeringToPlayer(decision) {
    const speed = getPlayerStat('speed');
    
    // Apply steering forces
    player.vx = player.vx * 0.8 + decision.moveX * speed * 0.2;
    player.vy = player.vy * 0.8 + decision.moveY * speed * 0.2;
    
    player.x += player.vx;
    player.y += player.vy;

    player.angle = decision.angle;

    // Fire laser if steering demands it and reload time allows
    if (decision.shoot) {
        const reloadTime = getPlayerStat('firerate');
        if (Date.now() - player.lastShotTime > reloadTime) {
            firePlayerLaser();
        }
    }

    // Print steering decisions logs (throttled to avoid scroll-flooding)
    if (Math.random() < 0.04) {
        logToAIConsole(decision.message);
    }
}

// 10. Fire Blaster
function firePlayerLaser() {
    player.lastShotTime = Date.now();
    
    // Laser spawns at ship tip
    const laserTipX = player.x + Math.cos(player.angle) * 18;
    const laserTipY = player.y + Math.sin(player.angle) * 18;
    
    const bulletSpeed = 9;
    bullets.push({
        x: laserTipX,
        y: laserTipY,
        vx: Math.cos(player.angle) * bulletSpeed,
        vy: Math.sin(player.angle) * bulletSpeed,
        size: 3,
        fromPlayer: true,
        damage: getPlayerStat('damage')
    });
    
    playSound('laser');
}

// 11. Game Main Loop Tick
function tick() {
    if (!gameRunning) return;

    drawBackground();
    
    if (mode === 'ai') {
        queryFastAPIServer().then(aiCmd => {
            processAICmd(aiCmd);
            updateGame();
            
            drawCollectibles();
            drawProjectiles();
            drawEnemies();
            drawPlayer();
            drawParticles();
            
            requestAnimationFrame(tick);
        });
    } else {
        // Manual mode: Standard synchronous loop
        updateGame();
        
        drawCollectibles();
        drawProjectiles();
        drawEnemies();
        drawPlayer();
        drawParticles();
        
        requestAnimationFrame(tick);
    }
}

// 12. UI Panel Updates
function updateHUD() {
    document.getElementById('hud-hp').textContent = `${player.hp} / ${player.maxHp}`;
    document.getElementById('hud-wave').textContent = wave;
    document.getElementById('hud-scrap').textContent = `${scrap} 💰`;
    document.getElementById('hud-score').textContent = score;
    document.getElementById('hud-kills').textContent = kills;
    document.getElementById('hud-shield-status').textContent = player.shieldActive ? 'ACTIVE' : 'OFFLINE';
    document.getElementById('hud-shield-status').className = player.shieldActive ? 'stat-value highlight-cyan' : 'stat-value';

    // Upgrade buttons disabled/enabled status and cost text updates
    Object.keys(upgrades).forEach(key => {
        const lvl = upgrades[key].lvl;
        const max = upgrades[key].max;
        const btn = document.getElementById(`upgrade-${key}-btn`);
        const costLabel = document.getElementById(`cost-${key}`);
        const statLabel = document.getElementById(`stat-${key}`);
        
        statLabel.textContent = lvl >= max ? 'MAX' : `Lvl: ${lvl}`;
        
        const cost = getUpgradeCost(key);
        if (cost === Infinity) {
            costLabel.textContent = '---';
            btn.disabled = true;
        } else {
            costLabel.textContent = `${cost} 💰`;
            btn.disabled = (scrap < cost || !gameRunning);
        }
    });
}

function logToAIConsole(text, type = 'normal') {
    const consoleLog = document.getElementById('console-log');
    if (!consoleLog) return;

    const line = document.createElement('div');
    line.className = 'console-line';
    if (type === 'warn') line.className += ' warn';
    if (type === 'server') line.className += ' server';
    
    // Add timestamps
    const now = new Date();
    const timeStr = `[${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}] `;
    
    line.textContent = timeStr + text;
    consoleLog.appendChild(line);

    // Limit lines inside scroll box
    while (consoleLog.childNodes.length > 35) {
        consoleLog.removeChild(consoleLog.firstChild);
    }
    consoleLog.scrollTop = consoleLog.scrollHeight;
}

function endGame(result) {
    gameRunning = false;
    playSound('gameover');
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.fillStyle = '#ff3b30';
    ctx.font = 'bold 36px \'Orbitron\', sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px \'Inter\', sans-serif';
    ctx.fillText(`คะแนนรวม: ${score} | ทำลายยานรบข้าศึก: ${kills}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10);
    ctx.fillText(`สะสม Scrap ได้: ${scrap} 💰 | ด่านสูงสุด: ${wave}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
    ctx.fillText(`กด 'เริ่มการเชื่อมต่อระบบ' เพื่อแก้ตัวใหม่อีกครั้ง`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 90);
    
    document.getElementById('start-button').textContent = 'เชื่อมต่อยานรบอีกครั้ง';
    logToAIConsole("🚨 [ALERT] การเชื่อมต่อกับยานรบขาดหาย! โครงสร้างเสียหายเกินเยียวยา", "warn");
    updateHUD();
}

// 13. Event Listeners & Bindings
window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    
    // Manual shoot using Spacebar
    if (e.key === ' ' && mode === 'manual' && gameRunning) {
        e.preventDefault(); // prevent scroll
        const reloadTime = getPlayerStat('firerate');
        if (Date.now() - player.lastShotTime > reloadTime) {
            firePlayerLaser();
        }
    }
});

window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    // Scale coords back to canvas default 800x600 resolution
    mouse.x = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width);
    mouse.y = (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height);
});

canvas.addEventListener('mousedown', e => {
    if (mode === 'manual' && gameRunning) {
        const reloadTime = getPlayerStat('firerate');
        if (Date.now() - player.lastShotTime > reloadTime) {
            firePlayerLaser();
        }
    }
});

// Primary start game control trigger
document.getElementById('start-button').addEventListener('click', () => {
    initAudio();
    resetGame();
    gameRunning = true;
    document.getElementById('start-button').textContent = 'เชื่อมต่อระบบใหม่';
    tick();
});

// Mode Controls
document.getElementById('mode-manual-btn').addEventListener('click', () => {
    mode = 'manual';
    document.getElementById('mode-manual-btn').className = 'toggle-btn active';
    document.getElementById('mode-ai-btn').className = 'toggle-btn';
    logToAIConsole("🧑‍🚀 [SYSTEM] โอนย้ายการควบคุมสู่ผู้ปฏิบัติการมนุษย์ (MANUAL ENGINE)");
});

document.getElementById('mode-ai-btn').addEventListener('click', () => {
    mode = 'ai';
    document.getElementById('mode-manual-btn').className = 'toggle-btn';
    document.getElementById('mode-ai-btn').className = 'toggle-btn active';
    logToAIConsole("🤖 [SYSTEM] โอนย้ายการควบคุมสู่โครงข่ายปัญญาประดิษฐ์ (AI AUTOPILOT)");
});

// Upgrades purchase triggers
Object.keys(upgrades).forEach(key => {
    document.getElementById(`upgrade-${key}-btn`).addEventListener('click', () => {
        const cost = getUpgradeCost(key);
        if (scrap >= cost && upgrades[key].lvl < upgrades[key].max) {
            scrap -= cost;
            upgrades[key].lvl += 1;
            playSound('upgrade');
            spawnParticles(player.x, player.y - 25, '#39ff14', 1, `SYSTEM UPGRADED: ${key.toUpperCase()}`, 13);
            logToAIConsole(`🔧 [UPGRADE] พัฒนาระบบ ${key.toUpperCase()} สู่ระดับ ${upgrades[key].lvl}`);
            updateHUD();
        }
    });
});

// Sound toggler
document.getElementById('sound-btn').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('sound-btn');
    btn.textContent = soundEnabled ? '🔊' : '🔇';
    logToAIConsole("🔊 [AUDIO] ระบบเสียงได้รับการ " + (soundEnabled ? "เปิดใช้งาน" : "ปิดใช้งาน"));
});