// Pemeriksa kontras WCAG di dalam halaman: untuk tiap elemen yang punya teks langsung, hitung rasio kontras warna teks
// terhadap latar EFEKTIF (menumpuk lapisan latar transparan ke atas pohon DOM; untuk gradien dipakai kasus terburuk).
export async function contrastReport(page, { minRatio = 4.5, minLarge = 3 } = {}) {
  return page.evaluate(({ minRatio, minLarge }) => {
    const parse = (c) => {
      const m = c && c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[,/ ]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const over = (top, bottom) => {
      const a = top.a + bottom.a * (1 - top.a);
      if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
      return { r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a, g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a, b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a, a };
    };
    const lum = ({ r, g, b }) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
    const gradientColors = (img) => (img.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);

    // daftar latar efektif (satu atau beberapa warna bila ada gradien) untuk sebuah elemen
    const backgrounds = (el) => {
      let stack = [{ r: 255, g: 255, b: 255, a: 1 }]; // kanvas browser
      const chain = [];
      for (let n = el; n; n = n.parentElement) chain.unshift(n);
      const html = document.documentElement;
      const rootBg = parse(getComputedStyle(html).backgroundColor), bodyBg = parse(getComputedStyle(document.body).backgroundColor);
      if (rootBg && rootBg.a > 0) stack = [over(rootBg, stack[0])];
      for (const n of chain) {
        const cs = getComputedStyle(n);
        const bg = parse(cs.backgroundColor);
        const opacity = parseFloat(cs.opacity);
        const grads = cs.backgroundImage && cs.backgroundImage !== 'none' ? gradientColors(cs.backgroundImage) : [];
        let next = [];
        for (const base of stack) {
          let cur = base;
          if (bg && bg.a > 0) cur = over({ ...bg, a: bg.a }, cur);
          if (grads.length) grads.forEach((g) => next.push(over(g, cur))); else next.push(cur);
        }
        stack = next.length ? next : stack;
        if (opacity < 1) stack = stack.map((s, i) => over({ ...s, a: opacity }, stack[0]));
      }
      void bodyBg;
      return stack;
    };

    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let el;
    while ((el = walker.nextNode())) {
      const tag = el.tagName;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH'].includes(tag.toUpperCase())) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
      if (!own.length) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      let hiddenAncestor = false;
      for (let n = el; n; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) { hiddenAncestor = true; break; } }
      if (hiddenAncestor) continue;
      const fgRaw = parse(cs.color);
      if (!fgRaw) continue;
      const bgs = backgrounds(el);
      const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const need = large ? minLarge : minRatio;
      let worst = Infinity;
      for (const bg of bgs) { const fg = fgRaw.a < 1 ? over(fgRaw, bg) : fgRaw; worst = Math.min(worst, ratio(fg, bg)); }
      if (worst < need) {
        out.push({
          text: own.map((n) => n.textContent.trim()).join(' ').slice(0, 40),
          ratio: Math.round(worst * 100) / 100, need,
          fg: cs.color, cls: (el.getAttribute('class') || '').split(/\s+/).slice(0, 6).join(' '), tag,
        });
      }
    }
    return out;
  }, { minRatio, minLarge });
}
