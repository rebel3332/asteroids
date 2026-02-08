(function(){
    console.log('game.js loaded');
    const canvas = document.getElementById('gameCanvas');
    const scoreEl = document.getElementById('score');
    const overlay = document.getElementById('overlay');
    const finalScore = document.getElementById('final-score');
    const restartBtn = document.getElementById('restart');
    const nameForm = document.getElementById('name-form');
    const nameInput = document.getElementById('name-input');
    const submitName = document.getElementById('submit-name');
    const lbPanel = document.getElementById('leaderboard-panel');
    const lbList = document.getElementById('leaderboard-list');
    const showLbBtn = document.getElementById('show-leaderboard');
    const closeLbBtn = document.getElementById('close-leaderboard');

    const ctx = canvas.getContext('2d');
    let w = 0, h = 0;

    // Load cityscape image
    let cityscapeImg = new Image();
    cityscapeImg.onload = function() {
        console.log('City image loaded');
    };
    cityscapeImg.onerror = function() {
        console.warn('City image failed to load');
    };
    cityscapeImg.src = '/static/city.png';
    // Звук выстрела лазера
    const laserSound = new Audio('/static/laser.wav');
    laserSound.volume = 0.3;
    // Звук взрыва астеройда
    const explosionSound = new Audio('/static/explosion.wav');
    explosionSound.volume = 0.2;


    function resize() { 
        w = canvas.width = window.innerWidth; 
        h = canvas.height = window.innerHeight; 
    }
    window.addEventListener('resize', resize); 
    resize();

    let asteroids = [];
    let lastSpawn = performance.now();
    let spawnInterval = 800;
    let running = true;
    let score = 0;
    let particles = [];
    let gameElapsedTime = 0; // for spotlight animation
    let turretAngle = -Math.PI / 2; // смотрит вверх по умолчанию
    let lasers = []; // лазерные лучи

    function rand(a,b){return Math.random()*(b-a)+a}

    function spawn(){
        const r = rand(14, 44);
        const vx = rand(-0.5, 0.5);
        asteroids.push({x: rand(r, w-r), y: -r, r, vy: rand(1.2,3)+score*0.01, vx, angle: rand(0,Math.PI*2), spin: rand(-0.03,0.03)});
    }

    function update(dt){
        gameElapsedTime += dt; // Track time for animations
        // Проверка уничтожения астеройда лазерами
        for(let i = lasers.length - 1; i >= 0; i--){
            const l = lasers[i];
            l.t += dt;

            l.x += Math.cos(l.angle) * l.speed * dt * 0.001;
            l.y += Math.sin(l.angle) * l.speed * dt * 0.001;

            // Проверка попадания в астероиды
            for(let j = asteroids.length - 1; j >= 0; j--){
                const a = asteroids[j];
                const dx = l.x - a.x;
                const dy = l.y - a.y;

                if(dx*dx + dy*dy <= a.r * a.r){
                // УНИЧТОЖАЕМ
                asteroids.splice(j, 1);
                lasers.splice(i, 1);

                explosionSound.currentTime = 0;
                explosionSound.play().catch(()=>{});

                score += 1;
                scoreEl.textContent = 'Очки: ' + score;
                break;
                }
            }

            // Удаляем лазер, если вышел за экран или устарел
            if(
                l.t > l.life ||
                l.x < 0 || l.x > w ||
                l.y < 0 || l.y > h
            ){
                lasers.splice(i, 1);
            }
    }

        // update asteroids
        for(let i=asteroids.length-1;i>=0;i--){
            const a = asteroids[i];
            a.y += a.vy * dt * 0.06;
            a.x += a.vx * dt * 0.06;
            a.angle += a.spin * dt * 0.06;
            
            // Wrap around horizontally (left/right edges)
            // if(a.x + a.r < 0) a.x = w + a.r;
            // if(a.x - a.r > w) a.x = -a.r;
            
            // Улетел за пределы экрана — удаляем
            if(
                a.x + a.r < 0 ||
                a.x - a.r > w
            ){
                asteroids.splice(i, 1);
                continue;
            }
        
            // em it smoke trail particles (realistic black smoke)
            for(let j = 0; j < 3; j++){
                particles.push({
                x: a.x + rand(-a.r*0.3, a.r*0.3), 
                y: a.y + rand(-a.r*0.3, a.r*0.3),
                vx: rand(-0.3, 0.3), 
                vy: rand(-0.2, 0.2),
                life: 800 + Math.random()*600,
                t: 0,
                size: a.r * (0.15 + Math.random()*0.2),
                type: 'smoke'
                });
            }
            if(a.y - a.r > h){ gameOver(); return; }
        }

        // update particles
        for(let i=particles.length-1;i>=0;i--){
        const p = particles[i];
        p.t += dt;
        p.x += p.vx * dt * 0.06;
        p.y += p.vy * dt * 0.06 + 0.02 * dt * 0.06;
        if(p.t > p.life) particles.splice(i,1);
        }

        //Обновление лазеров
        for(let i = lasers.length - 1; i >= 0; i--){
            const l = lasers[i];
            l.t += dt;

            l.x += Math.cos(l.angle) * l.speed * dt * 0.001;
            l.y += Math.sin(l.angle) * l.speed * dt * 0.001;

            if(
                l.t > l.life ||
                l.x < 0 || l.x > w ||
                l.y < 0 || l.y > h
            ){
                lasers.splice(i, 1);
            }
        }

    }

    function draw(){
        ctx.clearRect(0,0,w,h);
        // background
        const bgGrad = ctx.createLinearGradient(0,0,0,h);
        bgGrad.addColorStop(0,'#081026');
        bgGrad.addColorStop(1,'#00111a');
        ctx.fillStyle = bgGrad; ctx.fillRect(0,0,w,h);

        // draw spotlights (behind city)
        drawSpotlights();

        // draw red pulsing glow behind city
        drawRedGlowBehindCity();
        // draw city (behind particles and meteors)
        drawCityscape();
        // Рисую турель поверх города, чтобы она была на переднем плане, но позади метеоров и частиц дыма
        drawTurret();
        // Рисую лазеры поверх турели
        drawLasers();

        // draw particles (smoke trail: dark gray/black)
        for(const p of particles){
        const lifeRatio = 1 - (p.t / p.life);
        ctx.beginPath();
        // smoke: starts light gray, darkens to black, expands then fades
        const opacity = 0.6 * lifeRatio;
        const grayVal = Math.floor(140 - 100 * (1 - lifeRatio)); // starts light, goes dark
        ctx.fillStyle = `rgba(${grayVal},${grayVal},${grayVal},${opacity})`;
        ctx.arc(p.x, p.y, Math.max(2, p.size * (1 + lifeRatio*0.5)), 0, Math.PI*2);
        ctx.fill();
        }

        // draw asteroids as meteors (foreground)
        for(const a of asteroids){
        drawMeteor(a);
        }
    }

    function drawCityscape(){
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        for(const building of buildings){
            ctx.fillRect(building.x, h - building.height, building.width, building.height);
            // windows
            ctx.fillStyle = 'rgba(255,255,100,0.3)';
            for(let wy = 0; wy < building.height - 10; wy += 15){
                for(let wx = building.x + 8; wx < building.x + building.width; wx += 12){
                    ctx.fillRect(wx, h - building.height + wy, 8, 8);
                }
            }
            ctx.fillStyle = 'rgba(0,0,0,0.9)';
        }
    }

    function drawMeteor(a){
        // body - rocky/stone appearance
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.angle);
        const bodyGrad = ctx.createRadialGradient(-a.r*0.3, -a.r*0.3, a.r*0.1, 0,0,a.r);
        bodyGrad.addColorStop(0, '#a0a0a0');
        bodyGrad.addColorStop(0.3, '#808080');
        bodyGrad.addColorStop(0.7, '#505050');
        bodyGrad.addColorStop(1, '#2a2a2a');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.moveTo(-a.r*0.6, -a.r*0.2);
        ctx.quadraticCurveTo(0, -a.r, a.r*0.7, -a.r*0.1);
        ctx.quadraticCurveTo(a.r*0.9, a.r*0.3, 0, a.r*0.9);
        ctx.quadraticCurveTo(-a.r*0.8, a.r*0.4, -a.r*0.6, -a.r*0.2);
        ctx.fill();
        // darker outline for definition
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
    }

    function drawTurret(){
        const x = w / 2;
        const y = h - 30; //h * 0.25;
        const barrelLength = 50;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(turretAngle);

        // ствол
        ctx.fillStyle = '#555';
        ctx.fillRect(0, -6, barrelLength, 12);

        // дульный срез
        ctx.fillStyle = '#333';
        ctx.fillRect(barrelLength - 4, -8, 8, 16);

        ctx.restore();

        // основание
        ctx.beginPath();
        ctx.fillStyle = '#222';
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.fill();
        }


    function drawSpotlights(){
        // Draw yellow spotlight beams from ground upward with animated tilt
        const spotlightCount = 2;
        const spotLightSpacing = w / spotlightCount;
        const beamHeight = h * 0.4; // Высота луча - 40% от высоты экрана
        const beamWidthBottom = beamHeight * 0.00075; // узкий у основания
        const beamWidthTop = beamHeight * 0.2; // широкий вверху
        const centerTiltAngle = 0; // Начальный угол наклона лучей к центру (25 градусов)
        const maxOutwardAngle = 30; // Максимальный угол отклонения от центра (60 градусов)
        const oscillationPeriod = 3000; // milliseconds for full cycle
        
        // Calculate oscillating angle: starts at center (25°), swings outward (60°), back to center
        const oscillation = Math.sin(gameElapsedTime / oscillationPeriod * Math.PI * 2);
        const currentAngle = centerTiltAngle + (maxOutwardAngle - centerTiltAngle) * oscillation;
        const currentAngleRad = currentAngle * Math.PI / 180;
        
        for(let i = 0; i < spotlightCount; i++){
        const x = (i + 0.5) * spotLightSpacing;
        // Left beam tilts toward center (-angle), right beam tilts toward center (+angle) initially
        const angleDir = i === 0 ? -1 : 1;
        const tiltAmount = beamHeight * Math.tan(currentAngleRad * angleDir);
        
        // Create gradient for spotlight beam
        const grad = ctx.createLinearGradient(x, h, x + tiltAmount, h - beamHeight);
        grad.addColorStop(0, 'rgba(255, 220, 100, 0.3)');
        grad.addColorStop(0.5, 'rgba(255, 200, 80, 0.15)');
        grad.addColorStop(1, 'rgba(255, 200, 80, 0)');
        
        // Draw spotlight beam as trapezoid (narrow at bottom, wide at top)
        ctx.fillStyle = grad;
        ctx.beginPath();
        // Bottom: narrow base
        ctx.moveTo(x - beamWidthBottom, h);
        ctx.lineTo(x + beamWidthBottom, h);
        // Top: wide base (expanding outward with tilt)
        ctx.lineTo(x + tiltAmount + beamWidthTop, h - beamHeight);
        ctx.lineTo(x + tiltAmount - beamWidthTop, h - beamHeight);
        ctx.closePath();
        ctx.fill();
        }
    }

    function drawRedGlowBehindCity(){
        if(!(cityscapeImg.complete && cityscapeImg.naturalHeight > 0)) return;

        const imgHeight = h * 0.25;
        const imgWidth = (cityscapeImg.naturalWidth / cityscapeImg.naturalHeight) * imgHeight;
        const imgX = (w - imgWidth) / 2;
        const imgY = h - imgHeight;

        // Настройки пульсации
        const pulseSpeed = 100;    // скорость пульсации (мс)
        const alphaMin = 0.3;      // минимальная прозрачность
        const alphaMax = 0.7;      // максимальная прозрачность

        const t = (Math.sin(gameElapsedTime / pulseSpeed) + 1) / 2;
        const glowAlpha = alphaMin + (alphaMax - alphaMin) * t;

        // Линейный градиент сверху вниз (исчезает сверху)
        const grad = ctx.createLinearGradient(0, imgY, 0, h);
        grad.addColorStop(0, 'rgba(255,0,0,0)');            // верх – прозрачный
        grad.addColorStop(0.5, `rgba(255,0,0,${glowAlpha * 0.5})`); // середина – полупрозрачный
        grad.addColorStop(1, `rgba(255,0,0,${glowAlpha})`);         // низ – яркий

        ctx.fillStyle = grad;
        ctx.fillRect(imgX - imgWidth*0.2, imgY - imgHeight*0.2, imgWidth*1.4, imgHeight*1.4);
    }


    function drawLasers(){
        for(const l of lasers){
        ctx.save();

        ctx.strokeStyle = 'rgba(255, 230, 120, 0.9)';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(255, 220, 100, 0.8)';
        ctx.shadowBlur = 15;

        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(
            l.x - Math.cos(l.angle) * 30,
            l.y - Math.sin(l.angle) * 30
        );
        ctx.stroke();

        ctx.restore();
        }
    }

    function drawCityscape(){
        // Draw cityscape image at the bottom of screen
        if(cityscapeImg.complete && cityscapeImg.naturalHeight > 0){
        const imgHeight = h * 0.25; // Cityscape takes 25% of screen height
        const imgWidth = (cityscapeImg.naturalWidth / cityscapeImg.naturalHeight) * imgHeight;
        const imgX = (w - imgWidth) / 2; // Center it
        const imgY = h - imgHeight;
        ctx.drawImage(cityscapeImg, imgX, imgY, imgWidth, imgHeight);
        } else {
        // Fallback: black rectangle if image hasn't loaded
        ctx.fillStyle = '#000';
        ctx.fillRect(0, h - h * 0.25, w, h * 0.25);
        }
    }

    let last = performance.now();
    function frame(t){
        let dt = t - last; if (!isFinite(dt) || dt <= 0) dt = 16; dt = Math.min(dt, 100);
        last = t;
        if(!running) return;
        if(t - lastSpawn > spawnInterval){ spawn(); lastSpawn = t; spawnInterval = Math.max(350, 800 - score*3); }
        update(dt);
        draw();
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

    function getPos(e){
        const rect = canvas.getBoundingClientRect();
        if(e.touches) e = e.touches[0];
        return {x: clamp(e.clientX - rect.left,0,w), y: clamp(e.clientY - rect.top,0,h)};
    }

    function hit(pos){
        // Турель
        const turretX = w / 2;
        const turretY = h - 30;// - h * 0.25; // чуть выше города
        turretAngle = Math.atan2(
            pos.y - turretY,
            pos.x - turretX
        );

        // Лазеры
        const barrelLength = 50;
        const lx = turretX + Math.cos(turretAngle) * barrelLength;
        const ly = turretY + Math.sin(turretAngle) * barrelLength;


        lasers.push({
            x: lx,
            y: ly,
            angle: turretAngle,
            speed: 1200,
            life: 600,
            t: 0
        });
        laserSound.currentTime = 0;
        laserSound.play();


        // Перенес проверку ничтожения асторойда в update, теперь астеройд уничтожается лазером
        // Проверка попадания по метеорам
        // for(let i=asteroids.length-1;i>=0;i--){
        //   const a = asteroids[i];
        //   const dx = pos.x - a.x, dy = pos.y - a.y;
        //   if(dx*dx+dy*dy <= a.r*a.r){ asteroids.splice(i,1); score += 1; scoreEl.textContent = 'Очки: '+score; return; }
        // }


    }

    canvas.addEventListener('click', e => hit(getPos(e)));
    canvas.addEventListener('touchstart', e => { hit(getPos(e)); e.preventDefault(); });

    function gameOver(){
        running = false;
        finalScore.textContent = 'Очки: ' + score;
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
        overlay.style.pointerEvents = 'auto';
        checkLeaderboardEligibility();
    }

    restartBtn.addEventListener('click', ()=>{
        overlay.classList.add('hidden'); overlay.style.display = 'none'; overlay.style.pointerEvents = 'none'; asteroids=[]; score=0; scoreEl.textContent='Очки: 0'; running=true; last = performance.now(); lastSpawn = performance.now(); requestAnimationFrame(frame);
    });

    async function checkLeaderboardEligibility(){
        try{
        const res = await fetch('/leaderboard');
        const top = await res.json();
        if(top.length < 5 || score > (top[top.length-1].score||0)){
            nameForm.classList.remove('hidden');
            nameForm.style.display = 'block';
        }
        }catch(e){ console.warn(e); }
    }

    submitName.addEventListener('click', async ()=>{
        const name = nameInput.value.trim() || 'Anonymous';
        try{
        const res = await fetch('/submit_score',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,score})});
        const j = await res.json();
        nameForm.classList.add('hidden');
        nameForm.style.display = 'none';
        fetchLeaderboard();
        }catch(e){console.warn(e);} 
    });

    async function fetchLeaderboard(){
        try{
        const res = await fetch('/leaderboard');
        const top = await res.json();
        lbList.innerHTML = '';
        top.forEach(row=>{ const li=document.createElement('li'); li.textContent = `${row.name} — ${row.score}`; lbList.appendChild(li); });
        lbPanel.classList.remove('hidden');
        lbPanel.style.display = 'block';
        }catch(e){console.warn(e);} 
    }

    showLbBtn.addEventListener('click', fetchLeaderboard);
    closeLbBtn.addEventListener('click', ()=> { lbPanel.classList.add('hidden'); lbPanel.style.display = 'none'; });

})();
