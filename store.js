/* طبقة البيانات المشتركة بين home.html و admin.html — Supabase + كاش محلي */
const Store = (() => {
  const URL_ = 'https://wharntehlnmubyewcnsb.supabase.co';
  const KEY_ = 'sb_publishable_Yab8ELxvLOiQJggxhLAaAA_3pR6B0Z9';
  const KEY = 'b25data', AUTH = 'b25auth';
  const DEF = () => ({ images: [], home: { bg: null, interval: 5 }, slides: [], services: [] });
  const norm = d => { d = d || {}; const b = DEF(); return { images: d.images || [], home: Object.assign(b.home, d.home || {}), slides: d.slides || [], services: d.services || [] }; };
  let cache = (() => { try { return norm(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return DEF(); } })();
  let timer = 0, pending = null, saving = false;

  const getAuth = () => { try { return JSON.parse(localStorage.getItem(AUTH) || 'null'); } catch (e) { return null; } };
  const setAuth = a => { try { a ? localStorage.setItem(AUTH, JSON.stringify(a)) : localStorage.removeItem(AUTH); } catch (e) {} };
  const hdr = (token, extra) => Object.assign({ apikey: KEY_, 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}, extra || {});

  async function tokenCall(grant, body) {
    const r = await fetch(`${URL_}/auth/v1/token?grant_type=${grant}`, { method: 'POST', headers: hdr(), body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok || !j.access_token) throw new Error(j.error_description || j.msg || 'فشل الدخول');
    setAuth({ token: j.access_token, refresh: j.refresh_token });
    return j.access_token;
  }
  async function freshToken() {
    const a = getAuth(); if (!a) return null;
    try { return await tokenCall('refresh_token', { refresh_token: a.refresh }); } catch (e) { setAuth(null); return null; }
  }
  const err = m => { try { window.toast && window.toast(m, 1); } catch (e) {} };

  async function push(d) {
    let a = getAuth(), t = a && a.token;
    const go = tk => fetch(`${URL_}/rest/v1/b25?id=eq.main`, { method: 'PATCH', headers: hdr(tk, { Prefer: 'return=minimal' }), body: JSON.stringify({ data: d, updated_at: new Date().toISOString() }) });
    let r = await go(t);
    if (r.status === 401 || r.status === 403) { t = await freshToken(); if (!t) throw new Error('سجّل الدخول من جديد'); r = await go(t); }
    if (!r.ok) throw new Error('HTTP ' + r.status);
  }
  async function flush() {
    if (saving || !pending) return;
    saving = true; const d = pending; pending = null;
    try { await push(d); } catch (e) { err('فشل الحفظ على السيرفر: ' + e.message); }
    saving = false; if (pending) flush();
  }

  return {
    uid: () => Math.random().toString(36).slice(2, 9),
    load() { return cache; },
    save(d) {
      cache = d;
      try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* الكاش المحلي ممكن يمتلي، السيرفر هو الأساس */ }
      pending = d; clearTimeout(timer); timer = setTimeout(flush, 500);
      return true;
    },
    async init() {
      try {
        const r = await fetch(`${URL_}/rest/v1/b25?id=eq.main&select=data`, { headers: hdr() });
        if (r.ok) {
          const rows = await r.json(), remote = rows[0] && rows[0].data;
          if (remote && Object.keys(remote).length) { cache = norm(remote); try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) {} }
          else if (getAuth() && (cache.images.length || cache.services.length || cache.slides.length)) { pending = cache; flush(); } // ترحيل بيانات التجربة
        }
      } catch (e) { /* أوفلاين: نستخدم الكاش */ }
      return cache;
    },
    /* شاشة دخول الأدمن */
    async gate() {
      if (getAuth() && await freshToken()) return;
      return new Promise(res => {
        const o = document.createElement('div');
        o.style.cssText = 'position:fixed;inset:0;z-index:99;background:#0b1730;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Tajawal,sans-serif';
        o.innerHTML = '<div style="width:100%;max-width:360px;background:#13264a;border:1px solid #25417a;border-radius:18px;padding:18px;color:#fff"><h3 style="margin:0 0 10px">🔐 دخول الأدمن</h3><input id="ge" type="email" dir="ltr" placeholder="الإيميل" style="width:100%;padding:11px;margin:6px 0;border-radius:12px;border:1px solid #25417a;background:#0b1730;color:#fff;font:inherit"><input id="gp" type="password" dir="ltr" placeholder="الباسورد" style="width:100%;padding:11px;margin:6px 0;border-radius:12px;border:1px solid #25417a;background:#0b1730;color:#fff;font:inherit"><p id="gm" style="color:#ff8a8d;font-size:13px;min-height:18px;margin:4px 0"></p><button id="gb" style="width:100%;padding:12px;border:0;border-radius:12px;background:#0199E0;color:#fff;font:inherit;font-weight:800">دخول</button></div>';
        document.body.appendChild(o);
        const go = async () => {
          const m = o.querySelector('#gm'); m.textContent = '...';
          try { await tokenCall('password', { email: o.querySelector('#ge').value.trim(), password: o.querySelector('#gp').value }); o.remove(); res(); }
          catch (e) { m.textContent = 'خطأ: ' + e.message; }
        };
        o.querySelector('#gb').onclick = go;
        o.querySelector('#gp').onkeydown = e => { if (e.key === 'Enter') go(); };
      });
    },
    img(d, id) { const i = d.images.find(x => x.id == id); return i ? i.src : null; },
    compress(file, max = 1400, q = 0.72) {
      return new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onerror = rej;
        fr.onload = () => {
          const im = new Image();
          im.onerror = rej;
          im.onload = () => {
            const k = Math.min(1, max / Math.max(im.width, im.height));
            const c = document.createElement('canvas');
            c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
            c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
            res(c.toDataURL('image/jpeg', q));
          };
          im.src = fr.result;
        };
        fr.readAsDataURL(file);
      });
    }
  };
})();
