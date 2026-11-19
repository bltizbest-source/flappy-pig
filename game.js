const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreDisplay = document.getElementById('score-display');
const finalScoreDisplay = document.getElementById('final-score');
const startHighscoreDisplay = document.getElementById('start-highscore');
const gameoverHighscoreDisplay = document.getElementById('gameover-highscore');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Game State
let gameState = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let highscore = 0;
try {
    highscore = Number(localStorage.getItem('flappyPigHighScore')) || 0;
} catch { /* Session scoring still works when storage is unavailable. */ }
let frames = 0;
let animationId;

// Physics / Mechanics Constants
const GRAVITY = 0.25;
const FLAP_FORCE = -5.5;
let CW = 400;
const CH = 600;

function resizeGame() {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;

    // The vertical course stays constant. A wider viewport reveals more gates.
    const previousWidth = CW;
    CW = CH * width / height;
    const anchor = CW * 0.2;
    const shift = anchor - pig.x;
    pig.x = anchor;
    for (const gate of obstacles.list) gate.x += shift;
    obstacles.nextX += shift;

    for (const cloud of bg.clouds) cloud.x *= CW / previousWidth;
    bg.fitClouds();
    if (gameState === 'PLAYING') obstacles.fillCourse();

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(canvas.width / CW, 0, 0, canvas.height / CH, 0, 0);
    draw();
}

// --- GAME ENTITIES ---

