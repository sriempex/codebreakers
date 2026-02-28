// ══════ THREE.JS — 3D Rotating Globe Background ══════
// Renders behind the console grid, replacing the static SVG worldmap

(function(){
  if(!window.THREE) return;

  let scene, camera, renderer, globe, wireframe, atmosphere, points, arcs;
  let animId = null;
  let container = null;
  const GLOBE_RADIUS = 2.2;
  const SEGMENTS = 48;

  // ── Data points (Sandals resort locations + key cities) ──
  const dataPoints = [
    { lat: 18.48, lng: -77.92, label: 'Kingston, Jamaica', color: 0x00ff88, size: 1.0 },
    { lat: 18.47, lng: -77.61, label: 'Montego Bay, Jamaica', color: 0x00ff88, size: 0.9 },
    { lat: 18.41, lng: -76.95, label: 'Ocho Rios, Jamaica', color: 0x00ff88, size: 0.8 },
    { lat: 14.02, lng: -60.99, label: 'Saint Lucia', color: 0x00d4ff, size: 0.8 },
    { lat: 12.12, lng: -61.68, label: 'Grenada', color: 0x00d4ff, size: 0.7 },
    { lat: 17.14, lng: -61.85, label: 'Antigua', color: 0x00d4ff, size: 0.7 },
    { lat: 25.06, lng: -77.35, label: 'Nassau, Bahamas', color: 0x00d4ff, size: 0.85 },
    { lat: 21.47, lng: -77.99, label: 'Cuba', color: 0xffaa33, size: 0.6 },
    { lat: 40.71, lng: -74.01, label: 'New York', color: 0xffaa33, size: 0.5 },
    { lat: 51.51, lng: -0.13, label: 'London', color: 0xffaa33, size: 0.5 },
  ];

  // ── Arc connections ──
  const arcConnections = [
    [0, 6],  // Kingston → Nassau
    [0, 3],  // Kingston → Saint Lucia
    [1, 4],  // Montego Bay → Grenada
    [6, 8],  // Nassau → New York
    [0, 9],  // Kingston → London
    [5, 3],  // Antigua → Saint Lucia
    [1, 5],  // Montego Bay → Antigua
  ];

  // ── Convert lat/lng to 3D position on sphere ──
  function latLngToVec3(lat, lng, radius){
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -(radius * Math.sin(phi) * Math.cos(theta)),
       (radius * Math.cos(phi)),
       (radius * Math.sin(phi) * Math.sin(theta))
    );
  }

  // ── Create the globe wireframe ──
  function createGlobe(){
    const group = new THREE.Group();

    // Main sphere wireframe — latitude/longitude grid
    const sphereGeo = new THREE.SphereGeometry(GLOBE_RADIUS, SEGMENTS, SEGMENTS / 2);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      wireframe: true,
      transparent: true,
      opacity: 0.04
    });
    wireframe = new THREE.Mesh(sphereGeo, sphereMat);
    group.add(wireframe);

    // Equator ring — brighter
    const equatorGeo = new THREE.RingGeometry(GLOBE_RADIUS - 0.005, GLOBE_RADIUS + 0.005, 128);
    const equatorMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide
    });
    const equator = new THREE.Mesh(equatorGeo, equatorMat);
    equator.rotation.x = Math.PI / 2;
    group.add(equator);

    // Tropics — fainter rings
    [23.5, -23.5].forEach(lat => {
      const r = GLOBE_RADIUS * Math.cos(lat * Math.PI / 180);
      const y = GLOBE_RADIUS * Math.sin(lat * Math.PI / 180);
      const ringGeo = new THREE.RingGeometry(r - 0.003, r + 0.003, 96);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = y;
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    });

    return group;
  }

  // ── Create atmospheric glow shell ──
  function createAtmosphere(){
    const geo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.15, 48, 24);
    const mat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main(){
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main(){
          float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
          gl_FragColor = vec4(0.0, 1.0, 0.53, 1.0) * intensity * 0.3;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });
    return new THREE.Mesh(geo, mat);
  }

  // ── Create data point markers ──
  function createDataPoints(){
    const group = new THREE.Group();

    dataPoints.forEach(pt => {
      const pos = latLngToVec3(pt.lat, pt.lng, GLOBE_RADIUS * 1.01);

      // Outer glow
      const glowGeo = new THREE.SphereGeometry(0.04 * pt.size, 12, 8);
      const glowMat = new THREE.MeshBasicMaterial({
        color: pt.color,
        transparent: true,
        opacity: 0.25
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.copy(pos);
      glow.userData = { baseScale: pt.size, phase: Math.random() * Math.PI * 2 };
      group.add(glow);

      // Inner core
      const coreGeo = new THREE.SphereGeometry(0.018 * pt.size, 8, 6);
      const coreMat = new THREE.MeshBasicMaterial({
        color: pt.color,
        transparent: true,
        opacity: 0.9
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.copy(pos);
      group.add(core);

      // Vertical spike
      const spikeGeo = new THREE.CylinderGeometry(0.002, 0.002, 0.08 * pt.size, 4);
      const spikeMat = new THREE.MeshBasicMaterial({
        color: pt.color,
        transparent: true,
        opacity: 0.4
      });
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.copy(pos);
      spike.lookAt(0, 0, 0);
      spike.rotateX(Math.PI / 2);
      spike.translateY(0.04 * pt.size);
      group.add(spike);
    });

    return group;
  }

  // ── Create animated arcs between data points ──
  function createArcs(){
    const group = new THREE.Group();

    arcConnections.forEach(([fromIdx, toIdx], i) => {
      const from = dataPoints[fromIdx];
      const to = dataPoints[toIdx];
      const start = latLngToVec3(from.lat, from.lng, GLOBE_RADIUS * 1.01);
      const end = latLngToVec3(to.lat, to.lng, GLOBE_RADIUS * 1.01);

      // Calculate arc midpoint elevated above globe surface
      const mid = start.clone().add(end).multiplyScalar(0.5);
      const dist = start.distanceTo(end);
      mid.normalize().multiplyScalar(GLOBE_RADIUS + dist * 0.35);

      // Build curve
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const curvePoints = curve.getPoints(48);
      const geo = new THREE.BufferGeometry().setFromPoints(curvePoints);

      const mat = new THREE.LineBasicMaterial({
        color: from.color,
        transparent: true,
        opacity: 0.15
      });
      const line = new THREE.Line(geo, mat);
      line.userData = {
        phase: i * 0.8,
        baseOpacity: 0.15,
        curvePoints: curvePoints,
        color: from.color
      };
      group.add(line);

      // Traveling pulse particle along the arc
      const pulseGeo = new THREE.SphereGeometry(0.015, 6, 4);
      const pulseMat = new THREE.MeshBasicMaterial({
        color: from.color,
        transparent: true,
        opacity: 0.7
      });
      const pulse = new THREE.Mesh(pulseGeo, pulseMat);
      pulse.userData = {
        curve: curve,
        speed: 0.08 + Math.random() * 0.06,
        progress: Math.random(),
        direction: 1
      };
      group.add(pulse);
    });

    return group;
  }

  // ── Create star field background ──
  function createStars(){
    const starsGeo = new THREE.BufferGeometry();
    const count = 600;
    const positions = new Float32Array(count * 3);
    for(let i = 0; i < count; i++){
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30 - 5;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starsMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.02,
      transparent: true,
      opacity: 0.3,
      sizeAttenuation: true
    });
    return new THREE.Points(starsGeo, starsMat);
  }

  // ── Initialize ──
  function init(){
    // Find or create container
    const consoleScreen = document.getElementById('consoleScreen');
    if(!consoleScreen) return;

    // Create canvas container
    container = document.createElement('div');
    container.id = 'globeCanvas';
    container.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;';
    consoleScreen.appendChild(container);

    // Scene
    scene = new THREE.Scene();

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(0, 0.5, 5.5);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Build scene objects
    globe = createGlobe();
    // Tilt the globe slightly for visual interest
    globe.rotation.x = 0.15;
    globe.rotation.z = -0.1;
    scene.add(globe);

    atmosphere = createAtmosphere();
    scene.add(atmosphere);

    points = createDataPoints();
    globe.add(points);

    arcs = createArcs();
    globe.add(arcs);

    scene.add(createStars());

    // Handle resize
    window.addEventListener('resize', onResize);

    // Start animation
    animate();

    // Hide the old SVG worldmap on console screen
    const oldMap = consoleScreen.querySelector('.console-worldmap');
    if(oldMap) oldMap.style.display = 'none';
  }

  // ── Animation loop ──
  function animate(){
    animId = requestAnimationFrame(animate);
    const t = performance.now() * 0.001; // seconds

    // Slow globe rotation
    if(globe){
      globe.rotation.y = t * 0.06; // ~3.4 degrees per second
    }

    // Pulse data point glows
    if(points){
      points.children.forEach(child => {
        if(child.userData.phase !== undefined){
          const pulse = Math.sin(t * 1.5 + child.userData.phase) * 0.5 + 0.5;
          child.scale.setScalar(1 + pulse * 0.6);
          child.material.opacity = 0.15 + pulse * 0.2;
        }
      });
    }

    // Animate arc pulses
    if(arcs){
      arcs.children.forEach(child => {
        // Traveling pulse particles
        if(child.userData.curve){
          child.userData.progress += child.userData.speed * 0.016;
          if(child.userData.progress > 1){
            child.userData.progress = 0;
          }
          const pos = child.userData.curve.getPoint(child.userData.progress);
          child.position.copy(pos);
          // Fade at endpoints
          const edgeDist = Math.min(child.userData.progress, 1 - child.userData.progress);
          child.material.opacity = Math.min(edgeDist * 5, 0.7);
        }
        // Arc line pulse
        if(child.userData.baseOpacity !== undefined){
          const pulse = Math.sin(t * 0.8 + child.userData.phase) * 0.5 + 0.5;
          child.material.opacity = child.userData.baseOpacity + pulse * 0.1;
        }
      });
    }

    // Atmosphere shimmer
    if(atmosphere){
      atmosphere.material.uniforms && void 0; // shader handles it
    }

    renderer.render(scene, camera);
  }

  // ── Resize handler ──
  function onResize(){
    if(!container || !camera || !renderer) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  // ── Cleanup (if needed) ──
  function destroy(){
    if(animId) cancelAnimationFrame(animId);
    window.removeEventListener('resize', onResize);
    if(renderer){
      renderer.dispose();
      renderer.domElement.remove();
    }
  }

  // ── Expose for external control ──
  window._globe = {
    destroy: destroy,
    getScene: () => scene,
    getGlobe: () => globe
  };

  // ── Start when DOM is ready ──
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Delay slightly to ensure console screen exists
    setTimeout(init, 300);
  }

})();
