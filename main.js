/* main.js
   Single-file game logic separated from HTML/CSS.
   Free — no purchases, simple assets (programmatic).
*/

(() => {
  // Canvas + context
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let W = canvas.width, H = canvas.height;

  // UI
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const speedEl = document.getElementById('speed');
  const restartBtn = document.getElementById('restart');
  const overlay = document.getElementById('overlay');
  const overlayRestart = document.getElementById('overlay-restart');
  const overlayTitle = document.getElementById('overlay-title');
  const overlaySub = document.getElementById('overlay-sub');

  // State
  const lanes = [W*0.25, W*0.5, W*0.75];
  let player = { lane:1, x:lanes[1], y:H-80, width:36, height:48, vy:0, groundY:H-80, isJumping:false };
  let obstacles = [], coins = [], powerups = [], particles = [];
  let running = false;
  let score = 0;
  let best = Number(localStorage.getItem('runner_best') || 0);
  let speed = 4; // base
  let difficultyTimer = 0;
  let spawnTick = 0;
  let activePower = { magnet:false, double:false, shield:false, timer:0 };

  bestEl.textContent = best;

  // Minimal sound placeholders (tiny silent audio) to avoid network
  const sndCoin = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAAAA');
  const sndJump = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAAAA');
  const sndHit  = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAAAA');

  // Helper spawn functions
  function spawnObstacle(){
    const lane = Math.floor(Math.random()*3);
    const kind = Math.random()<0.8 ? 'barrel' : 'box';
    obstacles.push({ lane, x: W + 80 + Math.random()*120, y: H-86, w: kind==='barrel'?34:54, h: kind==='barrel'?34:20, kind });
  }
  function spawnCoin(){
    const lane = Math.floor(Math.random()*3);
    coins.push({ lane, x: W + 80 + Math.random()*240, y: H-120, r:10, wobble:Math.random()*Math.PI*2 });
  }
  function spawnPower(){
    const lane = Math.floor(Math.random()*3);
    const types = ['magnet','double','shield'];
    powerups.push({ lane, x: W + 80 + Math.random()*300, y: H-140, size:16, type: types[Math.floor(Math.random()*types.length)] });
  }
  function addParticle(x,y){
    particles.push({ x, y, vy: -1 - Math.random()*1.2, life:30 + Math.random()*30 });
  }

  // Game lifecycle
  function startGame(){
    obstacles = []; coins = []; powerups = []; particles = [];
    player.lane = 1; player.x = lanes[1]; player.y = player.groundY; player.vy = 0; player.isJumping = false;
    score = 0; speed = 4; running = true; activePower = { magnet:false,double:false,shield:false,timer:0 };
    overlay.classList.add('hidden');
  }
  function endGame(){
    running = false;
    overlay.classList.remove('hidden');
    overlayTitle.textContent = 'Game Over';
    overlaySub.textContent = 'Tekan Restart untuk mulai lagi — Semua gratis';
    if(score > best){ best = Math.floor(score); localStorage.setItem('runner_best', best); bestEl.textContent = best; }
  }

  // Controls
  function moveLeft(){ if(!running) return; player.lane = Math.max(0, player.lane-1); player.x = lanes[player.lane]; }
  function moveRight(){ if(!running) return; player.lane = Math.min(2, player.lane+1); player.x = lanes[player.lane]; }
  function jump(){ if(!running) return; if(player.isJumping) return; player.isJumping = true; player.vy = -9; sndJump.play().catch(()=>{}); }

  // Touch (tap & swipe)
  let touchStart = null;
  canvas.addEventListener('touchstart', e=>{ e.preventDefault(); const t = e.changedTouches[0]; touchStart = { x:t.clientX, y:t.clientY, t:Date.now() }; });
  canvas.addEventListener('touchend', e=>{ e.preventDefault(); const t = e.changedTouches[0]; if(!touchStart) return; const dx = t.clientX - touchStart.x; const dy = t.clientY - touchStart.y; const dt = Date.now()-touchStart.t;
    if(Math.abs(dx) < 25 && Math.abs(dy) < 25 && dt < 300){ // tap
      const rect = canvas.getBoundingClientRect();
      if((t.clientX - rect.left) < rect.width/2) moveLeft(); else moveRight();
    } else {
      if(Math.abs(dx) > Math.abs(dy)){ if(dx>0) moveRight(); else moveLeft(); } else { if(dy < 0) jump(); }
    }
    touchStart = null;
  });

  // Mouse click: left/right halves
  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if(x < rect.width/2) moveLeft(); else moveRight();
  });

  // Keyboard
  window.addEventListener('keydown', e => {
    if(e.key === 'ArrowLeft') moveLeft();
    if(e.key === 'ArrowRight') moveRight();
    if(e.key === 'ArrowUp' || e.key === ' ') jump();
    if(e.key.toLowerCase() === 'r') startGame();
  });

  restartBtn.addEventListener('click', startGame);
  overlayRestart.addEventListener('click', startGame);

  // Update loop
  let last = performance.now();
  function update(dt){
    if(!running) return;

    // difficulty & spawns
    spawnTick += dt;
    difficultyTimer += dt;
    if(spawnTick > 0.8){
      spawnTick = 0;
      if(Math.random() < 0.9) spawnObstacle();
      if(Math.random() < 0.6) spawnCoin();
      if(Math.random() < 0.12) spawnPower();
    }
    // speed ramp
    speed += dt * 0.02;
    // move obstacles & collisions
    for(let i = obstacles.length-1; i >= 0; i--){
      const o = obstacles[i];
      o.x -= speed * dt * 60;
      if(o.lane === player.lane){
        const px = player.x, py = player.y, pw = player.width, ph = player.height;
        const ox = o.x, oy = o.y, ow = o.w, oh = o.h;
        if(px + pw/2 > ox - ow/2 && px - pw/2 < ox + ow/2 && py + ph > oy){
          // collision
          if(activePower.shield){ activePower.shield = false; activePower.timer = 0; obstacles.splice(i,1); }
          else { sndHit.play().catch(()=>{}); endGame(); return; }
        }
      }
      if(o.x < -120) obstacles.splice(i,1);
    }
    // coins
    for(let i = coins.length-1; i >= 0; i--){
      const c = coins[i];
      // magnet effect: attract to player if active
      if(activePower.magnet && c.lane !== player.lane){
        // do nothing; to keep simple, magnet only works same lane
      }
      c.x -= speed * dt * 60;
      if(c.lane === player.lane){
        const dx = Math.abs(c.x - player.x);
        const dy = Math.abs(c.y - (player.y - player.height/2));
        if(dx < 30 && dy < 40){
          score += activePower.double ? 20 : 10;
          sndCoin.play().catch(()=>{});
          for(let p=0;p<6;p++) addParticle(c.x, c.y);
          coins.splice(i,1);
        }
      }
      if(c.x < -60) coins.splice(i,1);
    }
    // powerups
    for(let i = powerups.length-1; i >= 0; i--){
      const p = powerups[i];
      p.x -= speed * dt * 60;
      if(p.lane === player.lane && Math.abs(p.x - player.x) < 30){
        activePower[p.type] = true;
        activePower.timer = 300; // frames-ish
        powerups.splice(i,1);
      }
      if(p.x < -60) powerups.splice(i,1);
    }
    // power timer
    if(activePower.timer > 0){
      activePower.timer -= dt * 60;
      if(activePower.timer <= 0){ activePower = { magnet:false,double:false,shield:false,timer:0 }; }
    }
    // player physics
    if(player.isJumping){
      player.vy += 0.6 * dt * 60; // gravity scaled
      player.y += player.vy * dt * 60;
      if(player.y >= player.groundY){ player.y = player.groundY; player.vy = 0; player.isJumping = false; }
    }
    // particles
    for(let i = particles.length-1; i >= 0; i--){
      const p = particles[i];
      p.y += p.vy;
      p.life--;
      if(p.life <= 0) particles.splice(i,1);
    }

    // score increases with distance
    score += speed * dt * 8;
    // update UI
    scoreEl.textContent = Math.floor(score);
    speedEl.textContent = (speed / 4).toFixed(2);
  }

  // Render
  function drawRoad(){
    const roadTop = H - 120, roadBottom = H - 24;
    ctx.fillStyle = '#2c2f33';
    ctx.fillRect(0, roadTop, W, roadBottom - roadTop);
    // lane separators (stylized)
    for(let i=0;i<3;i++){
      const x = lanes[i];
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x - 60, roadTop + 40, 120, 6);
    }
  }
  function drawPlayer(){
    ctx.save();
    ctx.beginPath(); ctx.ellipse(player.x, player.groundY + player.height/1.6, 30, 8, 0, 0, Math.PI*2); ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fill();
    ctx.fillStyle = '#ff6b6b'; ctx.fillRect(player.x - player.width/2, player.y - player.height, player.width, player.height);
    ctx.fillStyle = '#ffe66d'; ctx.fillRect(player.x - 12, player.y - player.height - 18, 24, 18);
    ctx.fillStyle = '#4ecdc4'; ctx.fillRect(player.x + player.width/2 - 6, player.y - player.height + 6, 8, 14);
    ctx.restore();
  }
  function drawObstacles(){
    for(const o of obstacles){
      const x = o.x, y = o.y;
      ctx.save(); ctx.translate(x,y);
      if(o.kind === 'barrel'){
        ctx.fillStyle = '#7a5230'; ctx.fillRect(-o.w/2, -o.h/2, o.w, o.h);
        ctx.fillStyle = '#5b3b29'; ctx.fillRect(-o.w/2, -o.h/2 + 6, o.w, 6);
      } else {
        ctx.fillStyle = '#333'; ctx.fillRect(-o.w/2, -o.h/2, o.w, o.h);
      }
      ctx.restore();
    }
  }
  function drawCoins(){
    for(const c of coins){
      c.wobble += 0.08;
      const wy = Math.sin(c.wobble) * 4;
      ctx.beginPath(); ctx.arc(c.x, c.y + wy, c.r, 0, Math.PI*2); ctx.fillStyle = '#ffd166'; ctx.fill();
      ctx.beginPath(); ctx.arc(c.x-3, c.y-2 + wy, 2.5, 0, Math.PI*2); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
    }
  }
  function drawPowerups(){
    for(const p of powerups){
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
      const map = { magnet:'#ff3366', double:'#33ccff', shield:'#66ff66' };
      ctx.fillStyle = map[p.type] || '#fff'; ctx.fill();
    }
  }
  function drawParticles(){
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for(const p of particles) ctx.fillRect(p.x, p.y, 3, 3);
  }

  function render(){
    // clear
    ctx.clearRect(0,0,W,H);
    // sky & ground
    ctx.fillStyle = '#4db6e6'; ctx.fillRect(0,0,W,H-160);
    ctx.fillStyle = '#2d6a4f'; ctx.fillRect(0,H-160,W,60);

    drawRoad();
    drawCoins();
    drawObstacles();
    drawPowerups();
    drawParticles();
    drawPlayer();

    if(!running){
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Klik Restart untuk mulai', W/2, H/2);
    }
  }

  // Main loop
  function loop(t){
    const now = t || performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }
  last = performance.now();

  // Responsive: adjust lanes if canvas resizes (kept simple)
  function recalc(){
    // keep canvas logical size fixed to simplify gameplay; skip scaling
  }
  window.addEventListener('resize', recalc);

  // Pre-spawn some objects for demo feel
  for(let i=0;i<3;i++) spawnObstacle();
  for(let i=0;i<4;i++) spawnCoin();

  // Start
  startGame();
  requestAnimationFrame(loop);
})();
