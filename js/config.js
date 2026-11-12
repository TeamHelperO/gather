/* Configuração pública do Supabase (a chave publicável pode ficar no site: o acesso é protegido pelas regras RLS do banco). */
window.CONFIG = {
  SUPABASE_URL: "https://geqljiqocpzlkxjjoylk.supabase.co",
  SUPABASE_KEY: "sb_publishable_eNVC3vsJuDQritXDoVyiOw_FbMokMGj",
  // servidores para as chamadas de áudio (STUN público do Google)
  ICE: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};
