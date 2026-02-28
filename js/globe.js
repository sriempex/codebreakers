// ══════ THREE.JS — Circuit Board Backdrop ══════
// Faint circuit traces with traveling pulses behind the console grid

(function(){
  if(!window.THREE) return;

  let scene, camera, renderer, container;
  let traces = [], chips = [], pulses = [];
  let animId = null;

  // ── Configuration ──
  const CONFIG = {
    traceColor: 0x00ff88,
    traceOpacity: 0.06,
    traceGlowOpacity: 0.03,
    chipColor: 0x00ff88,
    chipOpacity: 0.04,
    chipGlowOpacity: 0.08,
    pulseColor: 0x00ff88,
    pulseSpeed: 0.3,
    pulseSize: 0.015,
    pulseOpacity: 0.5,
  };

  // ── Generate circuit layout ──
  function generateCircuit(){
    const layout = { traces: [], chips: [], nodes: [] };
    const w = 12, h = 8;
    const gridStep = 0.6;

    // Place chips (IC packages) at semi-random grid positions
    const chipPositions = [];
    for(let i = 0; i < 14; i++){
      let x, y, attempts = 0;
      do {
        x = (Math.floor(Math.random() * (w / gridStep)) * gridStep) - w/2;
        y = (Math.floor(Math.random() * (h / gridStep)) * gridStep) - h/2;
        attempts++;
      } while(attempts < 50 && chipPositions.some(c => Math.abs(c.x - x) < 1.2 && Math.abs(c.y - y) < 1.0));
      
      const chip = {
        x, y,
        w: 0.3 + Math.random() * 0.5,
        h: 0.15 + Math.random() * 0.3,
        pins: Math.floor(Math.random() * 3) + 2,
        phase: Math.random() * Math.PI * 2
      };
      chipPositions.push(chip);
      layout.chips.push(chip);
    }

    // Generate traces connecting chips via orthogonal paths
    for(let i = 0; i < chipPositions.length; i++){
      const connections = Math.floor(Math.random() * 3) + 1;
      const sorted = chipPositions
        .map((c, idx) => ({ idx, dist: Math.abs(c.x - chipPositions[i].x) + Math.abs(c.y - chipPositions[i].y) }))
        .filter(c => c.idx !== i)
        .sort((a, b) => a.dist - b.dist);

      for(let j = 0; j < Math.min(connections, sorted.length); j++){
        const target = chipPositions[sorted[j].idx];
        const from = chipPositions[i];
        
        const points = [];
        const pinOffsetFrom = (Math.random() - 0.5) * from.h * 0.6;
        const pinOffsetTo = (Math.random() - 0.5) * target.h * 0.6;
        
        const sx = from.x + (target.x > from.x ? from.w/2 : -from.w/2);
        const sy = from.y + pinOffsetFrom;
        const ex = target.x + (from.x > target.x ? target.w/2 : -target.w/2);
        const ey = target.y + pinOffsetTo;

        if(Math.random() > 0.5){
          const midX = sx + (ex - sx) * (0.3 + Math.random() * 0.4);
          points.push(
            new THREE.Vector3(sx, sy, 0),
            new THREE.Vector3(midX, sy, 0),
            new THREE.Vector3(midX, ey, 0),
            new THREE.Vector3(ex, ey, 0)
          );
        } else {
          const midY = sy + (ey - sy) * (0.3 + Math.random() * 0.4);
          points.push(
            new THREE.Vector3(sx, sy, 0),
            new THREE.Vector3(sx, midY, 0),
            new THREE.Vector3(ex, midY, 0),
            new THREE.Vector3(ex, ey, 0)
          );
        }

        layout.traces.push({ points: points });
      }
    }

    // Bus traces (long runs)
    for(let i = 0; i < 6; i++){
      const isHoriz = Math.random() > 0.5;
      const pos = (Math.random() - 0.5) * (isHoriz ? h : w) * 0.8;
      const start = -(isHoriz ? w : h) / 2 * 0.9;
      const end = (isHoriz ? w : h) / 2 * (0.3 + Math.random() * 0.6);
      
      const points = isHoriz
        ? [new THREE.Vector3(start, pos, 0), new THREE.Vector3(end, pos, 0)]
        : [new THREE.Vector3(pos, start, 0), new THREE.Vector3(pos, end, 0)];
      
      layout.traces.push({ points: points, isBus: true });
    }

    return layout;
  }

  // ── Build Three.js objects ──
  function buildScene(layout){

    // Traces
    layout.traces.forEach(trace => {
      const geo = new THREE.BufferGeometry().setFromPoints(trace.points);
      const mat = new THREE.LineBasicMaterial({
        color: CONFIG.traceColor,
        transparent: true,
        opacity: trace.isBus ? CONFIG.traceOpacity * 1.3 : CONFIG.traceOpacity
      });
      const line = new THREE.Line(geo, mat);
      scene.add(line);
      traces.push(line);

      // Pulse(s) along trace
      const pulseCount = trace.isBus ? 2 : (Math.random() > 0.4 ? 1 : 0);
      for(let p = 0; p < pulseCount; p++){
        const pulseGeo = new THREE.CircleGeometry(CONFIG.pulseSize, 8);
        const pulseMat = new THREE.MeshBasicMaterial({
          color: CONFIG.pulseColor,
          transparent: true,
          opacity: 0
        });
        const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);

        // Glow ring
        const glowGeo = new THREE.RingGeometry(CONFIG.pulseSize, CONFIG.pulseSize * 3, 12);
        const glowMat = new THREE.MeshBasicMaterial({
          color: CONFIG.pulseColor,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide
        });
        pulseMesh.add(new THREE.Mesh(glowGeo, glowMat));

        // Pre-calculate segments
        let total = 0;
        const segments = [];
        for(let i = 1; i < trace.points.length; i++){
          const segLen = trace.points[i].distanceTo(trace.points[i-1]);
          segments.push({ start: total, length: segLen });
          total += segLen;
        }

        pulseMesh.userData = {
          tracePoints: trace.points,
          segments: segments,
          totalLength: total,
          progress: Math.random(),
          speed: CONFIG.pulseSpeed * (0.6 + Math.random() * 0.8),
          delay: Math.random() * 8,
          active: true
        };

        scene.add(pulseMesh);
        pulses.push(pulseMesh);
      }
    });

    // Chips
    layout.chips.forEach(chip => {
      const group = new THREE.Group();
      group.position.set(chip.x, chip.y, 0);

      // Body
      const bodyGeo = new THREE.PlaneGeometry(chip.w, chip.h);
      const bodyMat = new THREE.MeshBasicMaterial({
        color: CONFIG.chipColor,
        transparent: true,
        opacity: CONFIG.chipOpacity
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      group.add(body);

      // Border
      const bp = [
        new THREE.Vector3(-chip.w/2, -chip.h/2, 0),
        new THREE.Vector3( chip.w/2, -chip.h/2, 0),
        new THREE.Vector3( chip.w/2,  chip.h/2, 0),
        new THREE.Vector3(-chip.w/2,  chip.h/2, 0),
        new THREE.Vector3(-chip.w/2, -chip.h/2, 0),
      ];
      const borderMat = new THREE.LineBasicMaterial({
        color: CONFIG.chipColor, transparent: true, opacity: CONFIG.traceOpacity * 1.5
      });
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(bp), borderMat));

      // Pins
      for(let p = 0; p < chip.pins; p++){
        const px = -chip.w/2 + (chip.w / (chip.pins + 1)) * (p + 1);
        const pinLen = 0.06;
        const pinMat = new THREE.LineBasicMaterial({
          color: CONFIG.chipColor, transparent: true, opacity: CONFIG.traceOpacity * 1.2
        });
        // Top
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(px, chip.h/2, 0), new THREE.Vector3(px, chip.h/2 + pinLen, 0)
        ]), pinMat));
        // Bottom
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(px, -chip.h/2, 0), new THREE.Vector3(px, -chip.h/2 - pinLen, 0)
        ]), pinMat.clone()));
      }

      // Pin 1 dot
      const dotGeo = new THREE.CircleGeometry(0.02, 8);
      const dotMat = new THREE.MeshBasicMaterial({
        color: CONFIG.chipColor, transparent: true, opacity: CONFIG.chipOpacity * 2
      });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(-chip.w/2 + 0.05, chip.h/2 - 0.05, 0.001);
      group.add(dot);

      group.userData = { phase: chip.phase, body: body };
      scene.add(group);
      chips.push(group);
    });

    // Vias (small circles)
    for(let i = 0; i < 30; i++){
      const x = (Math.random() - 0.5) * 10;
      const y = (Math.random() - 0.5) * 7;
      const via = new THREE.Mesh(
        new THREE.RingGeometry(0.02, 0.035, 12),
        new THREE.MeshBasicMaterial({
          color: CONFIG.traceColor, transparent: true,
          opacity: CONFIG.traceOpacity * 0.8, side: THREE.DoubleSide
        })
      );
      via.position.set(x, y, 0);
      scene.add(via);
    }
  }

  // ── Position on multi-segment path ──
  function getPositionOnPath(tracePoints, segments, totalLength, t){
    const dist = t * totalLength;
    let accumulated = 0;
    for(let i = 0; i < segments.length; i++){
      if(accumulated + segments[i].length >= dist){
        const localT = (dist - accumulated) / segments[i].length;
        return new THREE.Vector3().lerpVectors(tracePoints[i], tracePoints[i + 1], localT);
      }
      accumulated += segments[i].length;
    }
    return tracePoints[tracePoints.length - 1].clone();
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
    camera = new THREE.OrthographicCamera(-6 * aspect, 6 * aspect, 6, -6, 0.1, 10);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const layout = generateCircuit();
    buildScene(layout);

    // Hide old SVG worldmap
    const oldMap = consoleScreen.querySelector('.console-worldmap');
    if(oldMap) oldMap.style.display = 'none';

    window.addEventListener('resize', onResize);
    animate();
  }

  // ── Animation loop ──
  function animate(){
    animId = requestAnimationFrame(animate);
    const t = performance.now() * 0.001;

    // Pulses traveling along traces
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
        d.delay = 1 + Math.random() * 5;
        pulse.material.opacity = 0;
        if(pulse.children[0]) pulse.children[0].material.opacity = 0;
        return;
      }

      const pos = getPositionOnPath(d.tracePoints, d.segments, d.totalLength, d.progress);
      pulse.position.copy(pos);

      const edgeFade = Math.min(d.progress * 6, (1 - d.progress) * 6, 1);
      pulse.material.opacity = CONFIG.pulseOpacity * edgeFade;
      if(pulse.children[0]) pulse.children[0].material.opacity = CONFIG.pulseOpacity * 0.25 * edgeFade;
    });

    // Chip glow pulsing
    chips.forEach(chip => {
      const glow = Math.sin(t * 0.4 + chip.userData.phase) * 0.5 + 0.5;
      if(chip.userData.body){
        chip.userData.body.material.opacity = CONFIG.chipOpacity + glow * CONFIG.chipGlowOpacity;
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
    camera.left = -6 * aspect;
    camera.right = 6 * aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  // ── Cleanup ──
  function destroy(){
    if(animId) cancelAnimationFrame(animId);
    window.removeEventListener('resize', onResize);
    if(renderer){ renderer.dispose(); renderer.domElement.remove(); }
  }

  window._circuit = { destroy };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 300);
  }

})();
