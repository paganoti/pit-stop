/**
 * PAINEL ADMINISTRATIVO — PIT STOP BURGER (/admin)
 * ==========================================================================
 * Gerencia autenticação segura (SHA-256 + Salt), proteção de rotas e operações,
 * Dashboard, CRUD de Produtos, Categorias, Banners, Informações Comerciais,
 * Histórico de Pedidos e Backup/Restauração, integrado em tempo real com o
 * site público via localStorage.
 */

const DURACAO_SESSAO_MS = 8 * 60 * 60 * 1000; // 8 horas

let secaoAdminAtiva = "dashboard";
let acaoConfirmacaoPendente = null;
let adminToastTimeoutId = null;

/* ==========================================================================
   1. CRIPTOGRAFIA SHA-256 E AUTENTICAÇÃO SEGURA (SEM SENHA EM TEXTO PURO)
   ========================================================================== */

/**
 * Fallback SHA-256 puro em JavaScript para contextos onde crypto.subtle
 * não está disponível (ex.: protocolo file:// local).
 * @param {string} ascii
 * @returns {string}
 */
function sha256Fallback(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = "length";
  let i, j;
  let result = "";

  const words = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash = (sha256Fallback.h = sha256Fallback.h || []);
  const k = (sha256Fallback.k = sha256Fallback.k || []);
  let primeCounter = k[lengthProperty];

  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += "\x80";
  while ((ascii[lengthProperty] % 64) - 56) ascii += "\x00";
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return "";
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const i2 = i + j;
      const w15 = w[i - 15],
        w2 = w[i - 2];

      const a = hash[0],
        e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? 0 : "") + b.toString(16);
    }
  }
  return result;
}

/**
 * Calcula o hash SHA-256 de uma string combinada com salt
 * @param {string} texto
 * @returns {Promise<string>}
 */
async function calcularHashSHA256(texto) {
  const utf8 = unescape(encodeURIComponent(texto));
  if (window.crypto && window.crypto.subtle && typeof TextEncoder !== "undefined") {
    try {
      const msgBuffer = new TextEncoder().encode(texto);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (e) {
      return sha256Fallback(utf8);
    }
  }
  return sha256Fallback(utf8);
}

/**
 * Gera uma string hexadecimal aleatória para salt ou token de sessão
 * @param {number} bytesLength
 * @returns {string}
 */
function gerarTokenAleatorio(bytesLength = 16) {
  const array = new Uint8Array(bytesLength);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < bytesLength; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Obtém as credenciais administrativas salvas (contendo apenas username, salt e passwordHash)
 * @returns {object|null}
 */
function obterCredenciaisSalvas() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ADMIN_CREDENCIAIS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.username && parsed.salt && parsed.passwordHash) {
      return parsed;
    }
  } catch (e) {
    console.error("Erro ao ler credenciais administrativas:", e);
  }
  return null;
}

/**
 * Verifica se há uma sessão administrativa válida e não expirada
 * @returns {object|null}
 */
function obterSessaoAtiva() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.ADMIN_SESSAO) || localStorage.getItem(STORAGE_KEYS.ADMIN_SESSAO);
    if (!raw) return null;
    const sessao = JSON.parse(raw);
    const cred = obterCredenciaisSalvas();
    if (!sessao || !cred) return null;
    if (Date.now() > Number(sessao.expiraEm || 0)) {
      encerrarSessaoAdmin(false);
      return null;
    }
    if (sessao.username !== cred.username || !sessao.token) {
      return null;
    }
    return sessao;
  } catch (e) {
    return null;
  }
}

/**
 * Protege todas as operações de escrita/alteração exigindo sessão autenticada ativa
 * @returns {boolean}
 */
function exigirSessaoAutenticada() {
  const sessao = obterSessaoAtiva();
  if (!sessao) {
    mostrarToastAdmin("Sessão expirada ou não autenticada. Faça login novamente.", "error");
    alternarTelasAutenticacao();
    return false;
  }
  return true;
}

/**
 * Cria uma nova sessão administrativa autenticada
 * @param {string} username
 */
function iniciarSessaoAdmin(username) {
  const sessao = {
    username: username,
    token: gerarTokenAleatorio(24),
    criadoEm: Date.now(),
    expiraEm: Date.now() + DURACAO_SESSAO_MS
  };
  sessionStorage.setItem(STORAGE_KEYS.ADMIN_SESSAO, JSON.stringify(sessao));
  localStorage.setItem(STORAGE_KEYS.ADMIN_SESSAO, JSON.stringify(sessao));
}

/**
 * Encerra a sessão administrativa (Logout)
 * @param {boolean} exibirMensagem
 */
function encerrarSessaoAdmin(exibirMensagem = true) {
  sessionStorage.removeItem(STORAGE_KEYS.ADMIN_SESSAO);
  localStorage.removeItem(STORAGE_KEYS.ADMIN_SESSAO);
  alternarTelasAutenticacao();
  if (exibirMensagem) {
    mostrarToastAdmin("Você saiu do painel administrativo com segurança.", "info");
  }
}

/**
 * Alterna entre a tela de Login/Primeiro Acesso e o Dashboard protegido
 */
function alternarTelasAutenticacao() {
  const authScreen = document.getElementById("admin-auth-screen");
  const appContainer = document.getElementById("admin-app-container");
  const cred = obterCredenciaisSalvas();
  const sessao = obterSessaoAtiva();

  if (sessao && cred) {
    if (authScreen) authScreen.hidden = true;
    if (appContainer) appContainer.hidden = false;
    const userSpan = document.getElementById("admin-logged-username");
    if (userSpan) userSpan.textContent = sessao.username;
    const configUser = document.getElementById("config-username");
    if (configUser) configUser.value = sessao.username;
    carregarDadosPainelCompleto();
    return;
  }

  // Não autenticado: oculta o painel e exibe tela de autenticação
  if (appContainer) appContainer.hidden = true;
  if (authScreen) authScreen.hidden = false;

  const badgeEl = document.getElementById("auth-mode-badge");
  const titleEl = document.getElementById("auth-title");
  const subEl = document.getElementById("auth-subtitle");
  const noticeEl = document.getElementById("auth-first-access-notice");
  const confirmGroup = document.getElementById("auth-confirm-group");
  const submitBtn = document.getElementById("auth-submit-btn");
  const erroEl = document.getElementById("auth-error-msg");

  if (erroEl) erroEl.hidden = true;

  if (!cred) {
    // Modo de configuração de Primeiro Acesso
    if (badgeEl) badgeEl.textContent = "Configuração Inicial";
    if (titleEl) titleEl.textContent = "Criar Conta de Administrador";
    if (subEl) subEl.textContent = "Configure seu usuário e senha para proteger o painel";
    if (noticeEl) noticeEl.hidden = false;
    if (confirmGroup) confirmGroup.hidden = false;
    if (submitBtn) submitBtn.textContent = "Criar Administrador e Acessar";
  } else {
    // Modo de Login padrão
    if (badgeEl) badgeEl.textContent = "Acesso Restrito";
    if (titleEl) titleEl.textContent = "Painel Administrativo";
    if (subEl) subEl.textContent = "Entre com suas credenciais para gerenciar o site";
    if (noticeEl) noticeEl.hidden = true;
    if (confirmGroup) confirmGroup.hidden = true;
    if (submitBtn) submitBtn.textContent = "Entrar no Painel";
  }
}

/* ==========================================================================
   2. UTILITÁRIOS DE INTERFACE, CAMINHOS DE IMAGEM E UPLOAD
   ========================================================================== */

function escaparHTMLAdmin(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Resolve o caminho de imagem para exibição dentro de /admin/index.html
 * @param {string} caminho
 * @returns {string}
 */
function resolverCaminhoImagemAdmin(caminho) {
  const limpo = String(caminho || "").trim();
  if (!limpo) return "../assets/logo-emblem.png";
  if (
    limpo.startsWith("data:") ||
    limpo.startsWith("http://") ||
    limpo.startsWith("https://") ||
    limpo.startsWith("../")
  ) {
    return limpo;
  }
  return `../${limpo.replace(/^\.?\//, "")}`;
}

/**
 * Converte um arquivo de imagem selecionado pelo usuário em DataURL Base64 otimizado
 * @param {File} file
 * @param {function(string)} callback
 */
function lerArquivoImagemComoDataURL(file, callback) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    mostrarToastAdmin("Selecione um arquivo de imagem válido (PNG, JPG, WEBP, SVG).", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    callback(dataUrl);
  };
  reader.onerror = () => {
    mostrarToastAdmin("Erro ao ler o arquivo de imagem.", "error");
  };
  reader.readAsDataURL(file);
}

