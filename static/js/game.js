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

    const menuBtn = document.getElementById('menu-btn');
    const menuPanel = document.getElementById('menu-panel');
    const volumeSlider = document.getElementById('volume-slider');
    // Запуск игры при нажатии на кнопку "Начать игру"
    const startScreen = document.getElementById('start-screen');
    const startBtn = document.getElementById('start-btn');

    startBtn.addEventListener('click', ()=>{
        // Скрываем стартовый экран
        startScreen.style.display = 'none';

        resetGameState();

        running = true;
        playBgMusic();
        requestAnimationFrame(frame);
    });

    // Открытие/закрытие меню
    menuBtn.addEventListener('click', ()=>{
        if(menuPanel.style.display === 'none'){
            menuPanel.style.display = 'block';
        } else {
            menuPanel.style.display = 'none';
        }
    });

    // Изменение громкости
    volumeSlider.addEventListener('input', (e)=>{
        const vol = parseFloat(e.target.value);
        laserSound.volume = basic_laser_volume * vol;
        explosionSound.volume = basic_explosion_volume * vol;
        bgMusic.volume = basic_bg_volume * vol; // музыка тоже регулируется
        localStorage.setItem('gameVolume', vol);
    });


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
    const basic_laser_volume = 0.3;
    laserSound.volume = basic_laser_volume * 0.1;
    // Звук взрыва астеройда
    const explosionSound = new Audio('/static/explosion.wav');
    const basic_explosion_volume = 0.2;
    explosionSound.volume = basic_explosion_volume * 0.1;
    // Фоновая музыка
    const bgMusic = new Audio('/static/bgm.mp3');
    const basic_bg_volume = 0.1;
    bgMusic.loop = true; // зацикливаем
    bgMusic.volume = basic_bg_volume * 0.1; // начальная громкость


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
    // Скорость спавна встеройдов
    let spawnInterval_start = 800;
    let spawnInterval_current = spawnInterval_start;
    let spawnInterval_increase = 0.06; // скорость увеличения скорости спавна
    // Скорость полета астеройдов
    let asteroid_start_speed = 0.01;
    let asteroids_speed_increase = 0.00015; // скорость увеличения сложности
    let asteroids_speed_current = asteroid_start_speed;

    // Счетчики призов
    let prizeProgress = 0;
    const PRIZE_THRESHOLD = 10;
    // Колдаун для красного приза
    let lastRedPrizeTime = 0;
    const RED_PRIZE_COOLDOWN = 40000; // 15 сек

    let particles = [];
    let gameElapsedTime = 0; // for spotlight animation
    // let turretAngle = -Math.PI / 2; // смотрит вверх по умолчанию
    let turrets = []; // Массив всех турелей: [0] = основная (игрок), [1+] = автоматические
    let lasers = []; // лазерные лучи
    let bgMusicStarted = false; // флаг для отслеживания начала музыки
    let prizes = []; // Призы

    function rand(a,b){return Math.random()*(b-a)+a}

    function playBgMusic(){
        if(!bgMusicStarted){
            bgMusic.play().catch(()=>{}); // catch, чтобы ошибки на мобильных не мешали
            bgMusicStarted = true;
        }
    }


    function spawn(){
        const r = rand(24, 44);
        const vx = rand(-0.5, 0.5);
        asteroids.push(
            {
                x: rand(r, w-r), 
                y: -r, 
                r, 
                vy: rand(1.2,3) + asteroids_speed_current, 
                vx, 
                angle: rand(0,Math.PI*2), 
                spin: rand(-0.03,0.03)});
    }

    function spawnPrize(x, y) {
        // const isRedPrize = Math.random() < 0.5;
        const now = performance.now();
        let isRedPrize = false;
        if (now - lastRedPrizeTime > RED_PRIZE_COOLDOWN) {
            isRedPrize = true; // Math.random() < 0.4;
            if (isRedPrize) lastRedPrizeTime = now;
        }
        prizes.push({
            x,
            y,
            r: 18,
            vy: isRedPrize ? 2.2 : 1.8,
            rotation: 0,
            rotationSpeed: 0.05,
            glow: 0,
            glowSpeed: 0.02,
            type: isRedPrize ? 'red' : 'gold'
        });
    }

    function update(dt, currentTime){
        gameElapsedTime += dt; // Track time for animations
        asteroids_speed_current += asteroids_speed_increase;
        spawnInterval_current -= spawnInterval_increase;
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

                // explosionSound.currentTime = 0;
                // explosionSound.play().catch(()=>{});
                // Взрыв
                explodeAsteroid(a);

                score += 1;
                scoreEl.textContent = 'Очки: ' + score;

                // прогресс приза
                prizeProgress++;

                if (prizeProgress >= PRIZE_THRESHOLD) {
                    prizeProgress -= PRIZE_THRESHOLD;

                    spawnPrize(a.x, a.y);
                }

                // Спавн приза
                // if (score % 10 === 0) {
                //     // 30% шанс на красный приз, 70% на золотой
                //     const isRedPrize = Math.random() < 0.5;
                //     prizes.push({
                //         x: a.x,
                //         y: a.y,
                //         r: 18,
                //         vy: isRedPrize ? 2.2 : 1.8, // Красные падают быстрее
                //         rotation: 0,
                //         rotationSpeed: 0.05,
                //         glow: 0,
                //         glowSpeed: 0.02,
                //         type: isRedPrize ? 'red' : 'gold' // Ключевое поле для различия
                //     });
                // }

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

            // Гравитация для каменных осколков
            if(p.type === 'rock'){
                const gravity = 0.1; // сила тяжести, можно регулировать
                p.vy += gravity * dt * 0.06;
            }

            p.x += p.vx * dt * 0.06;
            p.y += p.vy * dt * 0.06;

            if(p.t > p.life) particles.splice(i,1);
        }

        // Автоматическая стрельба для дополнительных турелей
        for (let i = 1; i < turrets.length; i++) {
            const turret = turrets[i];
            
            // Собираем ВСЕ астероиды в радиусе 400px
            const candidates = [];
            for (const a of asteroids) {
                const dx = a.x - turret.x;
                const dy = a.y - turret.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 400) {
                    candidates.push({ asteroid: a, dist: dist });
                }
            }
            
            // Если есть цели — выбираем СЛУЧАЙНУЮ из ближайших 3
            let target = null;
            if (candidates.length > 0) {
                // Сортируем по расстоянию
                candidates.sort((a, b) => a.dist - b.dist);
                // Берём случайную из первых 3 (или меньше, если целей мало)
                const maxCandidates = Math.min(3, candidates.length);
                const randomIndex = Math.floor(Math.random() * maxCandidates);
                target = candidates[randomIndex].asteroid;
            }
            
            // Если цель есть и прошёл кулдаун
            if (target && (currentTime - turret.lastShot) > turret.cooldown) {
                turret.angle = Math.atan2(target.y - turret.y, target.x - turret.x);
                
                // Выстрел
                const barrelLength = 50;
                lasers.push({
                    x: turret.x + Math.cos(turret.angle) * barrelLength,
                    y: turret.y + Math.sin(turret.angle) * barrelLength,
                    angle: turret.angle,
                    speed: 1000,
                    life: 700,
                    t: 0
                });
                
                // Звук
                try {
                    const autoSound = laserSound.cloneNode();
                    autoSound.volume = basic_laser_volume * 0.08;
                    autoSound.play().catch(() => {});
                } catch (e) {}
                
                turret.lastShot = currentTime;
            }
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

        // Обновление призов
        for (let i = prizes.length - 1; i >= 0; i--) {
            const p = prizes[i];
            
            // Анимация падения
            p.y += p.vy * dt * 0.06;
            p.rotation += p.rotationSpeed * dt * 0.06;
            
            // Анимация свечения
            p.glow += p.glowSpeed * dt * 0.06;
            if (p.glow > 1) {
                p.glow = 1;
                p.glowSpeed = -0.02;
            } else if (p.glow < 0.3) {
                p.glow = 0.3;
                p.glowSpeed = 0.02;
            }
            
            // Удаление приза при выходе за экран
            if (p.y > h + p.r) {
                prizes.splice(i, 1);
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
        // Рисую призы
        drewPrize();
        // Рисую лазеры поверх турели
        drawLasers();

        // draw particles (smoke trail: dark gray/black)
        for(const p of particles){
            const lifeRatio = 1 - (p.t / p.life);
            ctx.beginPath();
            let opacity = lifeRatio;

            if(p.type === 'smoke'){
                const grayVal = Math.floor(140 - 100 * (1 - lifeRatio));
                ctx.fillStyle = `rgba(${grayVal},${grayVal},${grayVal},${opacity * 0.6})`;
            } else if(p.type === 'rock'){
                const grayVal = Math.floor(100 + 50 * lifeRatio);
                ctx.fillStyle = `rgba(${grayVal},${grayVal},${grayVal},${opacity})`;
            } else if(p.type === 'fire'){
                const r = Math.floor(255);
                const g = Math.floor(150 * lifeRatio);
                ctx.fillStyle = `rgba(${r},${g},0,${opacity})`;
            } else if(p.type === 'redFire'){
                const r = Math.floor(255);
                const g = Math.floor(60 * lifeRatio);
                const b = Math.floor(60 * lifeRatio);
                ctx.fillStyle = `rgba(${r},${g},${b},${opacity * 1.2})`; // Ярче
            }

            ctx.arc(p.x, p.y, Math.max(1, p.size * (1 + lifeRatio*0.5)), 0, Math.PI*2);
            ctx.fill();
        }

        // draw asteroids as meteors (foreground)
        for(const a of asteroids){
        drawMeteor(a);
        }
    }

    function drewPrize(){
        // Draw prizes
        for (const p of prizes) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r);
            
            if (p.type === 'red') {
                // Красный приз: насыщенный градиент
                gradient.addColorStop(0, `rgba(255, 80, 80, ${p.glow * 1.2})`);
                gradient.addColorStop(0.6, `rgba(220, 40, 40, ${p.glow * 0.8})`);
                gradient.addColorStop(1, `rgba(180, 0, 0, 0)`);
            } else {
                // Золотой приз (оригинальный)
                gradient.addColorStop(0, `rgba(255, 220, 0, ${p.glow})`);
                gradient.addColorStop(0.7, `rgba(255, 200, 0, ${p.glow * 0.6})`);
                gradient.addColorStop(1, `rgba(255, 150, 0, 0)`);
            }
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, p.r, 0, Math.PI * 2);
            ctx.fill();
            
            // Контур: адаптивный под цвет
            ctx.strokeStyle = p.type === 'red' 
                ? `rgba(255, 200, 200, ${p.glow * 0.7})` 
                : `rgba(255, 255, 200, ${p.glow * 0.8})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Добавляем "искрящийся" эффект для красного приза
            if (p.type === 'red') {
                ctx.beginPath();
                ctx.arc(0, 0, p.r * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${p.glow * 0.3})`;
                ctx.fill();
            }
            
            ctx.restore();
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
        for (const turret of turrets) {
            ctx.save();
            ctx.translate(turret.x, turret.y);
            ctx.rotate(turret.angle);

            // Ствол
            ctx.fillStyle = '#555';
            ctx.fillRect(0, -6, 50, 12);
            
            // Дульный срез
            ctx.fillStyle = '#333';
            ctx.fillRect(46, -8, 8, 16);
            
            ctx.restore();

            // Основание: зелёное для игрока, красное для автоматических
            ctx.beginPath();
            ctx.fillStyle = turret.isPlayer ? '#4a4' : '#a44';
            ctx.arc(turret.x, turret.y, 18, 0, Math.PI * 2);
            ctx.fill();
            
            // Индикатор перезарядки (тонкий круг)
            if (!turret.isPlayer) {
                const reloadProgress = Math.min(1, (performance.now() - turret.lastShot) / turret.cooldown);
                ctx.beginPath();
                ctx.arc(turret.x, turret.y, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * reloadProgress);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
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

    function explodeAsteroid(a){
        const pieces = Math.floor(a.r / 2); // количество осколков зависит от размера астероида

        for(let i = 0; i < pieces; i++){
            // Каменные осколки
            particles.push({
                x: a.x,
                y: a.y,
                vx: rand(-2,2),
                vy: rand(-2,2),
                life: 400 + Math.random() * 400,
                t: 0,
                size: rand(a.r*0.1, a.r*0.4),
                type: 'rock'
            });

            // Огненные искры
            particles.push({
                x: a.x,
                y: a.y,
                vx: rand(-3,3),
                vy: rand(-3,3),
                life: 300 + Math.random() * 300,
                t: 0,
                size: rand(a.r*0.05, a.r*0.15),
                type: 'fire'
            });
        }

        // Проигрываем звук взрыва
        explosionSound.currentTime = 0;
        explosionSound.play().catch(()=>{});
    }


    let last = performance.now();
    function frame(t){
        let dt = t - last; 
        if (!isFinite(dt) || dt <= 0) dt = 16; 
        dt = Math.min(dt, 100);
        last = t;
        if(!running) return;
        if(t - lastSpawn > spawnInterval){ spawn(); lastSpawn = t; spawnInterval = Math.max(350, spawnInterval_current); }
        update(dt, t); // Передаём текущее время
        draw();
        requestAnimationFrame(frame);
    }
    //requestAnimationFrame(frame);

    function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

    function getPos(e){
        const rect = canvas.getBoundingClientRect();
        if(e.touches) e = e.touches[0];
        return {x: clamp(e.clientX - rect.left,0,w), y: clamp(e.clientY - rect.top,0,h)};
    }

    function hit(pos){
        // Сбор призов
        for (let i = prizes.length - 1; i >= 0; i--) {
            const p = prizes[i];
            const dx = pos.x - p.x;
            const dy = pos.y - p.y;
            
            // Проверяем попадание в круг приза
            if (dx * dx + dy * dy <= p.r * p.r * 2) {
                // Определяем тип приза и параметры
                const isRed = p.type === 'red';
                const points = isRed ? 0 : 50; // Красный = 0 очков
                const particleType = isRed ? 'redFire' : 'fire';
                const particleCount = isRed ? 35 : 25; // Больше частиц для красного
                
                // Удаляем приз
                prizes.splice(i, 1);
                
                // Начисляем очки
                score += points;
                scoreEl.textContent = 'Очки: ' + score;
                
                // Эффект сбора
                for (let j = 0; j < particleCount; j++) {
                    particles.push({
                        x: p.x,
                        y: p.y,
                        vx: rand(-3, 3),
                        vy: rand(-3.5, -1), // Быстрее вверх для красного
                        life: isRed ? 800 + Math.random() * 300 : 600 + Math.random() * 400,
                        t: 0,
                        size: rand(2, isRed ? 6 : 5),
                        type: particleType
                    });
                }

                // Добавляем новую турель ТОЛЬКО для красного приза
                if (p.type === 'red') {
                    // Генерируем позицию в пределах города (нижние 25% экрана)
                    const cityTop = h - h * 0.25;
                    let newX, newY;
                    let attempts = 0;
                    
                    // Ищем позицию без наложения на другие турели
                    do {
                        newX = rand(80, w - 80);
                        newY = rand(cityTop + 30, h - 30);
                        attempts++;
                    } while (attempts < 20 && turrets.some(t => 
                        Math.hypot(t.x - newX, t.y - newY) < 100
                    ));
                    
                    // Добавляем турель
                    // turrets.push({
                    //     x: newX,
                    //     y: newY,
                    //     angle: -Math.PI / 2,
                    //     lastShot: performance.now(),
                    //     cooldown: rand(500, 800), // Случайная скорострельность
                    //     isPlayer: false
                    // });
                    const cooldown = 1000; //rand(1800, 2500); //rand(500, 800);
                    turrets.push({
                        x: newX,
                        y: newY,
                        angle: -Math.PI / 2,
                        // Ключевое исправление: случайная задержка от 0 до полного кулдауна
                        lastShot: performance.now() - rand(0, cooldown), 
                        cooldown: cooldown,
                        isPlayer: false
                    });
                    
                    // Визуальный эффект появления турели
                    for (let j = 0; j < 15; j++) {
                        particles.push({
                            x: newX,
                            y: newY,
                            vx: rand(-2, 2),
                            vy: rand(-3, -1),
                            life: 400 + Math.random() * 300,
                            t: 0,
                            size: rand(3, 6),
                            type: 'fire'
                        });
                    }
                }
                
                // Звук: для красного приза громче и короче
                try {
                    const collectSound = explosionSound.cloneNode();
                    collectSound.volume = isRed 
                        ? basic_explosion_volume * 0.5  // Громче для красного
                        : basic_explosion_volume * 0.3;
                    collectSound.play().catch(() => {});
                } catch (e) {
                    console.log('Звук сбора недоступен');
                }
                // ВАЖНО: не прерываем функцию — лазер всё равно выстрелит в этом направлении
            }
        }
        // Основная турель (индекс 0) управляется игроком
        const playerTurret = turrets[0];
        playerTurret.angle = Math.atan2(pos.y - playerTurret.y, pos.x - playerTurret.x);

        // Проверяем кулдаун для основной турели
        if (performance.now() - playerTurret.lastShot > playerTurret.cooldown) {
            const barrelLength = 50;
            lasers.push({
                x: playerTurret.x + Math.cos(playerTurret.angle) * barrelLength,
                y: playerTurret.y + Math.sin(playerTurret.angle) * barrelLength,
                angle: playerTurret.angle,
                speed: 1200,
                life: 600,
                t: 0
            });
            
            laserSound.currentTime = 0;
            laserSound.play();
            playerTurret.lastShot = performance.now();
        }

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
        // В функции hit()

        


    }

    canvas.addEventListener('click', e => hit(getPos(e)));
    canvas.addEventListener('touchstart', e => { hit(getPos(e)); e.preventDefault(); });

    function gameOver(){
        running = false;
        finalScore.textContent = 'Очки: ' + score;
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
        overlay.style.pointerEvents = 'auto';

        // Пауза фоновой музыки
        bgMusic.pause();

        checkLeaderboardEligibility();
    }

    function resetGameState() {
        // Основные флаги и таймеры
        running = false;
        last = performance.now();
        lastSpawn = last;

        // Очки и UI
        score = 0;
        scoreEl.textContent = 'Очки: 0';

        // Сложность
        spawnInterval_current = spawnInterval_start;
        spawnInterval = spawnInterval_start;
        asteroids_speed_current = asteroid_start_speed;

        // Игровые массивы
        asteroids = [];
        lasers = [];
        particles = [];
        prizes = [];

        // Призы и кулдауны
        prizeProgress = 0;
        lastRedPrizeTime = 0;

        // Анимации
        gameElapsedTime = 0;

        // Турели — только основная
        turrets = [{
            x: w / 2,
            y: h - 30,
            angle: -Math.PI / 2,
            lastShot: performance.now(),
            cooldown: 300,
            isPlayer: true
        }];

        // Музыка
        bgMusic.pause();
        bgMusic.currentTime = 0;
        bgMusicStarted = false;
    }


    restartBtn.addEventListener('click', ()=>{
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
        overlay.style.pointerEvents = 'none';

        resetGameState();

        running = true;
        playBgMusic();
        requestAnimationFrame(frame);
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
