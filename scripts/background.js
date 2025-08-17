/*
v0.3.4 | 2025-08-17
- 版本号同步：与历史面板功能发布保持一致；无功能改动

v0.3.1 | 2025-08-15
- 性能优化：减少不必要的重绘，优化Canvas渲染性能
- 内存管理：添加动画对象清理机制，防止内存泄漏
- 渲染优化：实现智能重绘检测，提升流畅度

v0.3.0 | 2025-08-14
- 性能：页面隐藏时暂停背景动画，返回时恢复；避免无谓的重绘
- 丝滑：DPR 适配、时间步进 dt、圆端描边；星点改为径向渐变小圆；适度调整拖尾与亮度，视觉更干净
*/
;(function () {
  var c = document.getElementById('bg');
  if (!c) return;
  var w = window.innerWidth,
      h = window.innerHeight,
      ctx = c.getContext('2d'),
      dpr = Math.min(window.devicePixelRatio || 1, 2),
      lastTime = 0,
      
      opts = {
        lineCount: 100,
        starCount: 30,
        // 速度（每秒）
        radVel: 0.9,           // 角速度 ≈ 0.01/帧 @90fps
        lineBaseVel: 9,        // 半径收缩速度（px/s）≈ 0.1/帧 * 90
        lineAddedVel: 6,
        // 线条寿命（以屏幕宽度为尺度，换算为秒）
        lineBaseLife: .4,
        lineAddedLife: .01,
        // 星点寿命（秒）
        starBaseLife: 10,
        starAddedLife: 10,
        
        ellipseTilt: -.3,
        ellipseBaseRadius: .15,
        ellipseAddedRadius: .02,
        ellipseAxisMultiplierX: 2,
        ellipseAxisMultiplierY: 1,
        ellipseCX: w / 2,
        ellipseCY: h / 2,
        
        repaintAlpha: .015      // 与参考效果保持一致的拖尾长度
      },
      
      lines = [],
      stars = [],
      tick = 0,
      running = true,
      rafId = 0,
      needsRedraw = true,
      lastDrawTime = 0,
      frameCount = 0,
      performanceMode = false;

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    // 使用 CSS 像素坐标绘制
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function init() {
    lines.length = stars.length = 0;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, w, h);
    loop();
  }

  function loop() {
    if (!running) return;
    var now = performance.now();
    if (!lastTime) lastTime = now;
    var dt = Math.min(0.033, (now - lastTime) / 1000); // 最大 33ms（约30fps），抑制跳帧尖峰，确保90fps流畅度
    lastTime = now;
    
    // 性能监控：每100帧检查一次性能
    frameCount++;
    if (frameCount % 100 === 0) {
      var avgFrameTime = (now - lastDrawTime) / 100;
      performanceMode = avgFrameTime > 11.1; // 90fps目标：1000ms/90 ≈ 11.1ms，超过则启用性能模式
      lastDrawTime = now;
    }
    
    step(dt);
    
    // 智能重绘：只在需要时重绘
    if (needsRedraw || !performanceMode) {
      draw();
      needsRedraw = false;
    }
    
    rafId = window.requestAnimationFrame(loop);
  }

  function step(dt) {
    // 保持原先色相推进速率（≈ 每秒 +30）
    tick += 30 * dt;
    
    // 性能模式下减少动画对象数量
    var targetLineCount = performanceMode ? Math.floor(opts.lineCount * 0.6) : opts.lineCount;
    var targetStarCount = performanceMode ? Math.floor(opts.starCount * 0.6) : opts.starCount;
    
    if (lines.length < targetLineCount && Math.random() < .5) {
      lines.push(new Line);
      needsRedraw = true;
    }
    if (stars.length < targetStarCount) {
      stars.push(new Star);
      needsRedraw = true;
    }
    
    // 批量处理动画对象，减少循环开销
    var hasMovement = false;
    for (var i = lines.length - 1; i >= 0; i--) {
      if (lines[i].step(dt)) {
        hasMovement = true;
      } else {
        // 移除已死亡的线条，防止内存泄漏
        lines.splice(i, 1);
        needsRedraw = true;
      }
    }
    
    for (var j = stars.length - 1; j >= 0; j--) {
      if (stars[j].step(dt)) {
        hasMovement = true;
      } else {
        // 移除已死亡的星点，防止内存泄漏
        stars.splice(j, 1);
        needsRedraw = true;
      }
    }
    
    if (hasMovement) needsRedraw = true;
  }

  function draw() {
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,' + opts.repaintAlpha + ')';
    ctx.fillRect(0, 0, w, h);
    
    ctx.globalCompositeOperation = 'lighter';
    ctx.save();
    ctx.translate(opts.ellipseCX, opts.ellipseCY);
    ctx.rotate(opts.ellipseTilt);
    ctx.scale(opts.ellipseAxisMultiplierX, opts.ellipseAxisMultiplierY);
    for (var i = 0, L = lines.length; i < L; i++) lines[i].draw();
    ctx.restore();

    for (var j = 0, S = stars.length; j < S; j++) stars[j].draw();
  }

  function Line() {
    this.reset();
  }
  Line.prototype.reset = function () {
    this.rad = Math.random() * Math.PI * 2,
    this.len = w * (opts.ellipseBaseRadius + Math.random() * opts.ellipseAddedRadius);
    this.lenVel = opts.lineBaseVel + Math.random() * opts.lineAddedVel;
    
    this.x = this.px = Math.cos(this.rad) * this.len;
    this.y = this.py = Math.sin(this.rad) * this.len;
    
    // 原逻辑按帧递减，换算为秒（90fps目标）
    var lifeFrames = w * (opts.lineBaseLife + Math.random() * opts.lineAddedLife);
    this.lifeSec = this.originalLifeSec = lifeFrames / 90;
    
    this.alpha = .2 + Math.random() * .8;
  }
  Line.prototype.step = function (dt) {
    this.lifeSec -= dt;
    
    if (this.lifeSec <= 0) {
      return false; // 标记为需要移除
    }
    
    this.px = this.x;
    this.py = this.y;
    
    this.rad += opts.radVel * dt;
    this.len -= this.lenVel * dt;
    
    this.x = Math.cos(this.rad) * this.len;
    this.y = Math.sin(this.rad) * this.len;
    
    return true; // 继续存活
  }
  Line.prototype.draw = function () {
    var ratio = Math.abs(this.lifeSec / this.originalLifeSec - 1 / 2);
    
    ctx.lineWidth = ratio * 5;
    var hue = tick + this.x / (w * (opts.ellipseBaseRadius + opts.ellipseAddedRadius)) * 100;
    var light = 75 - ratio * 150;
    ctx.strokeStyle = ctx.shadowColor = 'hsla(' + hue + ', 80%, ' + light + '%, ' + this.alpha + ')';
    ctx.beginPath();
    ctx.moveTo(this.px, this.py);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
  }

  function Star() {
    this.reset();
  };
  Star.prototype.reset = function () {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    // 使用与参考相同的单位（帧），但用 dt 驱动，故内部转为帧计数
    this.lifeFrames = this.originalLifeFrames = (opts.starBaseLife + Math.random() * opts.starAddedLife);
  }
  Star.prototype.step = function (dt) {
    // 将时间步进换算为帧步进（90fps目标）
    this.lifeFrames -= dt * 90;
    if (this.lifeFrames <= 0) {
      return false; // 标记为需要移除
    }
    return true; // 继续存活
  }
  Star.prototype.draw = function () {
    var hue = tick + this.x / w * 100;
    ctx.fillStyle = ctx.shadowColor = 'hsla(' + hue + ', 80%, 50%, .2)';
    ctx.shadowBlur = Math.max(0, this.lifeFrames);
    ctx.fillRect(this.x, this.y, 1, 1);
  };

  window.addEventListener('resize', function () {
    w = window.innerWidth;
    h = window.innerHeight;
    opts.ellipseCX = w / 2;
    opts.ellipseCY = h / 2;
    resizeCanvas();
    init();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      running = false;
      if (rafId) { 
        try { 
          cancelAnimationFrame(rafId); 
        } catch(_) {} 
        rafId = 0; 
      }
      // 清理动画对象，释放内存
      cleanupAnimationObjects();
    } else {
      if (!running) {
        running = true;
        needsRedraw = true;
        frameCount = 0;
        performanceMode = false;
        lastTime = performance.now();
        lastDrawTime = lastTime;
        init();
        loop();
      }
    }
  });
  
  // 清理动画对象，防止内存泄漏
  function cleanupAnimationObjects() {
    // 保留少量对象以便快速恢复
    if (lines.length > 10) {
      lines.length = 10;
    }
    if (stars.length > 5) {
      stars.length = 5;
    }
  }

  resizeCanvas();
  init();
  loop();
})();

