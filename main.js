/* ============================================================
   QUENCH — interactions
   Progressive enhancement: the page reads fully without JS.
   Signature: a raw-WebGL domain-warped fragment shader paints
   Damascus banding into the blade clip. No libraries.
   ============================================================ */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const root = document.documentElement;

  /* ---------- theme toggle ---------- */
  const themeBtn = document.getElementById('themeBtn');
  const syncTheme = () => {
    const dark = root.dataset.theme !== 'light';
    themeBtn.setAttribute('aria-pressed', String(dark));
    themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#131211' : '#e9e4db');
  };
  syncTheme();
  themeBtn?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('quench-theme', root.dataset.theme); } catch (e) {}
    syncTheme();
  });

  /* ---------- hero intro ---------- */
  const hero = document.querySelector('.hero');
  const bladeFig = document.querySelector('.blade-fig');
  requestAnimationFrame(() => {
    if (hero) hero.classList.add('loaded');
    setTimeout(() => bladeFig && bladeFig.classList.add('lit'), 300);
  });

  /* ---------- reveals + step rails ---------- */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }
  }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.reveal, .step').forEach(el => io.observe(el));

  /* set each step's rail colour from its data-heat */
  document.querySelectorAll('.step').forEach(s => {
    if (s.dataset.heat) s.style.setProperty('--heat', s.dataset.heat);
  });

  /* ---------- animated counters ---------- */
  const cio = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target, to = parseFloat(el.dataset.to), dec = +(el.dataset.dec || 0);
      cio.unobserve(el);
      if (reduce) { el.textContent = to.toFixed(dec); continue; }
      const dur = 1400, t0 = performance.now();
      const tick = (t) => {
        const p = clamp((t - t0) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (to * eased).toFixed(dec);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }, { threshold: 0.6 });
  document.querySelectorAll('.c-num').forEach(el => cio.observe(el));

  /* ---------- heat rail fill on scroll through the forge ---------- */
  const heatFill = document.getElementById('heatFill');
  const forge = document.getElementById('forge');
  if (heatFill && forge) {
    const onScroll = () => {
      const r = forge.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = clamp((vh - r.top) / (vh + r.height), 0, 1);
      heatFill.style.width = (p * 100).toFixed(1) + '%';
    };
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
  }

  /* ---------- commission demo form ---------- */
  const form = document.getElementById('commForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.querySelector('#cName'), email = form.querySelector('#cEmail');
      if (!name.checkValidity()) { name.reportValidity(); return; }
      if (!email.checkValidity()) { email.reportValidity(); return; }
      form.innerHTML =
        '<div class="comm-done"><strong>You’re in the book.</strong>' +
        '<span class="mono">demo only — no message sent. i’d normally reply within a day, between heats.</span></div>';
    });
  }

  /* ============================================================
     Damascus shader — raw WebGL, one fullscreen quad.
     fbm + domain warp -> banded steel; a slow specular drift.
     ============================================================ */
  const canvas = document.getElementById('damascus');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { antialias: true, premultipliedAlpha: false, alpha: false });
  if (!gl) { canvas.style.background = 'linear-gradient(135deg,#2a2d31,#4a5158,#20242a)'; return; }

  const vs = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
  const fs = `
  precision highp float;
  uniform vec2 u_res; uniform float u_t; uniform float u_dark;
  // classic value-noise fbm
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+vec2(1.,1.));
    vec2 u=f*f*(3.-2.*f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  float fbm(vec2 p){
    float s=0., a=.5;
    for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=.5; }
    return s;
  }
  void main(){
    vec2 uv = gl_FragCoord.xy / u_res.xy;
    vec2 p = uv * vec2(6.0, 3.2);
    // domain warp — the fold. warp field drifts very slowly.
    vec2 q = vec2(fbm(p + vec2(0.0, u_t*0.03)), fbm(p + vec2(5.2, 1.3)));
    vec2 r = vec2(fbm(p + 3.4*q + vec2(1.7, 9.2)), fbm(p + 3.4*q + vec2(8.3, 2.8)));
    float f = fbm(p + 2.6*r);
    // banding: many folded layers
    float bands = sin((r.x*2.0 + f*3.0 + uv.x*1.2) * 22.0);
    bands = smoothstep(-0.15, 0.15, bands);
    float layer = mix(0.30, 0.86, bands);
    layer *= 0.72 + 0.5*f;                        // large-scale light variation
    // specular drift across the blade
    float spec = smoothstep(0.72, 1.0, sin(uv.x*3.14159 - u_t*0.25 + uv.y*1.2)*0.5+0.5);
    layer += spec * 0.22;
    // steel tint (cool) with a faint warm quench glow low & right
    vec3 steel = vec3(0.52,0.57,0.62);
    vec3 col = steel * layer;
    float heat = smoothstep(0.55, 0.0, uv.y) * smoothstep(0.1, 0.9, uv.x);
    col = mix(col, col*vec3(1.5,0.7,0.35)+vec3(0.18,0.05,0.0), heat*0.28);
    // light theme: brighter, less contrast
    col = mix(col, col*0.9+0.28, u_dark<0.5 ? 0.35 : 0.0);
    col = pow(col, vec3(0.9));
    gl_FragColor = vec4(col, 1.0);
  }`;

  const compile = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  };
  const vso = compile(gl.VERTEX_SHADER, vs), fso = compile(gl.FRAGMENT_SHADER, fs);
  if (!vso || !fso) { canvas.style.background = 'linear-gradient(135deg,#2a2d31,#4a5158,#20242a)'; return; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vso); gl.attachShader(prog, fso); gl.linkProgram(prog); gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'u_res');
  const uT = gl.getUniformLocation(prog, 'u_t');
  const uDark = gl.getUniformLocation(prog, 'u_dark');

  const dpr = () => Math.min(devicePixelRatio || 1, 1.5);
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr()));
    canvas.height = Math.max(1, Math.floor(h * dpr()));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  const draw = (t) => {
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uT, t);
    gl.uniform1f(uDark, root.dataset.theme === 'light' ? 0.0 : 1.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const ro = new ResizeObserver(() => { resize(); if (reduce) draw(6.0); });
  ro.observe(canvas);
  resize();

  if (reduce) {
    draw(6.0);                                   // one static, fully-etched frame
  } else {
    let running = true;
    const io2 = new IntersectionObserver((es) => { running = es[0].isIntersecting; if (running) requestAnimationFrame(loop); },
      { threshold: 0 });
    io2.observe(canvas);
    const t0 = performance.now();
    let last = 0;
    const loop = (t) => {
      if (!running) return;
      if (t - last >= 33) {                        // ~30fps — the pattern drifts slowly
        draw((t - t0) / 1000);
        last = t;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
})();
