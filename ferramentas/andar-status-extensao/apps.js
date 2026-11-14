// endereço do site -> app do Andar. Só estes são reconhecidos; o resto conta como "nenhum".
const SITES = [
  [/(^|\.)figma\.com$/, "figma"], [/(^|\.)notion\.(so|site)$/, "notion"], [/(^|\.)canva\.com$/, "canva"],
  [/^docs\.google\.com$/, (u) => u.pathname.startsWith("/spreadsheets") ? "gsheets" : u.pathname.startsWith("/presentation") ? "gslides" : u.pathname.startsWith("/forms") ? "gforms" : "gdocs"],
  [/^sheets\.google\.com$/, "gsheets"], [/^slides\.google\.com$/, "gslides"], [/^drive\.google\.com$/, "gdrive"],
  [/^mail\.google\.com$/, "gmail"], [/^meet\.google\.com$/, "meet"], [/^calendar\.google\.com$/, "gcalendar"],
  [/^(adsmanager|business)\.facebook\.com$/, "metaads"], [/^ads\.google\.com$/, "googleads"], [/^analytics\.google\.com$/, "ganalytics"],
  [/(^|\.)github\.com$/, "github"], [/^(vscode|github)\.dev$/, "vscode"], [/(^|\.)gitlab\.com$/, "gitlab"],
  [/(^|\.)trello\.com$/, "trello"], [/(^|\.)miro\.com$/, "miro"], [/^app\.asana\.com$/, "asana"], [/(^|\.)clickup\.com$/, "clickup"],
  [/^linear\.app$/, "linear"], [/\.atlassian\.net$/, "jira"], [/(^|\.)monday\.com$/, "monday"],
  [/^(chatgpt\.com|chat\.openai\.com)$/, "chatgpt"], [/^claude\.ai$/, "claude"], [/(^|\.)photopea\.com$/, "photopea"],
  [/^web\.whatsapp\.com$/, "whatsapp"], [/^app\.slack\.com$/, "slack"], [/^teams\.(microsoft|live)\.com$/, "teams"],
  [/^(outlook\.office\.com|outlook\.live\.com)$/, "outlook"], [/(^|\.)office\.com$/, "office"], [/^www\.capcut\.com$/, "capcut"],
  [/^(www\.)?(framer\.com|webflow\.com)$/, "webflow"], [/^vercel\.com$/, "vercel"], [/\.supabase\.com$|^supabase\.com$/, "supabase"],
];
const ANDAR = [/^andar-app\.vercel\.app$/, /^gather-next\.vercel\.app$/, /(^|\.)andar\.app\.br$/, /^localhost$/, /^127\.0\.0\.1$/];
function appDoSite(url) {
  let u; try { u = new URL(url); } catch (e) { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  if (ANDAR.some(r => r.test(u.hostname))) return "andar";
  for (const [re, id] of SITES) if (re.test(u.hostname)) return typeof id === "function" ? id(u) : id;
  return null;
}
