// ══════ THREE.JS — Circuit Board Backdrop v2 ══════
// Routes traces between and around the actual console grid tiles
// Pulses travel between tiles like data flowing through a circuit

(function(){
  if(!window.THREE) return;

  let scene, camera, renderer, container;
  let pulses = [], chips = [];
  let animId = null;
  let tileRects = []; // actual tile positions in world coords

  const CONFIG = {
    traceColor: 0x00ff88,
    traceOpacity: 0.09,
    pulseColor: 0x00ff88,
    pulseSpeed: 0.4,
    pulseSize: 0.018,
    pulseOpacity: 0.6,
    chipColor: 0x00ff88,
    chipOpacity: 0.04,
    chipGlowMax: 0.1,
    viaOpacity: 0.05,
  };

  // ── Convert pixel coords to Three.js world coords ──
  function pxToWorld(px, py, containerW, containerH, camW, camH){
    return {
      x: (px / containerW) * camW - camW / 2,
      y: -(py / containerH) * camH + camH / 2
    };
  }

  // ── Read tile positions from DOM ──
  function readTilePositions(){
    const tiles = document.querySelectorAll('#consoleGrid .crt-monitor');
    if(!tiles.length || !container) return [];
    const cRect = container.getBoundingClientRect();
    const camH = 12;
    const camW = camH * (cRect.width / cRect.height);
    const rects = [];
    tiles.forEach(tile => {
      const r = tile.getBoundingClientRect();
      const tl = pxToWorld(r.left - cRect.left, r.top - cRect.top, cRect.width, cRect.height, camW, camH);
      const br = pxToWorld(r.right - cRect.left, r.bottom - cRect.top, cRect.width, cRect.height, camW, camH);
      const cx = (tl.x + br.x) / 2;
      const cy = (tl.y + br.y) / 2;
      rects.push({ left: tl.x, top: tl.y, right: br.x, bottom: br.y, cx, cy, w: br.x - tl.x, h: tl.y - br.y });
    });
    return rects;
  }

  // ── Build a trace path between two tile edges ──
  function buildTraceBetweenTiles(fromTile, toTile, variant){
    const points = [];
    const margin = 0.15; // gap from tile edge

    // Determine exit/entry sides
    const dx = toTile.cx - fromTile.cx;
    const dy = toTile.cy - fromTile.cy;

    if(variant === 0){
      // Right side of from → left side of to (horizontal connection)
      const sx = fromTile.right + margin;
      const sy = fromTile.cy + (Math.random() - 0.5) * fromTile.h * 0.4;
      const ex = toTile.left - margin;
      const ey = toTile.cy + (Math.random() - 0.5) * toTile.h * 0.4;
      const midX = (sx + ex) / 2;
      points.push(
        new THREE.Vector3(sx, sy, 0),
        new THREE.Vector3(midX, sy, 0),
        new THREE.Vector3(midX, ey, 0),
        new THREE.Vector3(ex, ey, 0)
      );
    } else if(variant === 1){
      // Bottom of from → top of to (vertical connection)
      const sx = fromTile.cx + (Math.random() - 0.5) * fromTile.w * 0.4;
      const sy = fromTile.bottom - margin;
      const ex = toTile.cx + (Math.random() - 0.5) * toTile.w * 0.4;
      const ey = toTile.top + margin;
      const midY = (sy + ey) / 2;
      points.push(
        new THREE.Vector3(sx, sy, 0),
        new THREE.Vector3(sx, midY, 0),
        new THREE.Vector3(ex, midY, 0),
        new THREE.Vector3(ex, ey, 0)
      );
    } else if(variant === 2){
      // Around the outside — exit bottom, go wide, come in from top
      const sx = fromTile.cx + (Math.random() - 0.5) * fromTile.w * 0.3;
      const sy = fromTile.bottom - margin;
      const ex = toTile.cx + (Math.random() - 0.5) * toTile.w * 0.3;
      const ey = toTile.top + margin;
      const wideX = Math.max(fromTile.right, toTile.right) + 0.5 + Math.random() * 0.5;
      points.push(
        new THREE.Vector3(sx, sy, 0),
        new THREE.Vector3(sx, sy - 0.3, 0),
        new THREE.Vector3(wideX, sy - 0.3, 0),
        new THREE.Vector3(wideX, ey + 0.3, 0),
        new THREE.Vector3(ex, ey + 0.3, 0),
        new THREE.Vector3(ex, ey, 0)
      );
    } else {
      // Around the left side
      const sx = fromTile.left - margin;
      const sy = fromTile.cy;
      const ex = toTile.left - margin;
      const ey = toTile.cy;
      const wideX = Math.min(fromTile.left, toTile.left) - 0.5 - Math.random() * 0.5;
      points.push(
        new THREE.Vector3(sx, sy, 0),
        new THREE.Vector3(wideX, sy, 0),
        new THREE.Vector3(wideX, ey, 0),
        new THREE.Vector3(ex, ey, 0)
      );
    }
    return points;
  }

  // ── Build trace that loops around a single tile ──
  function buildTraceAroundTile(tile){
    const m = 0.2 + Math.random() * 0.2;
    const side = Math.floor(Math.random() * 4);
    const points = [];

    if(side === 0){
      // Loop around top-right corner
      const sx = tile.right + m;
      const sy = tile.cy;
      points.push(
        new THREE.Vector3(sx, sy, 0),
        new THREE.Vector3(sx, tile.top + m, 0),
        new THREE.Vector3(tile.cx, tile.top + m, 0),
        new THREE.Vector3(tile.left - m, tile.top + m, 0),
        new THREE.Vector3(tile.left - m, tile.cy, 0)
      );
    } else if(side === 1){
      // Loop around bottom
      const sy = tile.bottom - m;
      points.push(
        new THREE.Vector3(tile.left - m, tile.cy, 0),
        new THREE.Vector3(tile.left - m, sy, 0),
        new THREE.Vector3(tile.cx, sy, 0),
        new THREE.Vector3(tile.right + m, sy, 0),
        new THREE.Vector3(tile.right + m, tile.cy, 0)
      );
    } else if(side === 2){
      // U-shape under tile
      const drop = m + 0.3;
      points.push(
        new THREE.Vector3(tile.left + tile.w * 0.2, tile.bottom - m * 0.5, 0),
        new THREE.Vector3(tile.left + tile.w * 0.2, tile.bottom - drop, 0),
        new THREE.Vector3(tile.right - tile.w * 0.2, tile.bottom - drop, 0),
        new THREE.Vector3(tile.right - tile.w * 0.2, tile.bottom - m * 0.5, 0)
      );
    } else {
      // U-shape above tile
      const rise = m + 0.3;
      points.push(
        new THREE.Vector3(tile.right - tile.w * 0.2, tile.top + m * 0.5, 0),
        new THREE.Vector3(tile.right - tile.w * 0.2, tile.top + rise, 0),
        new THREE.Vector3(tile.left + tile.w * 0.2, tile.top + rise, 0),
        new THREE.Vector3(tile.left + tile.w * 0.2, tile.top + m * 0.5, 0)
      );
    }
    return points;
  }

  // ── Create a pulse on a path ──
  function createPulse(tracePoints){
    const pulseGeo = new THREE.CircleGeometry(CONFIG.pulseSize, 8);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: CONFIG.pulseColor, transparent: true, opacity: 0
    });
    const mesh = new THREE.Mesh(pulseGeo, pulseMat);

    // Glow ring
    const glowGeo = new THREE.RingGeometry(CONFIG.pulseSize, CONFIG.pulseSize * 3.5, 12);
    const glowMat = new THREE.MeshBasicMaterial({
      color: CONFIG.pulseColor, transparent: true, opacity: 0, side: THREE.DoubleSide
    });
    mesh.add(new THREE.Mesh(glowGeo, glowMat));

    // Pre-calc segments
    let total = 0;
    const segments = [];
    for(let i = 1; i < tracePoints.length; i++){
      const len = tracePoints[i].distanceTo(tracePoints[i-1]);
      segments.push({ start: total, length: len });
      total += len;
    }

    mesh.userData = {
      tracePoints, segments, totalLength: total,
      progress: Math.random(),
      speed: CONFIG.pulseSpeed * (0.5 + Math.random() * 1.0),
      delay: Math.random() * 6,
      active: true
    };

    scene.add(mesh);
    pulses.push(mesh);
    return mesh;
  }

  // ── Add a trace line + pulse(s) ──
  function addTrace(points, pulseCount){
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: CONFIG.traceColor, transparent: true, opacity: CONFIG.traceOpacity
    });
    scene.add(new THREE.Line(geo, mat));

    for(let i = 0; i < pulseCount; i++){
      createPulse(points);
    }
  }

  // ── Chip graphics at tile corners ──
  function addChipsAroundTiles(rects){
    rects.forEach(tile => {
      // Small IC packages at corners
      const corners = [
        { x: tile.left - 0.35, y: tile.top + 0.1 },
        { x: tile.right + 0.1, y: tile.top + 0.1 },
        { x: tile.left - 0.35, y: tile.bottom - 0.1 },
        { x: tile.right + 0.1, y: tile.bottom - 0.1 }
      ];

      corners.forEach(c => {
        if(Math.random() > 0.5) return; // Only some corners get chips
        const cw = 0.2 + Math.random() * 0.15;
        const ch = 0.1 + Math.random() * 0.08;
        const group = new THREE.Group();
        group.position.set(c.x, c.y, 0);

        // Body
        const body = new THREE.Mesh(
          new THREE.PlaneGeometry(cw, ch),
          new THREE.MeshBasicMaterial({ color: CONFIG.chipColor, transparent: true, opacity: CONFIG.chipOpacity })
        );
        group.add(body);

        // Border
        const bp = [
          new THREE.Vector3(-cw/2, -ch/2, 0), new THREE.Vector3(cw/2, -ch/2, 0),
          new THREE.Vector3(cw/2, ch/2, 0), new THREE.Vector3(-cw/2, ch/2, 0),
          new THREE.Vector3(-cw/2, -ch/2, 0)
        ];
        group.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(bp),
          new THREE.LineBasicMaterial({ color: CONFIG.chipColor, transparent: true, opacity: CONFIG.traceOpacity * 1.3 })
        ));

        // Pins
        const pins = Math.floor(Math.random() * 2) + 2;
        for(let p = 0; p < pins; p++){
          const px = -cw/2 + (cw / (pins + 1)) * (p + 1);
          const pinMat = new THREE.LineBasicMaterial({ color: CONFIG.chipColor, transparent: true, opacity: CONFIG.traceOpacity });
          group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(px, ch/2, 0), new THREE.Vector3(px, ch/2 + 0.04, 0)
          ]), pinMat));
          group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(px, -ch/2, 0), new THREE.Vector3(px, -ch/2 - 0.04, 0)
          ]), pinMat.clone()));
        }

        group.userData = { phase: Math.random() * Math.PI * 2, body };
        scene.add(group);
        chips.push(group);
      });
    });
  }

  // ── Vias scattered in the gaps between tiles ──
  function addVias(rects){
    const cRect = container.getBoundingClientRect();
    const camH = 12;
    const camW = camH * (cRect.width / cRect.height);

    for(let i = 0; i < 40; i++){
      const x = (Math.random() - 0.5) * camW * 0.9;
      const y = (Math.random() - 0.5) * camH * 0.9;
      // Skip if inside a tile
      const inside = rects.some(t => x > t.left && x < t.right && y < t.top && y > t.bottom);
      if(inside) continue;

      const via = new THREE.Mesh(
        new THREE.RingGeometry(0.02, 0.038, 12),
        new THREE.MeshBasicMaterial({ color: CONFIG.traceColor, transparent: true, opacity: CONFIG.viaOpacity, side: THREE.DoubleSide })
      );
      via.position.set(x, y, 0);
      scene.add(via);
    }
  }

  // ── Position on path ──
  function getPositionOnPath(tracePoints, segments, totalLength, t){
    const dist = t * totalLength;
    let acc = 0;
    for(let i = 0; i < segments.length; i++){
      if(acc + segments[i].length >= dist){
        const lt = (dist - acc) / segments[i].length;
        return new THREE.Vector3().lerpVectors(tracePoints[i], tracePoints[i + 1], lt);
      }
      acc += segments[i].length;
    }
    return tracePoints[tracePoints.length - 1].clone();
  }

  // ── Build the entire circuit ──
  function buildCircuit(){
    tileRects = readTilePositions();
    if(tileRects.length < 2) return;

    // ── Traces between adjacent tiles ──
    // 2x2 grid: [0]=TL, [1]=TR, [2]=BL, [3]=BR
    const pairs = [
      [0, 1, 0],  // TL → TR (horizontal)
      [2, 3, 0],  // BL → BR (horizontal)
      [0, 2, 1],  // TL → BL (vertical)
      [1, 3, 1],  // TR → BR (vertical)
      [0, 3, 2],  // TL → BR (diagonal via outside)
      [1, 2, 3],  // TR → BL (via left side)
    ];

    pairs.forEach(([from, to, variant]) => {
      if(tileRects[from] && tileRects[to]){
        const pts = buildTraceBetweenTiles(tileRects[from], tileRects[to], variant);
        addTrace(pts, variant < 2 ? 2 : 1);
      }
    });

    // Extra parallel traces between horizontal/vertical neighbors
    for(let i = 0; i < 3; i++){
      const from = Math.floor(Math.random() * tileRects.length);
      let to = Math.floor(Math.random() * tileRects.length);
      if(to === from) to = (from + 1) % tileRects.length;
      const variant = Math.floor(Math.random() * 4);
      const pts = buildTraceBetweenTiles(tileRects[from], tileRects[to], variant);
      addTrace(pts, 1);
    }

    // ── Traces looping around individual tiles ──
    tileRects.forEach(tile => {
      const loops = 1 + Math.floor(Math.random() * 2);
      for(let i = 0; i < loops; i++){
        const pts = buildTraceAroundTile(tile);
        addTrace(pts, 1);
      }
    });

    // ── Bus traces running edge to edge through gaps ──
    const cRect = container.getBoundingClientRect();
    const camH = 12;
    const camW = camH * (cRect.width / cRect.height);

    // Horizontal bus through the gap between top and bottom rows
    if(tileRects.length >= 4){
      const gapY = (tileRects[0].bottom + tileRects[2].top) / 2;
      addTrace([
        new THREE.Vector3(-camW / 2 * 0.9, gapY, 0),
        new THREE.Vector3(camW / 2 * 0.9, gapY, 0)
      ], 2);
      // Second bus slightly offset
      addTrace([
        new THREE.Vector3(-camW / 2 * 0.85, gapY - 0.15, 0),
        new THREE.Vector3(camW / 2 * 0.7, gapY - 0.15, 0)
      ], 1);
    }

    // Vertical bus through the gap between left and right columns
    if(tileRects.length >= 2){
      const gapX = (tileRects[0].right + tileRects[1].left) / 2;
      addTrace([
        new THREE.Vector3(gapX, camH / 2 * 0.9, 0),
        new THREE.Vector3(gapX, -camH / 2 * 0.9, 0)
      ], 2);
    }

    // ── Chips and vias ──
    addChipsAroundTiles(tileRects);
    addVias(tileRects);
  }

  // ── Initialize ──
  function init(){
    const consoleScreen = document.getElementById('consoleScreen');
    if(!consoleScreen) return;

    container = document.createElement('div');
    container.id = 'circuitCanvas';
    container.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;';
    consoleScreen.appendChild(container);

    scene = new THREE.Scene();

    const aspect = container.clientWidth / container.clientHeight;
    const camH = 12;
    camera = new THREE.OrthographicCamera(
      -camH / 2 * aspect, camH / 2 * aspect, camH / 2, -camH / 2, 0.1, 10
    );
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true, powerPreference: 'low-power'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Hide old SVG worldmap
    const oldMap = consoleScreen.querySelector('.console-worldmap');
    if(oldMap) oldMap.style.display = 'none';

    // Wait for grid to render before reading positions
    setTimeout(() => {
      buildCircuit();
      animate();
    }, 600);

    window.addEventListener('resize', () => {
      onResize();
      // Rebuild circuit on resize since tile positions change
      clearTimeout(window._circuitRebuildTimer);
      window._circuitRebuildTimer = setTimeout(rebuild, 400);
    });
  }

  function rebuild(){
    // Clear scene except camera
    while(scene.children.length > 0){
      const obj = scene.children[0];
      if(obj.geometry) obj.geometry.dispose();
      if(obj.material) obj.material.dispose();
      scene.remove(obj);
    }
    pulses = [];
    chips = [];
    buildCircuit();
  }

  // ── Animation ──
  function animate(){
    animId = requestAnimationFrame(animate);
    const t = performance.now() * 0.001;

    pulses.forEach(pulse => {
      const d = pulse.userData;
      if(!d.active || d.totalLength === 0) return;

      if(d.delay > 0){
        d.delay -= 0.016;
        pulse.material.opacity = 0;
        if(pulse.children[0]) pulse.children[0].material.opacity = 0;
        return;
      }

      d.progress += d.speed * 0.016 / d.totalLength;

      if(d.progress > 1){
        d.progress = 0;
        d.delay = 0.5 + Math.random() * 4;
        pulse.material.opacity = 0;
        if(pulse.children[0]) pulse.children[0].material.opacity = 0;
        return;
      }

      const pos = getPositionOnPath(d.tracePoints, d.segments, d.totalLength, d.progress);
      pulse.position.copy(pos);

      const edgeFade = Math.min(d.progress * 5, (1 - d.progress) * 5, 1);
      pulse.material.opacity = CONFIG.pulseOpacity * edgeFade;
      if(pulse.children[0]) pulse.children[0].material.opacity = CONFIG.pulseOpacity * 0.2 * edgeFade;
    });

    chips.forEach(chip => {
      const glow = Math.sin(t * 0.5 + chip.userData.phase) * 0.5 + 0.5;
      if(chip.userData.body){
        chip.userData.body.material.opacity = CONFIG.chipOpacity + glow * CONFIG.chipGlowMax;
      }
    });

    renderer.render(scene, camera);
  }

  // ── Resize ──
  function onResize(){
    if(!container || !camera || !renderer) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const aspect = w / h;
    const camH = 12;
    camera.left = -camH / 2 * aspect;
    camera.right = camH / 2 * aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function destroy(){
    if(animId) cancelAnimationFrame(animId);
    window.removeEventListener('resize', onResize);
    if(renderer){ renderer.dispose(); renderer.domElement.remove(); }
  }

  window._circuit = { destroy, rebuild };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 400);
  }

})();