const pig = {
    x: 80,
    y: CH / 2,
    radius: 15,
    velocity: 0,
    flapAngle: 0,
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Rotation based on velocity
        let rotation = Math.min((this.velocity * 0.1), Math.PI / 4);
        ctx.rotate(rotation);

        // Draw Pig Body (Pink)
        ctx.fillStyle = '#ff9bcc';
        ctx.beginPath();
        // Slightly oval
        ctx.ellipse(0, 0, 20, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#d66ba8';
        ctx.stroke();

        // Pig Snout
        ctx.fillStyle = '#ff66aa';
        ctx.beginPath();
        ctx.ellipse(16, 2, 6, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Snout holes
        ctx.fillStyle = '#cc0066';
        ctx.beginPath();
        ctx.arc(14, 0, 1.5, 0, Math.PI*2);
        ctx.arc(18, 0, 1.5, 0, Math.PI*2);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(8, -5, 5, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(10, -5, 2, 0, Math.PI*2);
        ctx.fill();

        // Wing
        // Flap animation based on frames
        let wingY = (frames % 20 < 10) ? -8 : 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(-5, wingY, 10, 6, -Math.PI/6, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#cccccc';
        ctx.stroke();

        ctx.restore();
    },
    update() {
        this.velocity += GRAVITY;
        this.y += this.velocity;

        // Ground collision (approx)
        if (this.y + 20 >= CH - 50) { 
            this.y = CH - 50 - 20;
            triggerGameOver();
        }
        
        // Ceiling collision
        if (this.y - 20 <= 0) {
            this.y = 20;
            this.velocity = 0;
        }
    },
    flap() {
        this.velocity = FLAP_FORCE;
        playFlapSound();
    },
    reset() {
        this.y = CH / 2;
        this.velocity = 0;
    }
};

const obstacles = {
    list: [],
    lastCenter: CH / 2,
    nextX: 400,
    width: 60,
    get dx() { return 2.25 + 0.55 * Math.min(score / 24, 1); },
    draw() {
        for (let i = 0; i < this.list.length; i++) {
            let p = this.list[i];
            
            ctx.fillStyle = '#cd853f'; // Wood/barn color
            ctx.strokeStyle = '#8b4513';
            ctx.lineWidth = 4;

            // Top Pipe
            ctx.fillRect(p.x, 0, this.width, p.top);
            ctx.strokeRect(p.x, 0, this.width, p.top);

            // Roof texture (simple lines)
            ctx.beginPath();
            ctx.moveTo(p.x, p.top - 10);
            ctx.lineTo(p.x + this.width, p.top - 10);
            ctx.stroke();

            // Bottom Pipe
            let bottomY = p.top + p.gap;
            let bottomHeight = CH - bottomY - 50; // 50 is ground height
            ctx.fillRect(p.x, bottomY, this.width, bottomHeight);
            ctx.strokeRect(p.x, bottomY, this.width, bottomHeight);
            
            // Roof texture
            ctx.beginPath();
            ctx.moveTo(p.x, bottomY + 10);
            ctx.lineTo(p.x + this.width, bottomY + 10);
            ctx.stroke();
        }
    },
    fillCourse() {
        while (this.nextX <= CW + this.width) {
            const gap = 183 - 23 * Math.min(score / 24, 1);
            this.lastCenter = Math.max(150, Math.min(400, this.lastCenter + (Math.random() - 0.5) * 104));
            this.list.push({ x: this.nextX, top: this.lastCenter - gap / 2, gap, passed: false });
            this.nextX += 260;
        }
    },
    update() {
        this.fillCourse();
        this.nextX -= this.dx;

        for (let i = 0; i < this.list.length; i++) {
            let p = this.list[i];
            p.x -= this.dx;

            // Collision Detection
            // Pig bounding box (approx 30x24)
            let pigLeft = pig.x - 15;
            let pigRight = pig.x + 15;
            let pigTop = pig.y - 12;
            let pigBot = pig.y + 12;

            // Top Pipe BB
            if (pigRight > p.x && pigLeft < p.x + this.width && pigTop < p.top) {
                return triggerGameOver();
            }
            // Bottom Pipe BB
            let bottomY = p.top + p.gap;
            if (pigRight > p.x && pigLeft < p.x + this.width && pigBot > bottomY) {
                return triggerGameOver();
            }

            // Score update
            if (p.x + this.width < pigLeft && !p.passed) {
                p.passed = true;
                score++;
                scoreDisplay.innerText = score;
                playScoreSound();
                

            }

            // Remove offscreen
            if (p.x + this.width < 0) {
                this.list.shift();
                i--;
            }
        }
    },
    reset() {
        this.list = [];
        this.lastCenter = CH / 2;
        this.nextX = pig.x + 320;
        this.fillCourse();
    }
};

const bg = {
    bgX: 0,
    clouds: [],
    fitClouds() {
        const count = Math.max(3, Math.ceil(CW / 85));
        this.clouds.length = Math.min(count, this.clouds.length);
        while (this.clouds.length < count) {
            this.clouds.push({
                x: Math.random() * CW,
                y: Math.random() * (CH / 2),
                size: Math.random() * 20 + 20,
                speed: Math.random() * 0.5 + 0.2
            });
        }
    },
    draw() {
        // Sky gradient
        let gradient = ctx.createLinearGradient(0, 0, 0, CH);
        gradient.addColorStop(0, "#87CEEB");
        gradient.addColorStop(1, "#E0F6FF");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CW, CH);

        // Clouds
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for(let i=0; i<this.clouds.length; i++){
            let c = this.clouds[i];
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.size, 0, Math.PI*2);
            ctx.arc(c.x + c.size*0.8, c.y - c.size*0.3, c.size*0.8, 0, Math.PI*2);
            ctx.arc(c.x + c.size*1.6, c.y, c.size, 0, Math.PI*2);
            ctx.fill();
        }

        // Scrolling Grass/Ground
        ctx.fillStyle = '#7CFC00'; // LawnGreen
        ctx.fillRect(0, CH - 50, CW, 50);
        ctx.fillStyle = '#228B22'; // ForestGreen top border
        ctx.fillRect(0, CH - 50, CW, 10);
        
        // Grass details
        ctx.fillStyle = '#32CD32';
        for(let i=0; i<=CW/40 + 1; i++){
            ctx.fillRect(i*40 + this.bgX, CH-40, 5, 20);
            ctx.fillRect(i*40 + this.bgX + 15, CH-30, 5, 10);
        }
    },
    update() {
        this.bgX = (this.bgX - obstacles.dx) % 40;
        for(let i=0; i<this.clouds.length; i++){
            let c = this.clouds[i];
            c.x -= c.speed;
            if(c.x + c.size*2 < 0) {
                c.x = CW + c.size*2;
                c.y = Math.random() * (CH / 2);
            }
        }
    }
};

// --- AUDIO SYNTHESIS ---
let audioCtx;

function playFlapSound() {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function playScoreSound() {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
}

function playCrashSound() {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
}

// --- GAME LOOP & CONTROLS ---

function draw() {
    ctx.clearRect(0, 0, CW, CH);
    bg.draw();
    obstacles.draw();
    pig.draw();
}

function update() {
    bg.update();
    pig.update();
    if (gameState === 'PLAYING') obstacles.update();
}

const stepMs = 1000 / 60;
let previousTime = null;
let elapsed = 0;

function loop(now) {
    if (gameState !== 'PLAYING') return;
    elapsed += previousTime === null ? 0 : Math.min(now - previousTime, 64);
    previousTime = now;
    while (elapsed >= stepMs && gameState === 'PLAYING') {
        update();
        frames++;
        elapsed -= stepMs;
    }
    draw();
    if (gameState === 'PLAYING') animationId = requestAnimationFrame(loop);
}

document.addEventListener('visibilitychange', () => {
    previousTime = null;
    elapsed = 0;
});

function triggerGameOver() {
    gameState = 'GAMEOVER';
    playCrashSound();
    cancelAnimationFrame(animationId);
    
    // Update highscore
    if (score > highscore) {
        highscore = score;
        try { localStorage.setItem('flappyPigHighScore', highscore); } catch {}
    }
    
    finalScoreDisplay.innerText = score;
    gameoverHighscoreDisplay.innerText = highscore;
    gameOverScreen.classList.remove('hidden');
}

function startGame() {
    gameState = 'PLAYING';
    score = 0;
    frames = 0;
    scoreDisplay.innerText = score;
    pig.reset();
    obstacles.reset();
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (Audio) audioCtx ||= new Audio();
        if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => {});
    } catch {}
    pig.flap();
    elapsed = 0;
    previousTime = null;
    draw();
    animationId = requestAnimationFrame(loop);
}

document.getElementById('game-container').addEventListener('pointerdown', e => {
    if (!e.isPrimary || e.button !== 0 || e.target.closest('button')) return;
    if (gameState === 'PLAYING') pig.flap();
    else if (gameState === 'START') startGame();
});

window.addEventListener('keydown', e => {
    if (e.code !== 'Space') return;
    e.preventDefault();
    if (e.repeat) return;
    if (gameState === 'PLAYING') pig.flap();
    else startGame();
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Initialize Highscore on load
startHighscoreDisplay.innerText = highscore;

// Initial Draw
resizeGame();
new ResizeObserver(resizeGame).observe(canvas);
window.addEventListener('resize', resizeGame);

// Cache the game shell for future offline visits on supported browsers.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
}
