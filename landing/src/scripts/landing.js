import copy from '../data/home.json';
const supported = Object.keys(copy);
let currentLang = document.documentElement.lang;
function setLang(lang) {
 currentLang = supported.includes(lang) ? lang : 'uk';
 document.documentElement.lang = currentLang;
 document.title = `SlovakGO — ${copy[currentLang].eyebrow}`;
 document.querySelector('meta[name="description"]')?.setAttribute('content',copy[currentLang].lead);
 document.querySelectorAll('[data-t]').forEach(el => { const value = copy[currentLang][el.dataset.t]; if (typeof value === 'string') el.innerHTML = value; });
 document.querySelectorAll('[data-alt]').forEach(el => { el.alt = copy[currentLang][el.dataset.alt] || ''; });
 document.querySelectorAll('[data-alt]').forEach(el => { el.alt = copy[currentLang][el.dataset.alt] || ''; });
 document.querySelectorAll('[data-lang]').forEach(button => { const active = button.dataset.lang === currentLang; button.classList.toggle('active', active); if (button.tagName === 'A') { if (active) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current'); } else button.setAttribute('aria-pressed', String(active)); });
 document.querySelector('.lesson-feedback').textContent = '';
 document.querySelector('.lesson-next').hidden = true;
 document.querySelectorAll('.lesson-option').forEach(el => { el.classList.remove('selected','wrong'); el.setAttribute('aria-pressed','false'); });
 document.querySelectorAll('a[href^="https://app.slovakgo.sk"]').forEach(a => { const url = new URL(a.href); url.searchParams.set('lang',currentLang); a.href = url.toString(); });
 try { localStorage.setItem('slovakgo-site-lang', currentLang); } catch {}
}
document.querySelectorAll('[data-lang]').forEach(button => button.addEventListener('click', () => {
 setLang(button.dataset.lang);
 const url = new URL(location.href); url.searchParams.set('lang', currentLang); history.replaceState(null,'',url);
}));
document.querySelectorAll('.lesson-option').forEach(button => button.addEventListener('click', () => {
 const correct = button.dataset.correct === 'true';
 document.querySelectorAll('.lesson-option').forEach(el => { el.classList.remove('selected','wrong'); el.setAttribute('aria-pressed','false'); });
 button.classList.add(correct ? 'selected' : 'wrong'); button.setAttribute('aria-pressed','true');
 document.querySelector('.lesson-feedback').textContent = copy[currentLang][correct ? 'correct' : 'incorrect'];
 document.querySelector('.lesson-next').hidden = !correct;
}));
const requested = new URLSearchParams(location.search).get('lang');
setLang(supported.includes(requested) ? requested : document.documentElement.lang);
// Show mobile registration action only after the hero, without duplicating the final CTA.
const sticky = document.querySelector('.sticky');
if ('IntersectionObserver' in window) {
 let heroVisible = true, footerVisible = false;
 const observer = new IntersectionObserver(entries => {
  for (const entry of entries) { if (entry.target.classList.contains('hero')) heroVisible = entry.isIntersecting; else footerVisible = entry.isIntersecting; }
  sticky.classList.toggle('is-visible', !heroVisible && !footerVisible);
 }, {threshold:0});
 observer.observe(document.querySelector('.hero')); observer.observe(document.querySelector('.footer'));
}