// ══════ THREE.JS — Admin Console Circuit Backdrop ══════
// Generative circuit board for the settings/admin screen

(function(){
  if(!window.THREE) return;

  let scene, camera, renderer, container;
  let pulses = [], chips = [];
  let animId = null;
  let initialized = false;

  const CFG = {
    traceColor: 0x00d4ff,    // Cyan for admin (vs green for console)
    traceOpacity: 0.08,
    pulseColor: 0x00d4ff,
    pulseSpeed: 0.35,
    pulseSize: 0.016,
    pulseOpacity: 0.55,
    chipColor: 0x00d4ff,
    chipOpacity: 0.04,
    chipGlowMax: 0.09,
  };

  function getPositionOnPath(pts, segs, total, t){
    const dist = t * total;
    let acc = 0;
    for(let i = 0; i < segs.length; i++){
      if(acc + segs[i].length >= dist){
        const lt = (dist - acc) / segs[i].length;
        return new THREE.Vector3().lerpVectors(pts[i], pts[i + 1], lt);
      }
      acc += segs[i].length;
    }
    return pts[pts.length - 1].clone();
  }

  function addTrace(points, pulseCount){
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: CFG.traceColor, transparent: true, opacity: CFG.traceOpacity
    });
    scene.add(new THREE.Line(geo, mat));

    for(let i = 0; i < pulseCount; i++){
      const pGeo = new THREE.CircleGeometry(CFG.pulseSize, 8);
      const pMat = new THREE.MeshBasicMaterial({ color: CFG.pulseColor, transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(pGeo, pMat);
      const glowGeo = new THREE.RingGeometry(CFG.pulseSize, CFG.pulseSize * 3, 10);
      const glowMat = new THREE.MeshBasicMaterial({ color: CFG.pulseColor, transparent: true, opacity: 0, side: THREE.DoubleSide });
      mesh.add(new THREE.Mesh(glowGeo, glowMat));

      let total = 0;
      const segs = [];
      for(let j = 1; j < points.length; j++){
        const l = points[j].distanceTo(points[j-1]);
        segs.push({ start: total, length: l });
        total += l;
      }
      mesh.userData = {
        tracePoints: points, segments: segs, totalLength: total,
        progress: Math.random(),
        speed: CFG.pulseSpeed * (0.5 + Math.random() * 1.0),
        delay: Math.random() * 6, active: true
      };
      scene.add(mesh);
      pulses.push(mesh);
    }
  }

  function buildAdminCircuit(camW, camH){
    const hw = camW / 2 * 0.9;
    const hh = camH / 2 * 0.9;

    // Horizontal bus traces
    for(let i = 0; i < 8; i++){
      const y = (Math.random() - 0.5) * camH * 0.85;
      const x1 = -hw * (0.3 + Math.random() * 0.7);
      const x2 = hw * (0.3 + Math.random() * 0.7);
      addTrace([new THREE.Vector3(x1, y, 0), new THREE.Vector3(x2, y, 0)], Math.random() > 0.5 ? 2 : 1);
    }

    // Vertical bus traces
    for(let i = 0; i < 6; i++){
      const x = (Math.random() - 0.5) * camW * 0.85;
      const y1 = -hh * (0.3 + Math.random() * 0.7);
      const y2 = hh * (0.3 + Math.random() * 0.7);
      addTrace([new THREE.Vector3(x, y1, 0), new THREE.Vector3(x, y2, 0)], Math.random() > 0.5 ? 2 : 1);
    }

    // Orthogonal routed traces (L-shaped and Z-shaped)
    for(let i = 0; i < 18; i++){
      const sx = (Math.random() - 0.5) * camW * 0.8;
      const sy = (Math.random() - 0.5) * camH * 0.8;
      const ex = (Math.random() - 0.5) * camW * 0.8;
      const ey = (Math.random() - 0.5) * camH * 0.8;
      const pts = [];

      if(Math.random() > 0.5){
        const midX = sx + (ex - sx) * (0.3 + Math.random() * 0.4);
        pts.push(
          new THREE.Vector3(sx, sy, 0),
          new THREE.Vector3(midX, sy, 0),
          new THREE.Vector3(midX, ey, 0),
          new THREE.Vector3(ex, ey, 0)
        );
      } else {
        const midY = sy + (ey - sy) * (0.3 + Math.random() * 0.4);
        pts.push(
          new THREE.Vector3(sx, sy, 0),
          new THREE.Vector3(sx, midY, 0),
          new THREE.Vector3(ex, midY, 0),
          new THREE.Vector3(ex, ey, 0)
        );
      }
      addTrace(pts, 1);
    }

    // IC chips scattered
    for(let i = 0; i < 16; i++){
      const cx = (Math.random() - 0.5) * camW * 0.8;
      const cy = (Math.random() - 0.5) * camH * 0.8;
      const cw = 0.2 + Math.random() * 0.25;
      const ch = 0.1 + Math.random() * 0.12;
      const group = new THREE.Group();
      group.position.set(cx, cy, 0);

      const body = new THREE.Mesh(
        new THREE.PlaneGeometry(cw, ch),
        new THREE.MeshBasicMaterial({ color: CFG.chipColor, transparent: true, opacity: CFG.chipOpacity })
      );
      group.add(body);

      const bp = [
        new THREE.Vector3(-cw/2, -ch/2, 0), new THREE.Vector3(cw/2, -ch/2, 0),
        new THREE.Vector3(cw/2, ch/2, 0), new THREE.Vector3(-cw/2, ch/2, 0),
        new THREE.Vector3(-cw/2, -ch/2, 0)
      ];
      group.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(bp),
        new THREE.LineBasicMaterial({ color: CFG.chipColor, transparent: true, opacity: CFG.traceOpacity * 1.5 })
      ));

      const pins = Math.floor(Math.random() * 3) + 2;
      for(let p = 0; p < pins; p++){
        const px = -cw/2 + (cw / (pins + 1)) * (p + 1);
        const pinMat = new THREE.LineBasicMaterial({ color: CFG.chipColor, transparent: true, opacity: CFG.traceOpacity });
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(px, ch/2, 0), new THREE.Vector3(px, ch/2 + 0.04, 0)
        ]), pinMat));
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(px, -ch/2, 0), new THREE.Vector3(px, -ch/2 - 0.04, 0)
        ]), pinMat.clone()));
      }

      group.userData = { phase: Math.random() * Math.PI * 2, body };
      scene.add(group);
      chips.push(group);
    }

    // Vias
    for(let i = 0; i < 35; i++){
      const via = new THREE.Mesh(
        new THREE.RingGeometry(0.02, 0.035, 12),
        new THREE.MeshBasicMaterial({ color: CFG.traceColor, transparent: true, opacity: 0.035, side: THREE.DoubleSide })
      );
      via.position.set((Math.random() - 0.5) * camW * 0.85, (Math.random() - 0.5) * camH * 0.85, 0);
      scene.add(via);
    }
  }

  function initAdmin(){
    const settingsScreen = document.getElementById('settingsScreen');
    if(!settingsScreen || initialized) return;

    // Check if settings screen is actually visible and has dimensions
    const style = window.getComputedStyle(settingsScreen);
    if(style.opacity === '0' || style.display === 'none' || style.pointerEvents === 'none') return;
    if(settingsScreen.offsetWidth === 0) return;

    container = document.createElement('div');
    container.id = 'adminCircuitCanvas';
    container.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;';
    settingsScreen.insertBefore(container, settingsScreen.firstChild);

    scene = new THREE.Scene();

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const aspect = w / h;
    const camH = 12;
    camera = new THREE.OrthographicCamera(-camH/2 * aspect, camH/2 * aspect, camH/2, -camH/2, 0.1, 10);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    buildAdminCircuit(camH * aspect, camH);
    initialized = true;
    animateAdmin();
  }

  function animateAdmin(){
    animId = requestAnimationFrame(animateAdmin);
    const t = performance.now() * 0.001;

    pulses.forEach(pulse => {
      const d = pulse.userData;
      if(!d.active || d.totalLength === 0) return;
      if(d.delay > 0){ d.delay -= 0.016; pulse.material.opacity = 0; if(pulse.children[0]) pulse.children[0].material.opacity = 0; return; }
      d.progress += d.speed * 0.016 / d.totalLength;
      if(d.progress > 1){ d.progress = 0; d.delay = 0.5 + Math.random() * 4; pulse.material.opacity = 0; if(pulse.children[0]) pulse.children[0].material.opacity = 0; return; }
      const pos = getPositionOnPath(d.tracePoints, d.segments, d.totalLength, d.progress);
      pulse.position.copy(pos);
      const fade = Math.min(d.progress * 5, (1 - d.progress) * 5, 1);
      pulse.material.opacity = CFG.pulseOpacity * fade;
      if(pulse.children[0]) pulse.children[0].material.opacity = CFG.pulseOpacity * 0.2 * fade;
    });

    chips.forEach(chip => {
      const glow = Math.sin(t * 0.5 + chip.userData.phase) * 0.5 + 0.5;
      if(chip.userData.body) chip.userData.body.material.opacity = CFG.chipOpacity + glow * CFG.chipGlowMax;
    });

    renderer.render(scene, camera);
  }

  // Robust detection — poll every 500ms until settings screen appears, then init
  function watchForSettings(){
    const checkInterval = setInterval(() => {
      if(initialized){ clearInterval(checkInterval); return; }
      const ss = document.getElementById('settingsScreen');
      if(!ss) return;
      const style = window.getComputedStyle(ss);
      if(style.opacity !== '0' && style.pointerEvents !== 'none' && ss.offsetWidth > 0){
        clearInterval(checkInterval);
        setTimeout(initAdmin, 200);
      }
    }, 500);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', watchForSettings);
  } else {
    setTimeout(watchForSettings, 500);
  }

})();