/**
 * Exibe notificação Toast no painel administrativo
 * @param {string} mensagem
 * @param {"success"|"info"|"error"} tipo
 */
function mostrarToastAdmin(mensagem, tipo = "success") {
  const toast = document.getElementById("admin-toast");
  const msgEl = document.getElementById("admin-toast-message");
  if (!toast || !msgEl) return;

  msgEl.textContent = mensagem;
  toast.className = `toast toast--visible toast--${tipo}`;

  if (adminToastTimeoutId) clearTimeout(adminToastTimeoutId);
  adminToastTimeoutId = setTimeout(() => {
    toast.classList.remove("toast--visible");
  }, 3200);
}

/**
 * Abre um modal de confirmação antes de executar ações destrutivas
 * @param {string} titulo
 * @param {string} mensagem
 * @param {function} onConfirm
 */
function abrirModalConfirmacao(titulo, mensagem, onConfirm) {
  const overlay = document.getElementById("modal-confirm-overlay");
  const titleEl = document.getElementById("modal-confirm-title");
  const msgEl = document.getElementById("modal-confirm-message");
  if (!overlay || !titleEl || !msgEl) return;

  titleEl.textContent = titulo;
  msgEl.textContent = mensagem;
  acaoConfirmacaoPendente = onConfirm;
  overlay.hidden = false;
}

function fecharModalPorId(idModal) {
  const el = document.getElementById(idModal);
  if (el) el.hidden = true;
}

/* ==========================================================================
   3. NAVEGAÇÃO ENTRE SEÇÕES E ATUALIZAÇÃO GERAL DO PAINEL
   ========================================================================== */

const TITULOS_SECOES = {
  dashboard: {
    titulo: "Dashboard",
    subtitulo: "Visão geral dos indicadores e atividades da hamburgueria"
  },
  produtos: {
    titulo: "Gerenciamento de Produtos",
    subtitulo: "Cadastre, edite, altere preços, imagens e ordem dos itens do cardápio"
  },
  categorias: {
    titulo: "Gerenciamento de Categorias",
    subtitulo: "Organize as abas e seções exibidas no cardápio público"
  },
  banners: {
    titulo: "Banners e Imagens",
    subtitulo: "Personalize o Banner Principal (Hero) e os banners de destaque do cardápio"
  },
  informacoes: {
    titulo: "Informações da Hamburgueria",
    subtitulo: "Edite nome, logos, WhatsApp, endereço, horários e taxa de entrega"
  },
  configuracoes: {
    titulo: "Configurações e Segurança",
    subtitulo: "Credenciais de administrador, exportação de backup e restauração"
  }
};

function navegarParaSecao(nomeSecao) {
  if (!TITULOS_SECOES[nomeSecao]) return;
  secaoAdminAtiva = nomeSecao;

  document.querySelectorAll(".admin-nav-btn[data-section]").forEach((btn) => {
    btn.classList.toggle("admin-nav-btn--active", btn.getAttribute("data-section") === nomeSecao);
  });

  document.querySelectorAll(".admin-section").forEach((sec) => {
    sec.classList.toggle("admin-section--active", sec.id === `section-${nomeSecao}`);
  });

  const titleEl = document.getElementById("topbar-section-title");
  const subEl = document.getElementById("topbar-section-subtitle");
  if (titleEl) titleEl.textContent = TITULOS_SECOES[nomeSecao].titulo;
  if (subEl) subEl.textContent = TITULOS_SECOES[nomeSecao].subtitulo;

  // Fecha sidebar no mobile ao selecionar item
  const sidebar = document.getElementById("admin-sidebar");
  const overlay = document.getElementById("admin-sidebar-overlay");
  if (sidebar) sidebar.classList.remove("admin-sidebar--open");
  if (overlay) overlay.classList.remove("admin-sidebar-overlay--open");
}

function carregarDadosPainelCompleto() {
  if (!obterSessaoAtiva()) return;
  atualizarIdentidadeVisualNoAdmin();
  atualizarBadgesMenuLateral();
  renderizarDashboardAdmin();
  popularSelectsCategoriasAdmin();
  renderizarTabelaProdutosAdmin();
  renderizarTabelaCategoriasAdmin();
  renderizarTabelaBannersAdmin();
  preencherFormularioInformacoesAdmin();
}

function atualizarIdentidadeVisualNoAdmin() {
  const info = obterInfoHamburgueria();
  const logoEmblemaUrl = resolverCaminhoImagemAdmin(info.logoEmblema);

  const authLogo = document.getElementById("auth-logo-img");
  const sidebarLogo = document.getElementById("sidebar-logo-img");
  const favicon = document.getElementById("admin-favicon");
  const sidebarBrand = document.getElementById("sidebar-brand-name");

  if (authLogo) authLogo.src = logoEmblemaUrl;
  if (sidebarLogo) sidebarLogo.src = logoEmblemaUrl;
  if (favicon) favicon.href = logoEmblemaUrl;
  if (sidebarBrand && info.nome) {
    sidebarBrand.innerHTML = `${escaparHTMLAdmin(info.nome.toUpperCase())} <span>ADMIN</span>`;
  }
}

function atualizarBadgesMenuLateral() {
  const prods = obterProdutosDoSistema();
  const cats = obterCategoriasDoSistema();

  const badgeProd = document.getElementById("nav-badge-produtos");
  const badgeCat = document.getElementById("nav-badge-categorias");

  if (badgeProd) badgeProd.textContent = prods.length;
  if (badgeCat) badgeCat.textContent = cats.length;
}

/* ==========================================================================
   4. SEÇÃO: DASHBOARD
   ========================================================================== */

