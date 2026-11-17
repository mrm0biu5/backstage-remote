// DressUp's studio, shared by Backstage's two pages (ui/index.html on Wi-Fi, remote/index.html from anywhere).
// It draws from the act's "catalogue" (the looks and photo kinds from acts/_styles.py: no prompts here) and asks the
// page to send the "make" action. Your photos (sorted by kind, with how to take each) only on the Wi-Fi page: they
// never go to GitHub.
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const css = `
.studio{background:var(--card2);border-radius:12px;padding:12px;margin-top:12px}
.studio .lab{font-size:12px;color:var(--faint);text-transform:uppercase;letter-spacing:.06em;margin:12px 0 6px}
.studio .lab:first-child{margin-top:0}
.st-row{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}.st-row::-webkit-scrollbar{display:none}
.st-look{flex:0 0 auto;width:86px;font:inherit;color:var(--text);background:var(--bg);border:1.5px solid var(--line);border-radius:12px;padding:9px 4px;cursor:pointer;text-align:center}
.st-look .e{font-size:24px;display:block;line-height:1.2}.st-look .n{font-size:12px;display:block;margin-top:3px}
.st-look.sel{border-color:var(--gold);background:#2a2415}
.st-about{font-size:13px;color:var(--dim);margin-top:8px}.st-about b{color:var(--text);font-weight:600}
.st-chips{display:flex;flex-wrap:wrap;gap:6px}
.st-chip{font:inherit;font-size:13px;color:var(--dim);background:var(--bg);border:1px solid var(--line);border-radius:99px;padding:6px 11px;cursor:pointer}
.st-chip.sel{color:#1a1405;background:var(--gold);border-color:var(--gold)}
.st-pick{flex:0 0 auto;width:58px;aspect-ratio:3/4;border-radius:9px;overflow:hidden;border:2px solid transparent;background:var(--bg);cursor:pointer;padding:0;display:grid;place-items:center;color:var(--dim);font:inherit;font-size:11px;text-align:center}
.st-pick img{width:100%;height:100%;object-fit:cover;display:block}.st-pick.sel{border-color:var(--gold)}
.st-go{width:100%;margin-top:12px;padding:13px}
.st-sw{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;font-size:14px}
.shot{border-top:1px solid var(--line);padding:12px 0 4px}.shot:first-of-type{border-top:0}
.shot .top{display:flex;gap:12px;align-items:flex-start}
.shot svg{flex:0 0 auto;width:54px;height:72px;background:var(--bg);border-radius:8px}
.shot .t{font-weight:600}.shot .t span{color:var(--faint);font-weight:400;font-size:13px}
.shot .how{font-size:13px;color:var(--dim);margin-top:2px}.shot .for{font-size:12px;color:var(--faint);margin-top:3px}
.shot .grid{margin-top:10px;grid-template-columns:repeat(auto-fill,minmax(72px,1fr))}
.st-lib.res{grid-template-columns:repeat(3,1fr);gap:8px}.st-lib .t{font-size:12px}.st-lib .c{font-size:11px}
.st-lib .st-del{width:24px!important;height:24px!important;font-size:13px!important;top:4px!important;right:4px!important}
.rules{margin:8px 0 4px;padding-left:18px;font-size:13px;color:var(--dim)}.rules li{margin:3px 0}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // a little figure with the frame for each kind of photo (dashed gold = what's in the picture)
  function diagram(id) {
    const fig = {
      pose: '<circle cx="27" cy="16" r="5"/><path d="M27 21v20M27 41l-7 18M27 41l8 17M27 26l-12-8M27 26l12 -9"/>',
      side: '<circle cx="28" cy="16" r="5"/><path d="M27 21c-4 6-4 14-2 20M25 41l-2 18M25 41l4 18M26 27l6 8"/>',
    }[id] || '<circle cx="27" cy="16" r="5"/><path d="M27 21v20M27 41l-5 18M27 41l5 18M27 26l-8 12M27 26l8 12"/>';
    const box = id === 'hold' ? '<rect x="22" y="33" width="10" height="7" rx="1" fill="var(--gold)" stroke="none"/>' : '';
    const frame = {front: [10, 4, 34, 62], pose: [6, 4, 42, 62], mid: [12, 6, 30, 38], hold: [12, 6, 30, 38], side: [12, 6, 30, 38], close: [17, 7, 20, 22]}[id] || [10, 4, 34, 62];
    return `<svg viewBox="0 0 54 72"><g fill="none" stroke="var(--dim)" stroke-width="2.2" stroke-linecap="round">${fig}</g>${box}
      <rect x="${frame[0]}" y="${frame[1]}" width="${frame[2]}" height="${frame[3]}" rx="3" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-dasharray="3 2"/></svg>`;
  }

  const state = {};     // per act: {style, ideas:Set, photo}

  window.Studio = {
    // the studio (top of the DressUp page). opts.photos: the Wi-Fi page (can pick one of your photos)
    html(a, opts = {}) {
      const c = a.catalogue, s = state[a.name] = state[a.name] || {style: c.styles[0].id, ideas: new Set(), photo: ''};
      return `<div class="studio" id="st-${a.name}">
        <div class="lab">Who</div>
        <input type="text" class="st-name" placeholder="A name: Elvis, Harry Potter, the Hulk…" autocapitalize="words" autocorrect="off">
        <div class="lab">Look</div>
        <div class="st-row">${c.styles.map(x => `<button class="st-look${x.id === s.style ? ' sel' : ''}" data-style="${x.id}"><span class="e">${x.emoji || '✨'}</span><span class="n">${esc(x.name)}</span></button>`).join('')}</div>
        <div class="st-about"></div>
        <div class="lab">Ideas</div>
        <div class="st-chips"></div>
        <input type="text" class="st-extra" placeholder="Your own idea (optional)" style="margin-top:8px">
        ${opts.photos ? '<div class="lab">Photo of you</div><div class="st-row st-photos"></div>' : ''}
        <button class="btn gold st-go">Make it</button><div class="msg"></div></div>`;
    },
    // wires it up; send(args) → Promise of a message (the page's own route: hub or commands.json)
    wire(a, send) {
      const root = document.getElementById('st-' + a.name); if (!root) return;
      const s = state[a.name];
      root.querySelectorAll('.st-look').forEach(b => b.onclick = () => { s.style = b.dataset.style; s.ideas.clear(); Studio.update(a); });
      root.querySelector('.st-go').onclick = async () => {
        const msg = root.querySelector('.msg'), btn = root.querySelector('.st-go'), name = root.querySelector('.st-name').value.trim();
        if (!name) { msg.className = 'msg bad'; msg.textContent = 'Type a name first.'; return; }
        const extra = [...s.ideas, root.querySelector('.st-extra').value.trim()].filter(Boolean).join(', ');
        btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Sending…';
        try { const r = await send({value: name, style: s.style, extra, photo: s.photo});
          msg.className = 'msg ok'; msg.textContent = r || 'Making it…';
        } catch (e) { msg.className = 'msg bad'; msg.textContent = e.message; }
        btn.disabled = false;
      };
      Studio.update(a);
    },
    // redraws what depends on the chosen look (and your photos, when the page has them)
    update(a) {
      const root = document.getElementById('st-' + a.name); if (!root || !a.catalogue) return;
      const c = a.catalogue, s = state[a.name], look = c.styles.find(x => x.id === s.style) || c.styles[0];
      const shots = Object.fromEntries(c.shots.map(x => [x.id, x.name]));
      root.querySelectorAll('.st-look').forEach(b => b.classList.toggle('sel', b.dataset.style === s.style));
      root.querySelector('.st-about').innerHTML = `<b>${esc(look.about)}</b> ${esc(look.tips)}<br>Best photo: ${look.shots.slice(0, 2).map(k => esc(shots[k])).join(' or ')}.`;
      const chips = root.querySelector('.st-chips');
      chips.innerHTML = look.ideas.map(i => `<button class="st-chip${s.ideas.has(i) ? ' sel' : ''}">${esc(i)}</button>`).join('');
      chips.querySelectorAll('.st-chip').forEach(b => b.onclick = () => { const i = b.textContent; s.ideas.has(i) ? s.ideas.delete(i) : s.ideas.add(i); b.classList.toggle('sel'); });
      const row = root.querySelector('.st-photos');
      if (row && a.photos) {
        const files = a.photos.files; if (s.photo && !files.some(f => f.name === s.photo)) s.photo = '';
        // (the look's best kinds first)
        const rank = f => { const i = look.shots.indexOf(f.kind); return i < 0 ? 99 : i; };
        const sorted = [...files].sort((x, y) => rank(x) - rank(y));
        row.innerHTML = `<button class="st-pick${s.photo ? '' : ' sel'}" data-photo="">Best<br>for the<br>look</button>`
          + sorted.map(f => `<button class="st-pick${f.name === s.photo ? ' sel' : ''}" data-photo="${esc(f.name)}" title="${esc(shots[f.kind] || 'Other')}"><img loading="lazy" src="${esc(f.url)}"></button>`).join('');
        row.querySelectorAll('.st-pick').forEach(b => b.onclick = () => { s.photo = b.dataset.photo; Studio.update(a); });
      }
      const go = root.querySelector('.st-go');
      if (c.busy) { go.disabled = true; go.textContent = c.busy; } else if (go.textContent !== 'Make it') { go.disabled = false; go.textContent = 'Make it'; }
    },

    // every picture made, filterable by look (Wi-Fi page): tap one to open it full size
    libraryHTML(a) {
      return `<details class="fold"><summary>Library <span id="stln-${a.name}"></span></summary><div class="body">
        <div class="st-chips st-lf" style="margin-top:10px"></div><div class="res st-lib" style="margin-top:10px"></div></div></details>`;
    },
    libraryUpdate(a, remove) {
      const root = document.getElementById('act-' + a.name); if (!root || !a.gallery) return;
      const s = state[a.name], g = a.gallery, looks = Object.fromEntries(a.catalogue.styles.map(x => [x.id, x]));
      s.lib = s.lib || '';
      document.getElementById('stln-' + a.name).textContent = g.length ? `(${g.length})` : '';
      const have = [...new Set(g.map(x => x.style))];
      const lf = root.querySelector('.st-lf');
      lf.style.display = have.length < 2 ? 'none' : '';
      lf.innerHTML = [['', 'All']].concat(have.map(k => [k, (looks[k]?.emoji || '') + ' ' + (looks[k]?.name || k)]))
        .map(([k, n]) => `<button class="st-chip${s.lib === k ? ' sel' : ''}" data-lf="${k}">${esc(n)}</button>`).join('');
      lf.querySelectorAll('[data-lf]').forEach(b => b.onclick = () => { s.lib = b.dataset.lf; Studio.libraryUpdate(a, remove); });
      const shown = g.filter(x => !s.lib || x.style === s.lib);
      const lib = root.querySelector('.st-lib');
      lib.innerHTML = shown.length ? shown.map(x => `<div style="position:relative"><a href="${esc(x.url)}" target="_blank">
          <img loading="lazy" src="${esc(x.url)}"><div class="t">${esc(x.title)}</div>
          <div class="c">${esc((looks[x.style]?.name || '') + (x.when ? ' · ' + x.when : ''))}</div></a>
          <button class="st-del" data-file="${esc(x.file)}" title="Delete" style="position:absolute;top:6px;right:6px;width:28px;height:28px;border-radius:50%;border:0;background:rgba(0,0,0,.6);color:#fff;font-size:15px;cursor:pointer">×</button></div>`).join('')
        : '<div class="help">Nothing made yet: make one above.</div>';
      lib.querySelectorAll('.st-del').forEach(b => b.onclick = () => { if (confirm('Delete this picture?')) remove(b.dataset.file); });
    },

    // your photos, by kind, with how to take each (Wi-Fi page only): folded, under the studio
    photosHTML(a) {
      const c = a.catalogue;
      return `<details class="fold"><summary>Your photos <span id="stpn-${a.name}"></span></summary><div class="body">
        <div class="lab" style="font-size:12px;color:var(--faint);text-transform:uppercase;letter-spacing:.06em;margin-top:12px">How to take them</div>
        <ul class="rules">${c.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
        ${c.shots.concat([{id: '', name: 'Other', how: 'Added before photos had kinds. Used when a look has none of its own kind.', for: ''}]).map(x => `
        <div class="shot" data-kind="${x.id}"><div class="top">${x.id ? diagram(x.id) : ''}<div>
          <div class="t">${esc(x.name)} <span class="n"></span></div><div class="how">${esc(x.how)}</div>${x.for ? `<div class="for">${esc(x.for)}</div>` : ''}</div></div>
          <div class="grid"></div>${x.id ? `<input type="file" accept="image/*" multiple hidden id="stup-${a.name}-${x.id}" data-stup="${x.id}">` : ''}</div>`).join('')}
        <div class="msg" id="stpm-${a.name}"></div></div></details>`;
    },
    // fills the photo groups; upload(kind, file) and remove(name) are the page's own
    photosUpdate(a, upload, remove) {
      const root = document.getElementById('act-' + a.name); if (!root || !a.photos) return;
      const files = a.photos.files;
      document.getElementById('stpn-' + a.name).textContent = files.length ? `(${files.length})` : '— add some';
      root.querySelectorAll('.shot').forEach(g => {
        const k = g.dataset.kind, mine = files.filter(f => f.kind === k);
        if (!k && !mine.length) { g.hidden = true; return; }
        g.hidden = false; g.querySelector('.n').textContent = mine.length ? `· ${mine.length}` : '· none yet';
        const grid = g.querySelector('.grid');
        grid.innerHTML = mine.map(p => `<div class="ph"><img loading="lazy" src="${esc(p.url)}"><button title="Remove" data-del="${esc(p.name)}">×</button></div>`).join('')
          + (k ? `<label class="ph add" for="stup-${a.name}-${k}">＋<br>Add</label>` : '');
        grid.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (confirm('Remove this photo?')) remove(b.dataset.del); });
        const inp = g.querySelector('[data-stup]');
        if (inp) inp.onchange = async () => {
          const m = document.getElementById('stpm-' + a.name), list = [...inp.files];
          for (const [n, f] of list.entries()) { m.className = 'msg'; m.textContent = `Uploading ${n + 1} of ${list.length}…`;
            try { await upload(k, f); } catch (e) { m.className = 'msg bad'; m.textContent = f.name + ': ' + e.message; } }
          if (!m.classList.contains('bad')) m.textContent = ''; inp.value = '';
        };
      });
    },
  };
})();
