/* Carrega o modo 3D (Three.js, ~750 KB) só quando alguém pede o 3D. */
window.carregar3D = () => window.__carregando3D || (window.__carregando3D = import(new URL("js/iso3d.js", location.href).href).catch(e => { console.warn("3D:", e); window.__carregando3D = null; }));
try { if (localStorage.getItem("nextco_modo3d") === "1" || /[?&]3d=1/.test(location.search)) window.carregar3D(); } catch (e) {}
