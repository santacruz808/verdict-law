(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const root = document.documentElement.style;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let k = 1, target = 1, from = 1, start = 0, animating = false, queued = null, surge = 0;
  try { k = target = from = localStorage.getItem('verdict-light') === 'day' ? 0 : 1; } catch {}
  const clamp = n => Math.min(1, Math.max(0, n));
  const smooth = (a,b,n) => { const x=clamp((n-a)/(b-a)); return x*x*(3-2*x); };
  function pressed(n) { $('day').setAttribute('aria-pressed', String(!n)); $('night').setAttribute('aria-pressed', String(!!n)); }
  function begin(n, now) { target=n; from=k; start=now; animating=true; pressed(n); }
  function pick(n) {
    try { localStorage.setItem('verdict-light',n?'night':'day'); } catch {}
    if(reduced.matches) { k=target=n;animating=false;queued=null;root.setProperty('--k',k);root.setProperty('--sink','0px');pressed(n);render(performance.now(),0);return; }
    if(animating) { queued=n;pressed(n);return; }
    if(n!==target)begin(n,performance.now());
  }
  root.setProperty('--k',k);pressed(k);
  $('day').addEventListener('click',()=>pick(0));$('night').addEventListener('click',()=>pick(1));
  const cv=$('fog'), gl=cv.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false});
  let uniforms={}, program=null, visible=true, raf=0;
  if(gl){
    const vs=`#version 300 es
    void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0,1);}`;
    const fs=`#version 300 es
    precision highp float;
    uniform vec2 R;uniform float T,S,K;out vec4 O;
    float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float a=.5,s=0.;mat2 m=mat2(1.6,1.2,-1.2,1.6);p=mat2(.8,.6,-.6,.8)*p+5.3;for(int i=0;i<5;i++){s+=a*n(p);p=m*p;a*=.5;}return s;}
    void main(){vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;vec2 p=vec2(uv.x*R.x/R.y,uv.y);float t=T*.035;vec2 w=vec2(fbm(p*1.3+vec2(t,-t*.6)),fbm(p*1.3+vec2(-t*.8,t)+7.));float d=fbm(p*1.9+w*1.7+vec2(t*1.6,-t*1.1+S*.5));float low=smoothstep(.76,1.15,uv.y+(d-.5)*.34)*.74;float front=1.05-S*.8;float rise=smoothstep(front-.02,front+.26,uv.y+(d-.5)*.5);float a=clamp(max(low,max(rise*.95,S*(.3+.46*d))),0.,1.);vec3 c=mix(mix(vec3(.58,.6,.54),vec3(.83,.82,.72),d),mix(vec3(.08,.12,.12),vec3(.3,.34,.3),d),K);O=vec4(c*a,a);}`;
    function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);return null;}return s;}
    const vertex=shader(gl.VERTEX_SHADER,vs),fragment=shader(gl.FRAGMENT_SHADER,fs);
    if(vertex&&fragment){program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);if(gl.getProgramParameter(program,gl.LINK_STATUS)){gl.useProgram(program);for(const name of ['R','T','S','K'])uniforms[name]=gl.getUniformLocation(program,name);}else program=null;}
  }
  function size(){if(!gl)return;const rect=cv.getBoundingClientRect(),w=Math.round(Math.min(rect.width,960)),h=Math.max(1,Math.round(w*rect.height/rect.width));cv.width=w;cv.height=h;gl.viewport(0,0,w,h);if(reduced.matches)render(performance.now(),0);}
  function render(now,s){if(!gl||!program||gl.isContextLost())return;gl.uniform2f(uniforms.R,cv.width,cv.height);gl.uniform1f(uniforms.T,reduced.matches?0:now/1000);gl.uniform1f(uniforms.S,s);gl.uniform1f(uniforms.K,k);gl.drawArrays(gl.TRIANGLES,0,3);}
  function frame(now){raf=0;let y=0;surge=0;if(animating){const d=now-start;if(d<240){const x=d/240;y=x*x*(3-2*x)*.15;}else y=Math.pow(1-clamp((d-240)/820),3.4)*.15;surge=smooth(0,220,d)*(1-smooth(310,994,d));k=from+(target-from)*smooth(120,520,d);if(d>=1060){k=target;y=surge=0;animating=false;if(queued!==null&&queued!==target){const next=queued;queued=null;begin(next,now);}else{queued=null;pressed(target);}}root.setProperty('--k',k.toFixed(3));root.setProperty('--sink',(y*cv.clientHeight).toFixed(1)+'px');}render(now,surge);if(visible&&!document.hidden&&!reduced.matches)raf=requestAnimationFrame(frame);}
  function resume(){if(visible&&!document.hidden&&!raf){if(reduced.matches)render(0,0);else raf=requestAnimationFrame(frame);}}
  addEventListener('resize',size);size();
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)resume();else if(raf){cancelAnimationFrame(raf);raf=0;}},{threshold:0}).observe(document.querySelector('.hero'));
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&raf){cancelAnimationFrame(raf);raf=0;}else resume();});
  reduced.addEventListener('change',()=>{if(reduced.matches){pick(queued??target);if(raf)cancelAnimationFrame(raf);raf=0;}else resume();});resume();
  const menu=document.querySelector('.menu-button'),mobile=$('mobile-nav');
  function closeMenu(){menu.setAttribute('aria-expanded','false');mobile.hidden=true;menu.setAttribute('aria-label','Открыть меню');}
  menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!open));mobile.hidden=open;menu.setAttribute('aria-label',open?'Открыть меню':'Закрыть меню');});
  mobile.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
  const dialog=$('consult-dialog'),form=$('consult-form');let requestText='',focusReturn=null;
  function openDialog(el){focusReturn=el;closeMenu();if(el.dataset.category)form.elements.category.value=el.dataset.category;$('form-panel').hidden=false;$('success-panel').hidden=true;dialog.showModal();document.body.style.overflow='hidden';}
  document.querySelectorAll('[data-consult]').forEach(button=>button.addEventListener('click',()=>openDialog(button)));
  document.querySelectorAll('dialog').forEach(d=>{d.querySelector('.dialog-close').addEventListener('click',()=>d.close());d.addEventListener('click',event=>{const r=d.getBoundingClientRect();if(event.target===d&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))d.close();});d.addEventListener('close',()=>{document.body.style.overflow='';focusReturn?.focus();});});
  form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;const data=new FormData(form);requestText=`Обращение в адвокатское бюро «Вердикт»\nДемонстрационная заявка — не отправлена\n\nИмя: ${String(data.get('name')).trim()}\nТелефон: ${String(data.get('phone')).trim()}\nВопрос: ${data.get('category')}\n\nОписание ситуации:\n${String(data.get('message')).trim()}`;$('request-summary').textContent=requestText;$('form-panel').hidden=true;$('success-panel').hidden=false;dialog.scrollTop=0;$('download-request').focus();});
  $('download-request').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob(['\uFEFF'+requestText],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='verdict-obraschenie.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('edit-request').addEventListener('click',()=>{$('form-panel').hidden=false;$('success-panel').hidden=true;form.elements.name.focus();});
  $('privacy-button').addEventListener('click',event=>{focusReturn=event.currentTarget;$('privacy-dialog').showModal();document.body.style.overflow='hidden';});
  $('year').textContent=new Date().getFullYear();
})();
