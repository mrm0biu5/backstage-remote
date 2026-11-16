// The Newspaper's live look preview, shared by the Mac page (ui/index.html) and the phone page (remote/index.html).
// The Mac sends the latest page without effects (raw.jpg) and each effect's map (maps1/maps2/masks.png, made by
// age() in newspaper/frontpage.py); this redraws age() on the phone's GPU as the Look sliders move, so the effects
// show at once. Apply saves the sliders; the Mac then makes the real page. The fine noise here is made on the spot,
// so it isn't grain-for-grain the final page, but it's the same amount.
window.NPPreview = (() => {
  const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = p * .5 + .5; uv.y = 1. - uv.y; gl_Position = vec4(p, 0, 1); }`;
  const NOISE = `
    float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453) * 2. - 1.; }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(hs(i), hs(i + vec2(1, 0)), f.x), mix(hs(i + vec2(0, 1)), hs(i + vec2(1, 1)), f.x), f.y) * 2.7; }`;
  // (pass 1: letterpress, as age(): wandering outlines and ragged stroke edges, type 0.8 and rules 0.5, never photos)
  const FS1 = `precision highp float; varying vec2 uv; uniform sampler2D raw, masks; uniform vec2 size; uniform float pt, pr; ${NOISE}
    void main(){
      vec2 px = uv * size; vec4 m = texture2D(masks, uv); float photo = m.r, rules = m.g;
      float press = (.8 * pt * (1. - rules) + .5 * pr * rules) * (1. - photo);
      vec2 d = vec2(vn(px / 6. + 3.1), vn(px / 6. + 17.7)) * .45 * press;
      vec3 c = texture2D(raw, (px + d) / size).rgb;
      float ink = 1. - (c.r + c.g + c.b) / 3.;
      float band = clamp(1. - abs(ink - .5) / .4, 0., 1.) * (1. - photo);
      float rough = clamp(ink + (vn(px / 1.4 + 40.) * .09 + vn(px / 5. + 80.) * .05) * band * press, 0., 1.);
      gl_FragColor = vec4(mix(c, vec3(1. - rough), band), 1.);
    }`;
  // (pass 2: softness, wear, folds, black level, grain, paper and colour, in age()'s order)
  const FS2 = `precision highp float; varying vec2 uv; uniform sampler2D img, masks, maps1, maps2; uniform vec2 size;
    uniform float pp, bl, wear, folds, grain, black, paper, warmth; ${NOISE}
    vec3 mid(vec2 q){ return texture2D(img, vec2(q.x, 1. - q.y)).rgb; }   // (pass 1's picture is stored upside down)
    void main(){
      vec2 px = uv * size; float photo = texture2D(masks, uv).r;
      float soft = 1. - (1. - .5 * pp) * photo;
      float sg = mix(.43, .68, soft) * max(.05, bl);
      vec3 acc = vec3(0.); float ws = 0.;
      for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) {
        float w = exp(-float(i * i + j * j) / (2. * sg * sg)); acc += w * mid((px + vec2(i, j)) / size); ws += w; }
      vec3 c = acc / ws * 255.;
      vec4 a = texture2D(maps1, uv), b = texture2D(maps2, uv);
      c -= (a.r * 255. - 128.) / 250. * 46. * .8 * wear * vec3(.8, .92, 1.);
      float dark = 1. - (c.r + c.g + c.b) / 765.;
      c += dark * (a.g - .5) * 90. * soft;
      c += vn(px / 2.4 + 7.) * .068 * 28. * dark * soft;
      c -= b.g * vec3(10., 17., 22.);
      c -= a.b * vec3(15., 23., 26.) * wear;
      c -= b.b * 255. * .045 * wear;
      c -= a.a * 32. * wear;
      c = mix(c, vec3(100.), b.a);
      c += (b.r * 255. - 128.) / 2.5 * folds;
      c = clamp(c, 0., 255.);
      vec3 bk = vec3(black + 2., black - 1., black - 3.);
      c = bk + c * (255. - bk) / 255.;
      dark = 1. - (c.r + c.g + c.b) / 765.;
      c += vn(px / 1.4 + 90.) * .116 * 34. * dark * soft * grain;
      c += pow(clamp(c, 0., 255.) / 255., vec3(3.)) * paper;
      float t = warmth / 100.;
      if (t > 0.) c *= vec3(1. + .03 * t, 1. - .07 * t, 1. - .2 * t);
      else if (t < 0.) { float g = (c.r + c.g + c.b) / 3.; c = c * (1. + t * .9) + g * (-t * .9) + (-t) * 6.; }
      gl_FragColor = vec4(clamp(c, 0., 255.) / 255., 1.);
    }`;

  const css = `
  #npp{position:fixed;inset:0;z-index:9999;background:#000;display:flex;flex-direction:column;font:14px -apple-system,sans-serif;color:#eee}
  #npp .view{flex:1;overflow:auto;padding-top:calc(env(safe-area-inset-top) + 8px);-webkit-overflow-scrolling:touch;display:flex;justify-content:center}
  #npp .pg{position:relative;width:100%;max-width:600px;align-self:flex-start}
  #npp canvas,#npp .tpl{width:100%;height:auto;display:block}
  #npp .tpl{position:absolute;inset:0;display:none}#npp.tplon .tpl{display:block}
  #npp.zoom .pg{width:250%;max-width:none}
  #npp .sheet{background:rgba(20,20,26,.94);border-top:1px solid #333;padding:0 14px calc(env(safe-area-inset-bottom) + 10px);max-height:44vh;display:flex;flex-direction:column;min-height:0}
  #npp .grab{touch-action:none;padding:7px 0 6px;margin:0 -14px;cursor:grab}#npp .grab:before{content:'';display:block;width:40px;height:5px;border-radius:3px;background:#555;margin:0 auto}
  #npp .sl{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;min-height:0}
  #npp.drag .sheet{max-height:none}
  #npp.hide .sheet .sl{display:none}
  #npp .bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:4px}
  #npp .bar b{flex-basis:100%;font-size:13px;color:#aaa;font-weight:500}
  #npp .bar button{flex:1}
  #npp button{font:inherit;font-weight:600;border:0;border-radius:9px;padding:8px 12px;background:#2a2a33;color:#eee}
  #npp button.gold{background:#d8b25a;color:#1a1405}
  #npp label{display:flex;justify-content:space-between;font-size:12.5px;color:#bbb;margin-top:8px}
  #npp label i{font-style:normal;color:#d8b25a;font-weight:650}
  #npp input[type=range]{width:100%;accent-color:#d8b25a;margin:2px 0}`;

  function compile(gl, vs, fs) {
    const p = gl.createProgram();
    for (const [t, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); gl.attachShader(p, s);
    }
    gl.linkProgram(p); return p;
  }
  function texture(gl, src, w, h) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  }
  const image = blob => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('picture didn\'t load')); i.src = URL.createObjectURL(blob); });

  // fields: the act's range fields ({key, label, min, max, step, unit}); values: {key: number};
  // load(name) → Blob of a preview file; save(values) → Promise (stores the sliders; the Mac then makes the page)
  async function open({fields, values, load, save, template}) {
    if (!document.getElementById('npp-css')) { const st = document.createElement('style'); st.id = 'npp-css'; st.textContent = css; document.head.appendChild(st); }
    const box = document.createElement('div'); box.id = 'npp';
    box.innerHTML = `<div class="view"><div class="pg"><canvas></canvas><img class="tpl" alt=""></div></div><div class="sheet"><div class="grab"></div><div class="bar"><b>Loading the page…</b>
      <button data-a="tpl">Template</button><button data-a="hide">Sliders</button><button data-a="close">Cancel</button><button class="gold" data-a="apply">Apply</button></div>
      <div class="sl">${fields.map(f => `<label>${f.label}<i id="npv-${f.key}"></i></label>
      <input type="range" data-k="${f.key}" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${values[f.key]}">`).join('')}</div></div>`;
    document.body.appendChild(box);
    const v = Object.fromEntries(fields.map(f => [f.key, +values[f.key]]));
    const label = () => fields.forEach(f => box.querySelector('#npv-' + f.key).textContent = v[f.key] + (f.unit || ''));
    label();
    const status = box.querySelector('.bar b'), close = () => box.remove();
    box.querySelector('[data-a=close]').onclick = close;
    box.querySelector('[data-a=hide]').onclick = () => { box.classList.toggle('hide'); sheet.style.height = ''; box.classList.remove('drag'); };
    // (swipe the handle or the bar up/down to make the sliders panel taller or shorter and see more of the page)
    const sheet = box.querySelector('.sheet');
    let drag = null;
    const grabbed = e => e.target.closest('.grab') || (e.target.closest('.bar') && !e.target.closest('button'));
    sheet.addEventListener('pointerdown', e => {
      if (!grabbed(e)) return;
      box.classList.remove('hide'); drag = {y: e.clientY, h: sheet.getBoundingClientRect().height};
      sheet.setPointerCapture(e.pointerId);
    });
    sheet.addEventListener('pointermove', e => {
      if (!drag) return;
      const min = box.querySelector('.grab').offsetHeight + box.querySelector('.bar').offsetHeight + 12;
      box.classList.add('drag');
      sheet.style.height = Math.max(min, Math.min(innerHeight * .85, drag.h + drag.y - e.clientY)) + 'px';
    });
    sheet.addEventListener('pointerup', () => drag = null); sheet.addEventListener('pointercancel', () => drag = null);
    box.querySelector('.bar').style.touchAction = 'none';
    // (the template: which trick value goes where, over the page; loaded the first time it's shown)
    const tpl = box.querySelector('.tpl'), tb = box.querySelector('[data-a=tpl]');
    const showTpl = async on => {
      if (on && !tpl.src) { try { tpl.src = URL.createObjectURL(await load('template.jpg')); } catch (e) { status.textContent = 'No template yet: make a page first'; return; } }
      box.classList.toggle('tplon', on); tb.className = on ? 'gold' : '';
    };
    tb.onclick = () => showTpl(!box.classList.contains('tplon'));
    if (template) { showTpl(true); box.classList.add('hide'); }
    box.querySelector('[data-a=apply]').onclick = async () => {
      status.textContent = 'Saving…';
      try { await save(v); status.textContent = 'Saved: the Mac is making the page'; setTimeout(close, 900); } catch (e) { status.textContent = 'Not saved: ' + e.message; }
    };
    const cv = box.querySelector('canvas');
    box.querySelector('.pg').onclick = e => {         // (tap: zoom in on that spot, tap again to see the whole page)
      const r = cv.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      box.classList.toggle('zoom');
      const view = box.querySelector('.view');
      if (box.classList.contains('zoom')) requestAnimationFrame(() => { view.scrollLeft = fx * cv.clientWidth - view.clientWidth / 2; view.scrollTop = fy * cv.clientHeight - view.clientHeight / 2; });
    };
    let draw;
    try {
      const [raw, maps1, maps2, masks] = await Promise.all(['raw.jpg', 'maps1.png', 'maps2.png', 'masks.png'].map(n => load(n).then(image)));
      const W = raw.naturalWidth, H = raw.naturalHeight; cv.width = W; cv.height = H;
      const gl = cv.getContext('webgl', {preserveDrawingBuffer: true});
      if (!gl) throw new Error('this browser has no WebGL');
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const p1 = compile(gl, VS, FS1), p2 = compile(gl, VS, FS2);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      const T = {raw: texture(gl, raw), maps1: texture(gl, maps1), maps2: texture(gl, maps2), masks: texture(gl, masks), mid: texture(gl, null, W, H)};
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, T.mid, 0);
      const use = (p, tex, u) => {
        gl.useProgram(p); const loc = gl.getAttribLocation(p, 'p');
        gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        Object.entries(tex).forEach(([name, t], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(gl.getUniformLocation(p, name), i); });
        gl.uniform2f(gl.getUniformLocation(p, 'size'), W, H);
        Object.entries(u).forEach(([k, x]) => gl.uniform1f(gl.getUniformLocation(p, k), x));
        gl.viewport(0, 0, W, H); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };
      draw = () => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        use(p1, {raw: T.raw, masks: T.masks}, {pt: v.press_type / 100, pr: v.press_rules / 100});
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        use(p2, {img: T.mid, masks: T.masks, maps1: T.maps1, maps2: T.maps2},
          {pp: v.photo_print / 100, bl: v.blur / 100, wear: v.wear / 100, folds: v.folds / 100, grain: v.grain / 100,
           black: v.black, paper: v.paper, warmth: v.warmth});
      };
      draw(); status.textContent = 'Live preview · tap the page to zoom · Template shows what goes where';
    } catch (e) { status.textContent = 'No preview: ' + e.message; }
    let queued = false;
    box.querySelectorAll('input[type=range]').forEach(i => i.oninput = () => {
      v[i.dataset.k] = +i.value; label();
      if (draw && !queued) { queued = true; requestAnimationFrame(() => { queued = false; draw(); }); }
    });
  }
  return {open};
})();