function formatarDataHoraClique(isoStr) {
  if (!isoStr) return "Nenhum clique registrado até o momento";
  try {
    const data = new Date(isoStr);
    return data.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch (e) {
    return String(isoStr);
  }
}

function renderizarDashboardAdmin() {
  const statsContainer = document.getElementById("dashboard-stats-grid");
  const counterPanel = document.getElementById("dashboard-whatsapp-counter-panel");
  if (!statsContainer || !counterPanel) return;

  const prods = obterProdutosDoSistema();
  const prodsAtivos = prods.filter((p) => p.ativo !== false);
  const prodsDestaque = prods.filter((p) => p.destaque && p.destaque.trim() !== "");
  const cats = obterCategoriasDoSistema();
  const catsAtivas = cats.filter((c) => c.ativo !== false);
  const banners = obterBannersDoSistema();
  const bannersAtivos = banners.filter((b) => b.ativo !== false);
  const dadosCliques = typeof obterContadorCliquesWhatsApp === "function"
    ? obterContadorCliquesWhatsApp()
    : { totalCliques: 0, ultimoCliqueEm: null };

  statsContainer.innerHTML = `
    <div class="admin-stat-card admin-stat-card--success">
      <div>
        <p class="admin-stat-card__label">Cliques em "Finalizar Pedido"</p>
        <p class="admin-stat-card__value">${dadosCliques.totalCliques}</p>
        <p class="admin-stat-card__meta">Redirecionamentos ao WhatsApp</p>
      </div>
      <div class="admin-stat-card__icon" aria-hidden="true">📱</div>
    </div>

    <div class="admin-stat-card">
      <div>
        <p class="admin-stat-card__label">Produtos no Cardápio</p>
        <p class="admin-stat-card__value">${prodsAtivos.length} <small style="font-size:0.85rem;color:var(--text-dark-muted);">/ ${prods.length}</small></p>
        <p class="admin-stat-card__meta">${prodsDestaque.length} com selo de destaque</p>
      </div>
      <div class="admin-stat-card__icon" aria-hidden="true">🍔</div>
    </div>

    <div class="admin-stat-card admin-stat-card--accent">
      <div>
        <p class="admin-stat-card__label">Categorias Ativas</p>
        <p class="admin-stat-card__value">${catsAtivas.length} <small style="font-size:0.85rem;color:var(--text-dark-muted);">/ ${cats.length}</small></p>
        <p class="admin-stat-card__meta">Abas dinâmicas no site</p>
      </div>
      <div class="admin-stat-card__icon" aria-hidden="true">📂</div>
    </div>

    <div class="admin-stat-card admin-stat-card--dark">
      <div>
        <p class="admin-stat-card__label">Banners Ativos</p>
        <p class="admin-stat-card__value">${bannersAtivos.length} <small style="font-size:0.85rem;color:var(--text-dark-muted);">/ ${banners.length}</small></p>
        <p class="admin-stat-card__meta">Hero e destaques do cardápio</p>
      </div>
      <div class="admin-stat-card__icon" aria-hidden="true">🖼️</div>
    </div>
  `;

  const info = obterInfoHamburgueria();
  counterPanel.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1.5rem;">
      <div>
        <p style="font-size:0.82rem;font-weight:700;text-transform:uppercase;color:var(--text-dark-muted);">
          Total de entradas no botão "FINALIZAR PEDIDO" (Carrinho &rarr; WhatsApp)
        </p>
        <p style="font-size:2.4rem;font-weight:800;color:#16a34a;line-height:1.15;margin-top:0.25rem;">
          ${dadosCliques.totalCliques} ${dadosCliques.totalCliques === 1 ? "clique" : "cliques"}
        </p>
        <p style="font-size:0.82rem;color:var(--text-dark-muted);margin-top:0.35rem;">
          <strong>Último redirecionamento registrado:</strong> ${escaparHTMLAdmin(formatarDataHoraClique(dadosCliques.ultimoCliqueEm))}
        </p>
      </div>
      <div style="padding:1rem 1.25rem;background:#f8f8fa;border:1px solid var(--border-color);border-radius:var(--radius-sm);">
        <p style="font-size:0.78rem;color:var(--text-dark-muted);">Número de WhatsApp de destino atual:</p>
        <p style="font-size:1rem;font-weight:800;color:var(--text-dark);margin-top:0.15rem;">+${escaparHTMLAdmin(info.whatsapp || "5511999999999")}</p>
      </div>
    </div>
  `;
}

/* ==========================================================================
   5. SEÇÃO: GERENCIAMENTO DE PRODUTOS (CRUD COMPLETO + ORDENAÇÃO)
   ========================================================================== */

function popularSelectsCategoriasAdmin() {
  const categorias = obterCategoriasDoSistema();
  const filterSelect = document.getElementById("admin-prod-filter-cat");
  const modalSelect = document.getElementById("prod-categoria");

  if (filterSelect) {
    const valorAtual = filterSelect.value || "todas";
    filterSelect.innerHTML = `
      <option value="todas">Todas as categorias</option>
      ${categorias
        .map((c) => `<option value="${escaparHTMLAdmin(c.slug)}">${escaparHTMLAdmin(c.nome)}</option>`)
        .join("")}
    `;
    filterSelect.value = valorAtual;
  }

  if (modalSelect) {
    modalSelect.innerHTML = categorias
      .map((c) => `<option value="${escaparHTMLAdmin(c.slug)}">${escaparHTMLAdmin(c.nome)}</option>`)
      .join("");
  }
}

function renderizarTabelaProdutosAdmin() {
  const tbody = document.getElementById("admin-produtos-tbody");
  if (!tbody) return;

  const buscaInput = document.getElementById("admin-prod-search");
  const catSelect = document.getElementById("admin-prod-filter-cat");
  const statusSelect = document.getElementById("admin-prod-filter-status");

  const termo = buscaInput ? buscaInput.value.trim().toLowerCase() : "";
  const catFiltro = catSelect ? catSelect.value : "todas";
  const statusFiltro = statusSelect ? statusSelect.value : "todos";

  const todosProdutos = obterProdutosDoSistema();

  const filtrados = todosProdutos.filter((p) => {
    const matchBusca =
      termo === "" ||
      p.nome.toLowerCase().includes(termo) ||
      p.descricao.toLowerCase().includes(termo) ||
      p.categoria.toLowerCase().includes(termo);
    const matchCat = catFiltro === "todas" || p.categoriaSlug === catFiltro;
    const matchStatus =
      statusFiltro === "todos" ||
      (statusFiltro === "ativos" && p.ativo !== false) ||
      (statusFiltro === "inativos" && p.ativo === false);
    return matchBusca && matchCat && matchStatus;
  });

  if (filtrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:2rem;color:var(--text-dark-muted);">
          Nenhum produto encontrado para os filtros selecionados.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtrados
    .map((p) => {
      const thumbHTML = p.imagem
        ? `<img src="${escaparHTMLAdmin(resolverCaminhoImagemAdmin(p.imagem))}" alt="" class="admin-table__thumb" onerror="this.outerHTML='<div class=\\'admin-table__thumb\\'>SEM FOTO</div>'">`
        : `<div class="admin-table__thumb" title="Utiliza Placeholder SVG no cardápio">SVG</div>`;

      return `
        <tr>
          <td>
            <div style="display:inline-flex;align-items:center;gap:0.25rem;">
              <button type="button" class="admin-action-btn" data-prod-move="up" data-id="${p.id}" title="Mover para cima">&uarr;</button>
              <strong style="min-width:1.5rem;text-align:center;">${p.ordem}</strong>
              <button type="button" class="admin-action-btn" data-prod-move="down" data-id="${p.id}" title="Mover para baixo">&darr;</button>
            </div>
          </td>
          <td>
            <div class="admin-table__product-cell">
              ${thumbHTML}
              <div>
                <div class="admin-table__title">
                  ${p.numero ? `<span style="color:var(--primary-color);">${escaparHTMLAdmin(p.numero)}</span> — ` : ""}
                  ${escaparHTMLAdmin(p.nome)}
                </div>
                <div class="admin-table__sub">${escaparHTMLAdmin(p.descricao)}</div>
              </div>
            </div>
          </td>
          <td>${escaparHTMLAdmin(p.categoria)}</td>
          <td><strong style="color:var(--primary-color);">${formatarMoeda(p.preco)}</strong></td>
          <td>
            ${
              p.destaque
                ? `<span class="admin-badge admin-badge--highlight">${escaparHTMLAdmin(p.destaque)}</span>`
                : `<span style="color:var(--text-dark-muted);font-size:0.75rem;">—</span>`
            }
          </td>
          <td>
            <button
              type="button"
              class="admin-badge ${p.ativo !== false ? "admin-badge--active" : "admin-badge--inactive"}"
              data-prod-toggle="${p.id}"
              title="Clique para ativar ou desativar no cardápio"
            >
              ${p.ativo !== false ? "Ativo" : "Inativo"}
            </button>
          </td>
          <td>
            <div class="admin-table__actions">
              <button type="button" class="admin-action-btn admin-action-btn--edit" data-prod-edit="${p.id}" title="Editar produto">
                ✎
              </button>
              <button type="button" class="admin-action-btn admin-action-btn--delete" data-prod-delete="${p.id}" title="Excluir produto">
                🗑
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function abrirModalProduto(produtoId = null) {
  popularSelectsCategoriasAdmin();
  const modal = document.getElementById("modal-produto-overlay");
  const titleEl = document.getElementById("modal-produto-title");
  const form = document.getElementById("form-produto");
  if (!modal || !form) return;

  form.reset();
  const selectAsset = document.getElementById("select-prod-asset");
  if (selectAsset) selectAsset.value = "";

  const todosProdutos = obterProdutosDoSistema();

  if (produtoId !== null) {
    const prod = todosProdutos.find((p) => p.id === Number(produtoId));
    if (!prod) return;

    if (titleEl) titleEl.textContent = `Editar Produto: ${prod.nome}`;
    document.getElementById("prod-id").value = prod.id;
    document.getElementById("prod-nome").value = prod.nome;
    document.getElementById("prod-numero").value = prod.numero || "";
    document.getElementById("prod-categoria").value = prod.categoriaSlug;
    document.getElementById("prod-preco").value = prod.preco;
    document.getElementById("prod-destaque").value = prod.destaque || "";
    document.getElementById("prod-ordem").value = prod.ordem || 1;
    document.getElementById("prod-descricao").value = prod.descricao;
    document.getElementById("prod-imagem").value = prod.imagem || "";
    document.getElementById("prod-ativo").checked = prod.ativo !== false;

    const preview = document.getElementById("preview-prod-img");
    if (preview) {
      preview.src = resolverCaminhoImagemAdmin(prod.imagem);
    }
  } else {
    if (titleEl) titleEl.textContent = "Cadastrar Novo Produto";
    document.getElementById("prod-id").value = "";
    document.getElementById("prod-ordem").value = todosProdutos.length + 1;
    document.getElementById("prod-ativo").checked = true;
    const preview = document.getElementById("preview-prod-img");
    if (preview) preview.src = "../assets/logo-emblem.png";
  }

  modal.hidden = false;
}

function salvarFormularioProduto(evento) {
  evento.preventDefault();
  if (!exigirSessaoAutenticada()) return;

  const idRaw = document.getElementById("prod-id").value;
  const nome = document.getElementById("prod-nome").value.trim();
  const numero = document.getElementById("prod-numero").value.trim();
  const categoriaSlug = document.getElementById("prod-categoria").value;
  const preco = Number(document.getElementById("prod-preco").value);
  const destaque = document.getElementById("prod-destaque").value.trim();
  const ordem = Number(document.getElementById("prod-ordem").value) || 1;
  const descricao = document.getElementById("prod-descricao").value.trim();
  const imagem = document.getElementById("prod-imagem").value.trim();
  const ativo = document.getElementById("prod-ativo").checked;

  if (!nome || !descricao || isNaN(preco) || preco <= 0) {
    mostrarToastAdmin("Preencha nome, descrição e um preço válido maior que zero.", "error");
    return;
  }

  const categorias = obterCategoriasDoSistema();
  const catObj = categorias.find((c) => c.slug === categoriaSlug);
  const categoriaNome = catObj ? catObj.nome : categoriaSlug;

  const lista = obterProdutosDoSistema();

  if (idRaw) {
    const id = Number(idRaw);
    const idx = lista.findIndex((p) => p.id === id);
    if (idx !== -1) {
      lista[idx] = {
        ...lista[idx],
        nome,
        numero,
        categoria: categoriaNome,
        categoriaSlug,
        preco,
        destaque,
        ordem,
        descricao,
        imagem,
        ativo
      };
    }
  } else {
    const novoId = lista.length > 0 ? Math.max(...lista.map((p) => p.id)) + 1 : 1;
    lista.push({
      id: novoId,
      nome,
      numero,
      categoria: categoriaNome,
      categoriaSlug,
      preco,
      destaque,
      ordem,
      descricao,
      imagem,
      ativo
    });
  }

  salvarProdutosDoSistema(lista);
  fecharModalPorId("modal-produto-overlay");
  carregarDadosPainelCompleto();
  mostrarToastAdmin(idRaw ? "Produto atualizado com sucesso!" : "Novo produto cadastrado no cardápio!");
}

function alternarStatusProduto(produtoId) {
  if (!exigirSessaoAutenticada()) return;
  const lista = obterProdutosDoSistema();
  const item = lista.find((p) => p.id === Number(produtoId));
  if (!item) return;

  item.ativo = item.ativo === false ? true : false;
  salvarProdutosDoSistema(lista);
  carregarDadosPainelCompleto();
  mostrarToastAdmin(
    `Produto "${item.nome}" ${item.ativo ? "ativado" : "desativado"} no cardápio.`,
    "info"
  );
}

function moverOrdemProduto(produtoId, direcao) {
  if (!exigirSessaoAutenticada()) return;
  const lista = obterProdutosDoSistema();
  const idx = lista.findIndex((p) => p.id === Number(produtoId));
  if (idx === -1) return;

  const novoIdx = direcao === "up" ? idx - 1 : idx + 1;
  if (novoIdx < 0 || novoIdx >= lista.length) return;

  const temp = lista[idx];
  lista[idx] = lista[novoIdx];
  lista[novoIdx] = temp;

  lista.forEach((p, index) => {
    p.ordem = index + 1;
  });

  salvarProdutosDoSistema(lista);
  renderizarTabelaProdutosAdmin();
  mostrarToastAdmin("Ordem de exibição dos produtos atualizada!");
}

function confirmarExclusaoProduto(produtoId) {
  if (!exigirSessaoAutenticada()) return;
  const lista = obterProdutosDoSistema();
  const prod = lista.find((p) => p.id === Number(produtoId));
  if (!prod) return;

  abrirModalConfirmacao(
    "Excluir Produto",
    `Tem certeza que deseja excluir o produto "${prod.nome}" do cardápio? Esta ação removerá o item imediatamente do site público.`,
    () => {
      const novaLista = lista.filter((p) => p.id !== prod.id);
      salvarProdutosDoSistema(novaLista);
      carregarDadosPainelCompleto();
      mostrarToastAdmin(`Produto "${prod.nome}" excluído com sucesso.`, "info");
    }
  );
}

/* ==========================================================================
   6. SEÇÃO: GERENCIAMENTO DE CATEGORIAS
   ========================================================================== */

function renderizarTabelaCategoriasAdmin() {
  const tbody = document.getElementById("admin-categorias-tbody");
  if (!tbody) return;

  const categorias = obterCategoriasDoSistema();
  const produtos = obterProdutosDoSistema();

  tbody.innerHTML = categorias
    .map((cat) => {
      const qtdProds = produtos.filter((p) => p.categoriaSlug === cat.slug).length;
      return `
        <tr>
          <td>
            <div style="display:inline-flex;align-items:center;gap:0.25rem;">
              <button type="button" class="admin-action-btn" data-cat-move="up" data-id="${cat.id}" title="Mover para cima">&uarr;</button>
              <strong style="min-width:1.5rem;text-align:center;">${cat.ordem}</strong>
              <button type="button" class="admin-action-btn" data-cat-move="down" data-id="${cat.id}" title="Mover para baixo">&darr;</button>
            </div>
          </td>
          <td>
            <div class="admin-table__title">${escaparHTMLAdmin(cat.nome)}</div>
            <div class="admin-table__sub">${escaparHTMLAdmin(cat.subtitulo || "Sem subtítulo")}</div>
          </td>
          <td><code>${escaparHTMLAdmin(cat.slug)}</code></td>
          <td><strong>${qtdProds}</strong> ${qtdProds === 1 ? "produto" : "produtos"}</td>
          <td>
            <button
              type="button"
              class="admin-badge ${cat.ativo !== false ? "admin-badge--active" : "admin-badge--inactive"}"
              data-cat-toggle="${cat.id}"
            >
              ${cat.ativo !== false ? "Ativa" : "Inativa"}
            </button>
          </td>
          <td>
            <div class="admin-table__actions">
              <button type="button" class="admin-action-btn admin-action-btn--edit" data-cat-edit="${cat.id}" title="Editar categoria">
                ✎
              </button>
              <button type="button" class="admin-action-btn admin-action-btn--delete" data-cat-delete="${cat.id}" title="Excluir categoria">
                🗑
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function abrirModalCategoria(catId = null) {
  const modal = document.getElementById("modal-categoria-overlay");
  const titleEl = document.getElementById("modal-categoria-title");
  const form = document.getElementById("form-categoria");
  if (!modal || !form) return;

  form.reset();
  const categorias = obterCategoriasDoSistema();

  if (catId !== null) {
    const cat = categorias.find((c) => c.id === Number(catId));
    if (!cat) return;

    if (titleEl) titleEl.textContent = `Editar Categoria: ${cat.nome}`;
    document.getElementById("cat-id").value = cat.id;
    document.getElementById("cat-nome").value = cat.nome;
    document.getElementById("cat-ordem").value = cat.ordem || 1;
    document.getElementById("cat-subtitulo").value = cat.subtitulo || "";
    document.getElementById("cat-imagem").value = cat.imagem || "";
    document.getElementById("cat-ativo").checked = cat.ativo !== false;

    const preview = document.getElementById("preview-cat-img");
    if (preview) preview.src = resolverCaminhoImagemAdmin(cat.imagem);
  } else {
    if (titleEl) titleEl.textContent = "Nova Categoria";
    document.getElementById("cat-id").value = "";
    document.getElementById("cat-ordem").value = categorias.length + 1;
    document.getElementById("cat-ativo").checked = true;
    const preview = document.getElementById("preview-cat-img");
    if (preview) preview.src = "../assets/logo-emblem.png";
  }

  modal.hidden = false;
}

function salvarFormularioCategoria(evento) {
  evento.preventDefault();
  if (!exigirSessaoAutenticada()) return;

  const idRaw = document.getElementById("cat-id").value;
  const nome = document.getElementById("cat-nome").value.trim();
  const ordem = Number(document.getElementById("cat-ordem").value) || 1;
  const subtitulo = document.getElementById("cat-subtitulo").value.trim();
  const imagem = document.getElementById("cat-imagem").value.trim();
  const ativo = document.getElementById("cat-ativo").checked;

  if (!nome) {
    mostrarToastAdmin("Informe o nome da categoria.", "error");
    return;
  }

  const categorias = obterCategoriasDoSistema();
  const novoSlug = gerarSlug(nome);

  if (idRaw) {
    const id = Number(idRaw);
    const idx = categorias.findIndex((c) => c.id === id);
    if (idx !== -1) {
      const slugAntigo = categorias[idx].slug;
      categorias[idx] = {
        ...categorias[idx],
        nome,
        slug: slugAntigo, // preserva o slug para não quebrar vínculos existentes
        subtitulo,
        imagem,
        ordem,
        ativo
      };

      // Atualiza o rótulo da categoria nos produtos vinculados
      const prods = obterProdutosDoSistema();
      prods.forEach((p) => {
        if (p.categoriaSlug === slugAntigo) {
          p.categoria = nome;
        }
      });
      salvarProdutosDoSistema(prods);
    }
  } else {
    if (categorias.some((c) => c.slug === novoSlug)) {
      mostrarToastAdmin("Já existe uma categoria com este identificador.", "error");
      return;
    }
    const novoId = categorias.length > 0 ? Math.max(...categorias.map((c) => c.id)) + 1 : 1;
    categorias.push({
      id: novoId,
      nome,
      slug: novoSlug,
      subtitulo,
      imagem,
      ordem,
      ativo
    });
  }

  salvarCategoriasDoSistema(categorias);
  fecharModalPorId("modal-categoria-overlay");
  carregarDadosPainelCompleto();
  mostrarToastAdmin(idRaw ? "Categoria atualizada com sucesso!" : "Nova categoria criada!");
}

function alternarStatusCategoria(catId) {
  if (!exigirSessaoAutenticada()) return;
  const categorias = obterCategoriasDoSistema();
  const cat = categorias.find((c) => c.id === Number(catId));
  if (!cat) return;

  cat.ativo = cat.ativo === false ? true : false;
  salvarCategoriasDoSistema(categorias);
  carregarDadosPainelCompleto();
  mostrarToastAdmin(`Categoria "${cat.nome}" ${cat.ativo ? "ativada" : "desativada"}.`, "info");
}

function moverOrdemCategoria(catId, direcao) {
  if (!exigirSessaoAutenticada()) return;
  const categorias = obterCategoriasDoSistema();
  const idx = categorias.findIndex((c) => c.id === Number(catId));
  if (idx === -1) return;

  const novoIdx = direcao === "up" ? idx - 1 : idx + 1;
  if (novoIdx < 0 || novoIdx >= categorias.length) return;

  const temp = categorias[idx];
  categorias[idx] = categorias[novoIdx];
  categorias[novoIdx] = temp;

  categorias.forEach((c, index) => {
    c.ordem = index + 1;
  });

  salvarCategoriasDoSistema(categorias);
  carregarDadosPainelCompleto();
  mostrarToastAdmin("Ordem das categorias atualizada!");
}

function confirmarExclusaoCategoria(catId) {
  if (!exigirSessaoAutenticada()) return;
  const categorias = obterCategoriasDoSistema();
  const cat = categorias.find((c) => c.id === Number(catId));
  if (!cat) return;

  const prodsVinculados = obterProdutosDoSistema().filter((p) => p.categoriaSlug === cat.slug);
  if (prodsVinculados.length > 0) {
    mostrarToastAdmin(
      `Não é possível excluir "${cat.nome}" pois há ${prodsVinculados.length} produto(s) vinculado(s). Mova ou exclua os produtos antes, ou apenas desative a categoria.`,
      "error"
    );
    return;
  }

  abrirModalConfirmacao(
    "Excluir Categoria",
    `Deseja realmente excluir a categoria "${cat.nome}"?`,
    () => {
      const novaLista = categorias.filter((c) => c.id !== cat.id);
      salvarCategoriasDoSistema(novaLista);
      carregarDadosPainelCompleto();
      mostrarToastAdmin(`Categoria "${cat.nome}" excluída.`, "info");
    }
  );
}

/* ==========================================================================
   7. SEÇÃO: BANNERS E IMAGENS
   ========================================================================== */

function renderizarTabelaBannersAdmin() {
  const tbody = document.getElementById("admin-banners-tbody");
  if (!tbody) return;

  const banners = obterBannersDoSistema();
  const prods = obterProdutosDoSistema();

  tbody.innerHTML = banners
    .map((b) => {
      const prodVinc = b.produtoId ? prods.find((p) => p.id === Number(b.produtoId)) : null;
      const thumbHTML = b.imagem
        ? `<img src="${escaparHTMLAdmin(resolverCaminhoImagemAdmin(b.imagem))}" alt="" class="admin-table__thumb" onerror="this.outerHTML='<div class=\\'admin-table__thumb\\'>IMG</div>'">`
        : `<div class="admin-table__thumb">BANNER</div>`;

      return `
        <tr>
          <td><strong>${b.ordem}</strong></td>
          <td>
            <div class="admin-table__product-cell">
              ${thumbHTML}
              <div>
                <div class="admin-table__title">${escaparHTMLAdmin(b.titulo)}</div>
                <div class="admin-table__sub">${escaparHTMLAdmin(b.tag || b.subtitulo || "")}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="admin-badge ${b.tipo === "hero" ? "admin-badge--highlight" : "admin-badge--prep"}">
              ${b.tipo === "hero" ? "Topo (Hero)" : "Destaque Cardápio"}
            </span>
          </td>
          <td>
            ${prodVinc ? escaparHTMLAdmin(prodVinc.nome) : `<span style="color:var(--text-dark-muted);font-size:0.78rem;">Apenas Link</span>`}
          </td>
          <td>
            <button
              type="button"
              class="admin-badge ${b.ativo !== false ? "admin-badge--active" : "admin-badge--inactive"}"
              data-banner-toggle="${b.id}"
            >
              ${b.ativo !== false ? "Ativo" : "Inativo"}
            </button>
          </td>
          <td>
            <div class="admin-table__actions">
              <button type="button" class="admin-action-btn admin-action-btn--edit" data-banner-edit="${b.id}" title="Editar banner">
                ✎
              </button>
              ${
                b.id > 2
                  ? `<button type="button" class="admin-action-btn admin-action-btn--delete" data-banner-delete="${b.id}" title="Excluir banner">🗑</button>`
                  : ""
              }
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function abrirModalBanner(bannerId = null) {
  const modal = document.getElementById("modal-banner-overlay");
  const titleEl = document.getElementById("modal-banner-title");
  const form = document.getElementById("form-banner");
  const prodSelect = document.getElementById("banner-produto-id");
  if (!modal || !form || !prodSelect) return;

  form.reset();
  const prods = obterProdutosDoSistema();
  prodSelect.innerHTML = `
    <option value="">Nenhum produto vinculado (apenas link)</option>
    ${prods.map((p) => `<option value="${p.id}">${escaparHTMLAdmin(p.nome)} (${formatarMoeda(p.preco)})</option>`).join("")}
  `;

  const banners = obterBannersDoSistema();

  if (bannerId !== null) {
    const b = banners.find((item) => item.id === Number(bannerId));
    if (!b) return;

    if (titleEl) titleEl.textContent = `Editar Banner: ${b.titulo}`;
    document.getElementById("banner-id").value = b.id;
    document.getElementById("banner-tipo").value = b.tipo === "hero" ? "hero" : "destaque";
    document.getElementById("banner-ordem").value = b.ordem || 1;
    document.getElementById("banner-tag").value = b.tag || "";
    document.getElementById("banner-produto-id").value = b.produtoId || "";
    document.getElementById("banner-titulo").value = b.titulo || "";
    document.getElementById("banner-subtitulo").value = b.subtitulo || "";
    document.getElementById("banner-texto").value = b.texto || "";
    document.getElementById("banner-btn1-texto").value = b.textoBotaoPrimario || "";
    document.getElementById("banner-btn2-texto").value = b.textoBotaoSecundario || "";
    document.getElementById("banner-imagem").value = b.imagem || "";
    document.getElementById("banner-ativo").checked = b.ativo !== false;

    const preview = document.getElementById("preview-banner-img");
    if (preview) preview.src = resolverCaminhoImagemAdmin(b.imagem);
  } else {
    if (titleEl) titleEl.textContent = "Adicionar Novo Banner de Destaque";
    document.getElementById("banner-id").value = "";
    document.getElementById("banner-tipo").value = "destaque";
    document.getElementById("banner-ordem").value = banners.length + 1;
    document.getElementById("banner-btn1-texto").value = "+ Adicionar ao Carrinho";
    document.getElementById("banner-ativo").checked = true;
    const preview = document.getElementById("preview-banner-img");
    if (preview) preview.src = "../assets/pit-stop-big.png";
  }

  modal.hidden = false;
}

function salvarFormularioBanner(evento) {
  evento.preventDefault();
  if (!exigirSessaoAutenticada()) return;

  const idRaw = document.getElementById("banner-id").value;
  const tipo = document.getElementById("banner-tipo").value;
  const ordem = Number(document.getElementById("banner-ordem").value) || 1;
  const tag = document.getElementById("banner-tag").value.trim();
  const produtoIdRaw = document.getElementById("banner-produto-id").value;
  const titulo = document.getElementById("banner-titulo").value.trim();
  const subtitulo = document.getElementById("banner-subtitulo").value.trim();
  const texto = document.getElementById("banner-texto").value.trim();
  const textoBotaoPrimario = document.getElementById("banner-btn1-texto").value.trim();
  const textoBotaoSecundario = document.getElementById("banner-btn2-texto").value.trim();
  const imagem = document.getElementById("banner-imagem").value.trim();
  const ativo = document.getElementById("banner-ativo").checked;

  if (!titulo) {
    mostrarToastAdmin("Informe o título principal do banner.", "error");
    return;
  }

  const banners = obterBannersDoSistema();
  const produtoId = produtoIdRaw ? Number(produtoIdRaw) : null;

  if (idRaw) {
    const id = Number(idRaw);
    const idx = banners.findIndex((b) => b.id === id);
    if (idx !== -1) {
      banners[idx] = {
        ...banners[idx],
        tipo,
        ordem,
        tag,
        produtoId,
        titulo,
        subtitulo,
        texto,
        textoBotaoPrimario,
        textoBotaoSecundario,
        imagem,
        ativo
      };
    }
  } else {
    const novoId = banners.length > 0 ? Math.max(...banners.map((b) => b.id)) + 1 : 3;
    banners.push({
      id: novoId,
      tipo,
      ordem,
      tag,
      produtoId,
      titulo,
      subtitulo,
      texto,
      textoBotaoPrimario,
      linkBotaoPrimario: "#cardapio",
      textoBotaoSecundario,
      linkBotaoSecundario: "#sobre",
      imagem,
      ativo
    });
  }

  salvarBannersDoSistema(banners);
  fecharModalPorId("modal-banner-overlay");
  carregarDadosPainelCompleto();
  mostrarToastAdmin("Configurações de banner salvas com sucesso!");
}

function alternarStatusBanner(bannerId) {
  if (!exigirSessaoAutenticada()) return;
  const banners = obterBannersDoSistema();
  const b = banners.find((item) => item.id === Number(bannerId));
  if (!b) return;

  b.ativo = b.ativo === false ? true : false;
  salvarBannersDoSistema(banners);
  carregarDadosPainelCompleto();
  mostrarToastAdmin(`Banner "${b.titulo}" ${b.ativo ? "ativado" : "desativado"}.`, "info");
}

function confirmarExclusaoBanner(bannerId) {
  if (!exigirSessaoAutenticada()) return;
  const banners = obterBannersDoSistema();
  const b = banners.find((item) => item.id === Number(bannerId));
  if (!b || b.id <= 2) return;

  abrirModalConfirmacao(
    "Excluir Banner",
    `Deseja excluir o banner "${b.titulo}"?`,
    () => {
      const novos = banners.filter((item) => item.id !== b.id);
      salvarBannersDoSistema(novos);
      carregarDadosPainelCompleto();
      mostrarToastAdmin("Banner excluído com sucesso.", "info");
    }
  );
}

/* ==========================================================================
   9. SEÇÃO: INFORMAÇÕES COMERCIAIS DA HAMBURGUERIA
   ========================================================================== */

function preencherFormularioInformacoesAdmin() {
  const info = obterInfoHamburgueria();

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined && val !== null ? val : "";
  };

  setVal("info-nome", info.nome);
  setVal("info-subtitulo", info.subtitulo);
  setVal("info-slogan", info.slogan);
  setVal("info-desde", info.desde);
  setVal("info-whatsapp", info.whatsapp);
  setVal("info-telefone", info.telefone);
  setVal("info-instagram", info.instagram);
  setVal("info-taxa-entrega", info.taxaEntrega);
  setVal("info-endereco", info.endereco);
  setVal("info-horario", info.horarioFuncionamento);
  setVal("info-entrega", info.infoEntrega);
  setVal("info-logo", info.logo);
  setVal("info-logo-emblema", info.logoEmblema);
  setVal("info-descricao-sobre", info.descricaoSobre);
  setVal(
    "info-diferenciais",
    Array.isArray(info.diferenciais) ? info.diferenciais.join("\n") : ""
  );

  const prevLogo = document.getElementById("preview-info-logo");
  const prevEmblema = document.getElementById("preview-info-logo-emblema");
  if (prevLogo) prevLogo.src = resolverCaminhoImagemAdmin(info.logo);
  if (prevEmblema) prevEmblema.src = resolverCaminhoImagemAdmin(info.logoEmblema);
}

function salvarFormularioInformacoesAdmin(evento) {
  evento.preventDefault();
  if (!exigirSessaoAutenticada()) return;

  const nome = document.getElementById("info-nome").value.trim();
  const whatsappLimpo = document.getElementById("info-whatsapp").value.replace(/\D/g, "");

  if (!nome) {
    mostrarToastAdmin("O nome da hamburgueria é obrigatório.", "error");
    return;
  }
  if (whatsappLimpo.length < 10) {
    mostrarToastAdmin("Informe um número de WhatsApp válido (com código do país 55 e DDD).", "error");
    return;
  }

  const diferenciaisTexto = document.getElementById("info-diferenciais").value;
  const diferenciais = diferenciaisTexto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  salvarInfoHamburgueria({
    nome: nome,
    subtitulo: document.getElementById("info-subtitulo").value.trim(),
    slogan: document.getElementById("info-slogan").value.trim(),
    desde: document.getElementById("info-desde").value.trim(),
    whatsapp: whatsappLimpo,
    telefone: document.getElementById("info-telefone").value.trim(),
    instagram: document.getElementById("info-instagram").value.trim(),
    taxaEntrega: Number(document.getElementById("info-taxa-entrega").value) || 0,
    endereco: document.getElementById("info-endereco").value.trim(),
    horarioFuncionamento: document.getElementById("info-horario").value.trim(),
    infoEntrega: document.getElementById("info-entrega").value.trim(),
    logo: document.getElementById("info-logo").value.trim() || "assets/logo.png",
    logoEmblema: document.getElementById("info-logo-emblema").value.trim() || "assets/logo-emblem.png",
    descricaoSobre: document.getElementById("info-descricao-sobre").value.trim(),
    diferenciais: diferenciais
  });

  carregarDadosPainelCompleto();
  mostrarToastAdmin("Informações da hamburgueria atualizadas em todo o site!");
}

/* ==========================================================================
   10. SEÇÃO: CONFIGURAÇÕES, CREDENCIAIS E BACKUP
   ========================================================================== */

async function salvarNovasCredenciaisAdmin(evento) {
  evento.preventDefault();
  if (!exigirSessaoAutenticada()) return;

  const credAtual = obterCredenciaisSalvas();
  if (!credAtual) return;

  const novoUser = document.getElementById("config-username").value.trim();
  const senhaAtual = document.getElementById("config-current-password").value;
  const novaSenha = document.getElementById("config-new-password").value;
  const confirmaSenha = document.getElementById("config-confirm-password").value;

  if (!novoUser || !senhaAtual || !novaSenha) {
    mostrarToastAdmin("Preencha todos os campos de segurança.", "error");
    return;
  }

  if (novaSenha.length < 6) {
    mostrarToastAdmin("A nova senha deve ter pelo menos 6 caracteres.", "error");
    return;
  }

  if (novaSenha !== confirmaSenha) {
    mostrarToastAdmin("A confirmação da nova senha não confere.", "error");
    return;
  }

  const hashAtualTentativa = await calcularHashSHA256(`${credAtual.salt}:${senhaAtual}`);
  if (hashAtualTentativa !== credAtual.passwordHash) {
    mostrarToastAdmin("A senha atual informada está incorreta.", "error");
    return;
  }

  const novoSalt = gerarTokenAleatorio(16);
  const novoHash = await calcularHashSHA256(`${novoSalt}:${novaSenha}`);

  localStorage.setItem(
    STORAGE_KEYS.ADMIN_CREDENCIAIS,
    JSON.stringify({
      username: novoUser,
      salt: novoSalt,
      passwordHash: novoHash,
      atualizadoEm: new Date().toISOString()
    })
  );

  iniciarSessaoAdmin(novoUser);
  document.getElementById("form-alterar-credenciais").reset();
  document.getElementById("config-username").value = novoUser;
  const userSpan = document.getElementById("admin-logged-username");
  if (userSpan) userSpan.textContent = novoUser;

  mostrarToastAdmin("Credenciais de administrador atualizadas com sucesso!");
}

function exportarBackupJSON() {
  if (!exigirSessaoAutenticada()) return;
  const pacoteBackup = {
    versao: 1,
    exportadoEm: new Date().toISOString(),
    produtos: obterProdutosDoSistema(),
    categorias: obterCategoriasDoSistema(),
    banners: obterBannersDoSistema(),
    info: obterInfoHamburgueria(),
    cliquesWhatsapp: obterContadorCliquesWhatsApp()
  };

  const blob = new Blob([JSON.stringify(pacoteBackup, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup-pitstop-burger-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  mostrarToastAdmin("Backup exportado com sucesso!");
}

function importarBackupJSON(file) {
  if (!exigirSessaoAutenticada() || !file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const dados = JSON.parse(e.target.result);
      if (!dados || !Array.isArray(dados.produtos) || !Array.isArray(dados.categorias)) {
        mostrarToastAdmin("Arquivo de backup inválido ou incompatível.", "error");
        return;
      }

      salvarCategoriasDoSistema(dados.categorias);
      salvarProdutosDoSistema(dados.produtos);
      if (Array.isArray(dados.banners)) salvarBannersDoSistema(dados.banners);
      if (dados.info && typeof dados.info === "object") salvarInfoHamburgueria(dados.info);
      if (dados.cliquesWhatsapp) {
        localStorage.setItem(STORAGE_KEYS.CLIQUES_WHATSAPP, JSON.stringify(dados.cliquesWhatsapp));
      }

      carregarDadosPainelCompleto();
      mostrarToastAdmin("Backup importado e aplicado com sucesso!");
    } catch (erro) {
      mostrarToastAdmin("Erro ao processar o arquivo JSON de backup.", "error");
    }
  };
  reader.readAsText(file);
}

function confirmarRestauracaoPadrao() {
  if (!exigirSessaoAutenticada()) return;
  abrirModalConfirmacao(
    "Restaurar Dados Originais de Fábrica",
    "Deseja restaurar produtos, categorias, banners e informações comerciais para o estado original do projeto? (Suas credenciais de login serão mantidas).",
    () => {
      localStorage.removeItem(STORAGE_KEYS.PRODUTOS);
      localStorage.removeItem(STORAGE_KEYS.CATEGORIAS);
      localStorage.removeItem(STORAGE_KEYS.BANNERS);
      localStorage.removeItem(STORAGE_KEYS.INFO);
      sincronizarArrayProdutosGlobal();
      carregarDadosPainelCompleto();
      mostrarToastAdmin("Dados originais de fábrica restaurados com sucesso!");
    }
  );
}

/* ==========================================================================
   11. INICIALIZAÇÃO DE EVENTOS DO PAINEL ADMINISTRATIVO
   ========================================================================== */

function inicializarPainelAdmin() {
  alternarTelasAutenticacao();

  // Formulário de Login / Criação de Conta no Primeiro Acesso
  const authForm = document.getElementById("admin-auth-form");
  if (authForm) {
    authForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const userEl = document.getElementById("auth-username");
      const passEl = document.getElementById("auth-password");
      const confirmEl = document.getElementById("auth-password-confirm");
      const erroEl = document.getElementById("auth-error-msg");

      const username = userEl ? userEl.value.trim() : "";
      const password = passEl ? passEl.value : "";
      const confirmPass = confirmEl ? confirmEl.value : "";

      const exibirErroAuth = (msg) => {
        if (erroEl) {
          erroEl.textContent = msg;
          erroEl.hidden = false;
        }
      };

      if (!username || !password) {
        exibirErroAuth("Preencha o usuário e a senha.");
        return;
      }

      const credExistente = obterCredenciaisSalvas();

      if (!credExistente) {
        // Primeiro acesso: cadastra credencial com SHA-256 + salt
        if (password.length < 6) {
          exibirErroAuth("A senha deve possuir no mínimo 6 caracteres.");
          return;
        }
        if (password !== confirmPass) {
          exibirErroAuth("As senhas digitadas não conferem.");
          return;
        }
        const salt = gerarTokenAleatorio(16);
        const passwordHash = await calcularHashSHA256(`${salt}:${password}`);
        localStorage.setItem(
          STORAGE_KEYS.ADMIN_CREDENCIAIS,
          JSON.stringify({
            username,
            salt,
            passwordHash,
            criadoEm: new Date().toISOString()
          })
        );
        iniciarSessaoAdmin(username);
        authForm.reset();
        alternarTelasAutenticacao();
        mostrarToastAdmin(`Bem-vindo(a), ${username}! Painel configurado com segurança.`);
      } else {
        // Login normal: valida hash SHA-256
        const hashTentativa = await calcularHashSHA256(`${credExistente.salt}:${password}`);
        if (
          username.toLowerCase() !== credExistente.username.toLowerCase() ||
          hashTentativa !== credExistente.passwordHash
        ) {
          exibirErroAuth("Usuário ou senha inválidos.");
          return;
        }
        iniciarSessaoAdmin(credExistente.username);
        authForm.reset();
        alternarTelasAutenticacao();
        mostrarToastAdmin(`Bem-vindo(a) de volta, ${credExistente.username}!`);
      }
    });
  }

  // Navegação da Sidebar e atalhos de seção
  document.querySelectorAll(".admin-nav-btn[data-section]").forEach((btn) => {
    btn.addEventListener("click", () => {
      navegarParaSecao(btn.getAttribute("data-section"));
    });
  });

  document.querySelectorAll("[data-goto-section]").forEach((btn) => {
    btn.addEventListener("click", () => {
      navegarParaSecao(btn.getAttribute("data-goto-section"));
    });
  });

  // Menu mobile da Sidebar
  const mobileMenuBtn = document.getElementById("admin-mobile-menu-btn");
  const sidebar = document.getElementById("admin-sidebar");
  const sidebarOverlay = document.getElementById("admin-sidebar-overlay");
  if (mobileMenuBtn && sidebar && sidebarOverlay) {
    mobileMenuBtn.addEventListener("click", () => {
      sidebar.classList.toggle("admin-sidebar--open");
      sidebarOverlay.classList.toggle("admin-sidebar-overlay--open");
    });
    sidebarOverlay.addEventListener("click", () => {
      sidebar.classList.remove("admin-sidebar--open");
      sidebarOverlay.classList.remove("admin-sidebar-overlay--open");
    });
  }

  // Botão Sair (Logout)
  const logoutBtn = document.getElementById("admin-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => encerrarSessaoAdmin(true));
  }

  // Botões de abrir modais de criação
  const btnNovoProd = document.getElementById("btn-abrir-modal-produto");
  const dashNovoProd = document.getElementById("dash-btn-novo-produto");
  const btnNovaCat = document.getElementById("btn-abrir-modal-categoria");
  const dashNovaCat = document.getElementById("dash-btn-nova-categoria");
  const btnNovoBanner = document.getElementById("btn-abrir-modal-banner");

  if (btnNovoProd) btnNovoProd.addEventListener("click", () => abrirModalProduto(null));
  if (dashNovoProd) {
    dashNovoProd.addEventListener("click", () => {
      navegarParaSecao("produtos");
      abrirModalProduto(null);
    });
  }
  if (btnNovaCat) btnNovaCat.addEventListener("click", () => abrirModalCategoria(null));
  if (dashNovaCat) {
    dashNovaCat.addEventListener("click", () => {
      navegarParaSecao("categorias");
      abrirModalCategoria(null);
    });
  }
  if (btnNovoBanner) btnNovoBanner.addEventListener("click", () => abrirModalBanner(null));

  // Fechamento de modais
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      fecharModalPorId(btn.getAttribute("data-close-modal"));
    });
  });

  const confirmOkBtn = document.getElementById("modal-confirm-ok-btn");
  if (confirmOkBtn) {
    confirmOkBtn.addEventListener("click", () => {
      fecharModalPorId("modal-confirm-overlay");
      if (typeof acaoConfirmacaoPendente === "function") {
        const fn = acaoConfirmacaoPendente;
        acaoConfirmacaoPendente = null;
        fn();
      }
    });
  }

  // Filtros de Produtos
  const prodSearch = document.getElementById("admin-prod-search");
  const prodFilterCat = document.getElementById("admin-prod-filter-cat");
  const prodFilterStatus = document.getElementById("admin-prod-filter-status");
  const btnZerarCliques = document.getElementById("btn-zerar-cliques-whatsapp");

  if (prodSearch) prodSearch.addEventListener("input", renderizarTabelaProdutosAdmin);
  if (prodFilterCat) prodFilterCat.addEventListener("change", renderizarTabelaProdutosAdmin);
  if (prodFilterStatus) prodFilterStatus.addEventListener("change", renderizarTabelaProdutosAdmin);

  if (btnZerarCliques) {
    btnZerarCliques.addEventListener("click", () => {
      if (!exigirSessaoAutenticada()) return;
      abrirModalConfirmacao(
        "Zerar Contador do WhatsApp",
        "Deseja zerar o contador de cliques no botão 'Finalizar Pedido'?",
        () => {
          zerarContadorCliquesWhatsApp();
          renderizarDashboardAdmin();
          mostrarToastAdmin("Contador de cliques no WhatsApp zerado com sucesso!", "info");
        }
      );
    });
  }

  // Submissão dos formulários
  const formProduto = document.getElementById("form-produto");
  const formCategoria = document.getElementById("form-categoria");
  const formBanner = document.getElementById("form-banner");
  const formInfo = document.getElementById("form-info-hamburgueria");
  const formCredenciais = document.getElementById("form-alterar-credenciais");

  if (formProduto) formProduto.addEventListener("submit", salvarFormularioProduto);
  if (formCategoria) formCategoria.addEventListener("submit", salvarFormularioCategoria);
  if (formBanner) formBanner.addEventListener("submit", salvarFormularioBanner);
  if (formInfo) formInfo.addEventListener("submit", salvarFormularioInformacoesAdmin);
  if (formCredenciais) formCredenciais.addEventListener("submit", salvarNovasCredenciaisAdmin);

  // Previews e uploads de imagem (Produto, Categoria, Banner e Logos)
  const vincularPreviewImagem = (inputTextoId, inputFileId, imgPreviewId, selectAssetId = null) => {
    const inputTexto = document.getElementById(inputTextoId);
    const inputFile = document.getElementById(inputFileId);
    const imgPreview = document.getElementById(imgPreviewId);
    const selectAsset = selectAssetId ? document.getElementById(selectAssetId) : null;

    if (inputTexto && imgPreview) {
      inputTexto.addEventListener("input", () => {
        imgPreview.src = resolverCaminhoImagemAdmin(inputTexto.value);
      });
    }

    if (inputFile && inputTexto && imgPreview) {
      inputFile.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        lerArquivoImagemComoDataURL(file, (dataUrl) => {
          inputTexto.value = dataUrl;
          imgPreview.src = dataUrl;
          mostrarToastAdmin("Imagem carregada! Clique em Salvar para confirmar.", "info");
        });
      });
    }

    if (selectAsset && inputTexto && imgPreview) {
      selectAsset.addEventListener("change", () => {
        if (selectAsset.value) {
          inputTexto.value = selectAsset.value;
          imgPreview.src = resolverCaminhoImagemAdmin(selectAsset.value);
        }
      });
    }
  };

  vincularPreviewImagem("prod-imagem", "file-prod-imagem", "preview-prod-img", "select-prod-asset");
  vincularPreviewImagem("cat-imagem", "file-cat-imagem", "preview-cat-img");
  vincularPreviewImagem("banner-imagem", "file-banner-imagem", "preview-banner-img");
  vincularPreviewImagem("info-logo", "file-info-logo", "preview-info-logo");
  vincularPreviewImagem("info-logo-emblema", "file-info-logo-emblema", "preview-info-logo-emblema");

  // Auto-preenchimento opcional ao selecionar um produto vinculado no modal de Banner
  const selectBannerProd = document.getElementById("banner-produto-id");
  if (selectBannerProd) {
    selectBannerProd.addEventListener("change", () => {
      const prodId = selectBannerProd.value;
      if (!prodId) return;
      const prod = obterProdutosDoSistema().find((p) => p.id === Number(prodId));
      if (!prod) return;

      const tituloInput = document.getElementById("banner-titulo");
      const subInput = document.getElementById("banner-subtitulo");
      const textoInput = document.getElementById("banner-texto");
      const imgInput = document.getElementById("banner-imagem");
      const previewImg = document.getElementById("preview-banner-img");

      if (tituloInput && !tituloInput.value.trim()) tituloInput.value = prod.nome;
      if (subInput) subInput.value = formatarMoeda(prod.preco);
      if (textoInput && !textoInput.value.trim()) textoInput.value = prod.descricao;
      if (imgInput && prod.imagem) {
        imgInput.value = prod.imagem;
        if (previewImg) previewImg.src = resolverCaminhoImagemAdmin(prod.imagem);
      }
    });
  }

  // Backup e Restauração
  const btnExportar = document.getElementById("btn-exportar-backup");
  const inputImportar = document.getElementById("input-importar-backup");
  const btnRestaurar = document.getElementById("btn-restaurar-padrao");

  if (btnExportar) btnExportar.addEventListener("click", exportarBackupJSON);
  if (inputImportar) {
    inputImportar.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importarBackupJSON(file);
      inputImportar.value = "";
    });
  }
  if (btnRestaurar) btnRestaurar.addEventListener("click", confirmarRestauracaoPadrao);

  // Delegação de eventos para ações nas tabelas e listas
  document.addEventListener("click", (e) => {
    // Produtos
    const btnProdEdit = e.target.closest("[data-prod-edit]");
    if (btnProdEdit) {
      abrirModalProduto(btnProdEdit.getAttribute("data-prod-edit"));
      return;
    }
    const btnProdDelete = e.target.closest("[data-prod-delete]");
    if (btnProdDelete) {
      confirmarExclusaoProduto(btnProdDelete.getAttribute("data-prod-delete"));
      return;
    }
    const btnProdToggle = e.target.closest("[data-prod-toggle]");
    if (btnProdToggle) {
      alternarStatusProduto(btnProdToggle.getAttribute("data-prod-toggle"));
      return;
    }
    const btnProdMove = e.target.closest("[data-prod-move]");
    if (btnProdMove) {
      moverOrdemProduto(
        btnProdMove.getAttribute("data-id"),
        btnProdMove.getAttribute("data-prod-move")
      );
      return;
    }

    // Categorias
    const btnCatEdit = e.target.closest("[data-cat-edit]");
    if (btnCatEdit) {
      abrirModalCategoria(btnCatEdit.getAttribute("data-cat-edit"));
      return;
    }
    const btnCatDelete = e.target.closest("[data-cat-delete]");
    if (btnCatDelete) {
      confirmarExclusaoCategoria(btnCatDelete.getAttribute("data-cat-delete"));
      return;
    }
    const btnCatToggle = e.target.closest("[data-cat-toggle]");
    if (btnCatToggle) {
      alternarStatusCategoria(btnCatToggle.getAttribute("data-cat-toggle"));
      return;
    }
    const btnCatMove = e.target.closest("[data-cat-move]");
    if (btnCatMove) {
      moverOrdemCategoria(
        btnCatMove.getAttribute("data-id"),
        btnCatMove.getAttribute("data-cat-move")
      );
      return;
    }

    // Banners
    const btnBannerEdit = e.target.closest("[data-banner-edit]");
    if (btnBannerEdit) {
      abrirModalBanner(btnBannerEdit.getAttribute("data-banner-edit"));
      return;
    }
    const btnBannerDelete = e.target.closest("[data-banner-delete]");
    if (btnBannerDelete) {
      confirmarExclusaoBanner(btnBannerDelete.getAttribute("data-banner-delete"));
      return;
    }
    const btnBannerToggle = e.target.closest("[data-banner-toggle]");
    if (btnBannerToggle) {
      alternarStatusBanner(btnBannerToggle.getAttribute("data-banner-toggle"));
      return;
    }
  });

  // Atualiza automaticamente o Dashboard se outra aba clicar em "Finalizar Pedido" rumo ao WhatsApp
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEYS.CLIQUES_WHATSAPP && obterSessaoAtiva()) {
      renderizarDashboardAdmin();
    }
  });
}

document.addEventListener("DOMContentLoaded", inicializarPainelAdmin);
