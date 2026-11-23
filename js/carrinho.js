/**
 * CARRINHO DE COMPRAS, RENDERIZAÇÃO DO CARDÁPIO E INTEGRAÇÃO DO SITE — PIT STOP BURGER
 * ==========================================================================
 * Gerencia a exibição dos cards de produtos, filtros de categoria, busca,
 * banners dinâmicos, informações comerciais da hamburgueria e estado do
 * carrinho via localStorage.
 */

const STORAGE_KEY_CARRINHO = "pitstop_burger_carrinho_v1";
const STORAGE_KEY_DADOS_CLIENTE = "pitstop_burger_cliente_v1";

// Estado interno do carrinho: array de objetos { id: number, quantidade: number }
let estadoCarrinho = [];
let categoriaAtiva = "todos";
let termoBusca = "";
let toastTimeoutId = null;

/**
 * Carrega o carrinho salvo no localStorage
 */
function carregarCarrinhoDoStorage() {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY_CARRINHO);
    if (!salvo) {
      estadoCarrinho = [];
      return;
    }
    const parsed = JSON.parse(salvo);
    if (Array.isArray(parsed)) {
      estadoCarrinho = parsed
        .filter((item) => item && buscarProdutoPorId(item.id) && Number(item.quantidade) > 0)
        .map((item) => ({
          id: Number(item.id),
          quantidade: Math.floor(Number(item.quantidade))
        }));
    } else {
      estadoCarrinho = [];
    }
  } catch (erro) {
    console.error("Erro ao carregar carrinho do localStorage:", erro);
    estadoCarrinho = [];
  }
}

/**
 * Salva o estado atual do carrinho no localStorage
 */
function salvarCarrinhoNoStorage() {
  try {
    localStorage.setItem(STORAGE_KEY_CARRINHO, JSON.stringify(estadoCarrinho));
  } catch (erro) {
    console.error("Erro ao salvar carrinho no localStorage:", erro);
  }
}

/**
 * Salva nome e observações preenchidos pelo cliente no localStorage
 */
function salvarDadosClienteNoStorage() {
  try {
    const inputNome = document.getElementById("cliente-nome");
    const inputObs = document.getElementById("pedido-observacoes");
    if (!inputNome && !inputObs) return;
    const dados = {
      nome: inputNome ? inputNome.value : "",
      observacoes: inputObs ? inputObs.value : ""
    };
    localStorage.setItem(STORAGE_KEY_DADOS_CLIENTE, JSON.stringify(dados));
  } catch (erro) {
    console.error("Erro ao salvar dados do cliente:", erro);
  }
}

/**
 * Restaura nome e observações do cliente se houver no localStorage
 */
function restaurarDadosClienteDoStorage() {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY_DADOS_CLIENTE);
    if (!salvo) return;
    const dados = JSON.parse(salvo);
    const inputNome = document.getElementById("cliente-nome");
    const inputObs = document.getElementById("pedido-observacoes");
    if (inputNome && dados.nome) inputNome.value = dados.nome;
    if (inputObs && dados.observacoes) inputObs.value = dados.observacoes;
  } catch (erro) {
    console.error("Erro ao restaurar dados do cliente:", erro);
  }
}

/**
 * Retorna a lista detalhada de itens do carrinho cruzando com o catálogo oficial (`produtos.js`).
 * O preço nunca vem do DOM — vem sempre de `buscarProdutoPorId()`.
 */
function obterItensDetalhadosCarrinho() {
  return estadoCarrinho
    .map((item) => {
      const produto = buscarProdutoPorId(item.id);
      if (!produto) return null;
      const subtotal = Number((produto.preco * item.quantidade).toFixed(2));
      return {
        id: produto.id,
        nome: produto.nome,
        precoUnitario: produto.preco,
        quantidade: item.quantidade,
        subtotal: subtotal,
        imagem: produto.imagem,
        categoria: produto.categoria,
        categoriaSlug: produto.categoriaSlug
      };
    })
    .filter(Boolean);
}

/**
 * Calcula a quantidade total de itens no carrinho
 * @returns {number}
 */
function calcularQuantidadeTotalItens() {
  const itensValidos = obterItensDetalhadosCarrinho();
  return itensValidos.reduce((acc, item) => acc + item.quantidade, 0);
}

/**
 * Calcula o subtotal apenas dos produtos do carrinho
 * @returns {number}
 */
function calcularSubtotalProdutosCarrinho() {
  const itens = obterItensDetalhadosCarrinho();
  const subtotal = itens.reduce((acc, item) => acc + item.subtotal, 0);
  return Number(subtotal.toFixed(2));
}

/**
 * Calcula o valor total do pedido (incluindo taxa de entrega se configurada e se houver itens)
 * @returns {number}
 */
function calcularTotalCarrinho() {
  const subtotal = calcularSubtotalProdutosCarrinho();
  if (subtotal === 0) return 0;
  const info = typeof obterInfoHamburgueria === "function" ? obterInfoHamburgueria() : { taxaEntrega: 0 };
  const taxa = Number(info.taxaEntrega) || 0;
  return Number((subtotal + taxa).toFixed(2));
}

/**
 * Adiciona um produto ao carrinho (ou incrementa sua quantidade)
 * @param {number|string} produtoId
 */
function adicionarAoCarrinho(produtoId) {
  const produto = buscarProdutoPorId(produtoId);
  if (!produto) return;

  const itemExistente = estadoCarrinho.find((item) => item.id === produto.id);
  if (itemExistente) {
    itemExistente.quantidade += 1;
  } else {
    estadoCarrinho.push({ id: produto.id, quantidade: 1 });
  }

  salvarCarrinhoNoStorage();
  atualizarInterfaceCarrinho(true);
  destacarBotaoCardAdicionado(produto.id);
  mostrarNotificacao(`${produto.nome} adicionado ao carrinho!`);
}

/**
 * Altera a quantidade de um item no carrinho (+1 ou -1)
 * @param {number|string} produtoId
 * @param {number} delta
 */
function alterarQuantidadeCarrinho(produtoId, delta) {
  const id = Number(produtoId);
  const indice = estadoCarrinho.findIndex((item) => item.id === id);
  if (indice === -1) return;

  const novaQuantidade = estadoCarrinho[indice].quantidade + delta;
  if (novaQuantidade <= 0) {
    const produto = buscarProdutoPorId(id);
    estadoCarrinho.splice(indice, 1);
    if (produto) {
      mostrarNotificacao(`${produto.nome} removido do carrinho.`, "info");
    }
  } else {
    estadoCarrinho[indice].quantidade = novaQuantidade;
  }

  salvarCarrinhoNoStorage();
  atualizarInterfaceCarrinho(false);
}

/**
 * Remove completamente um produto do carrinho
 * @param {number|string} produtoId
 */
function removerDoCarrinho(produtoId) {
  const id = Number(produtoId);
  const produto = buscarProdutoPorId(id);
  estadoCarrinho = estadoCarrinho.filter((item) => item.id !== id);

  salvarCarrinhoNoStorage();
  atualizarInterfaceCarrinho(false);

  if (produto) {
    mostrarNotificacao(`${produto.nome} removido do carrinho.`, "info");
  }
}

/**
 * Limpa todos os itens do carrinho
 * @param {boolean} silencioso - Se true, não exibe toast de carrinho limpo
 */
function limparCarrinho(silencioso = false) {
  if (estadoCarrinho.length === 0 && !silencioso) return;
  estadoCarrinho = [];
  salvarCarrinhoNoStorage();
  atualizarInterfaceCarrinho(false);

  if (!silencioso) {
    mostrarNotificacao("Carrinho esvaziado com sucesso.", "info");
  }
}

/**
 * Limpa carrinho e dados do formulário após concluir envio para o WhatsApp
 */
function limparCarrinhoAposPedido() {
  estadoCarrinho = [];
  salvarCarrinhoNoStorage();
  try {
    localStorage.removeItem(STORAGE_KEY_DADOS_CLIENTE);
  } catch (e) {
    // Ignora erro de storage se houver
  }
  const inputObs = document.getElementById("pedido-observacoes");
  if (inputObs) inputObs.value = "";
  atualizarInterfaceCarrinho(false);
}

/**
 * Escapa caracteres especiais para evitar problemas ao renderizar atributos/HTML
 * @param {string} str
 * @returns {string}
 */
function escaparHTML(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Gera o HTML da área de imagem ou espaço reservado padronizado do produto
 * @param {object} produto
 * @returns {string}
 */
function criarMidiaProdutoHTML(produto) {
  const badgeHTML = produto.destaque
    ? `<span class="card__badge">${escaparHTML(produto.destaque)}</span>`
    : "";

  const numeroTagHTML = produto.numero
    ? `<span class="card__number-tag">${escaparHTML(produto.numero)}</span>`
    : "";

  if (produto.imagem && produto.imagem.trim() !== "") {
    const nomeSeguro = String(produto.nome || "").replace(/'/g, "\\'");
    return `
      <div class="card__media">
        ${badgeHTML}
        ${numeroTagHTML}
        <img
          class="card__img"
          src="${escaparHTML(produto.imagem)}"
          alt="${escaparHTML(produto.nome)}"
          width="380"
          height="280"
          loading="lazy"
          onerror="this.parentElement.classList.add('card__media--placeholder'); this.outerHTML = criarPlaceholderSVG('${escaparHTML(produto.categoriaSlug)}', '${nomeSeguro}');"
        >
      </div>
    `;
  }

  return `
    <div class="card__media card__media--placeholder">
      ${badgeHTML}
      ${numeroTagHTML}
      ${criarPlaceholderSVG(produto.categoriaSlug, produto.nome)}
    </div>
  `;
}

/**
 * Cria o espaço reservado visual seguindo o mesmo padrão estético da Pit Stop Burger
 * para produtos que ainda não possuem foto cadastrada.
 */
function criarPlaceholderSVG(categoriaSlug, nomeProduto) {
  const info = typeof obterInfoHamburgueria === "function" ? obterInfoHamburgueria() : { nome: "PIT STOP BURGER" };
  const isBatata = categoriaSlug === "batata-frita";
  const iconeSVG = isBatata
    ? `<svg class="placeholder-art__icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M18 28L22 54H42L46 28H18Z" fill="#e8321e" stroke="#ffc20e" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M22 28V12C22 10.5 23.2 9.5 24.5 9.5C25.8 9.5 27 10.5 27 12V28" stroke="#ffc20e" stroke-width="4" stroke-linecap="round"/>
        <path d="M29.5 28V8C29.5 6.5 30.7 5.5 32 5.5C33.3 5.5 34.5 6.5 34.5 8V28" stroke="#ffc20e" stroke-width="4" stroke-linecap="round"/>
        <path d="M37 28V13C37 11.5 38.2 10.5 39.5 10.5C40.8 10.5 42 11.5 42 13V28" stroke="#ffc20e" stroke-width="4" stroke-linecap="round"/>
        <path d="M25 38H39" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`
    : `<svg class="placeholder-art__icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M12 28C12 17.5 20.5 11 32 11C43.5 11 52 17.5 52 28H12Z" fill="#ffc20e"/>
        <circle cx="24" cy="19" r="1.4" fill="#111"/>
        <circle cx="32" cy="17" r="1.4" fill="#111"/>
        <circle cx="40" cy="20" r="1.4" fill="#111"/>
        <circle cx="28" cy="23" r="1.4" fill="#111"/>
        <circle cx="36" cy="23" r="1.4" fill="#111"/>
        <path d="M9 33C9 31.3 10.3 30 12 30H52C53.7 30 55 31.3 55 33C55 34.7 53.7 36 52 36H12C10.3 36 9 34.7 9 33Z" fill="#8b3a1e"/>
        <path d="M12 36L18 40L25 36L32 41L39 36L46 40L52 36" stroke="#ffc20e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="12" y="42" width="40" height="9" rx="4.5" fill="#e8321e"/>
      </svg>`;

  return `
    <div class="placeholder-art" role="img" aria-label="Imagem ilustrativa de ${escaparHTML(nomeProduto)}">
      <div class="placeholder-art__badge">
        ${iconeSVG}
        <span class="placeholder-art__brand">${escaparHTML(String(info.nome || "PIT STOP BURGER").toUpperCase())}</span>
        <span class="placeholder-art__sub">${isBatata ? "Porção Crocante" : "Feito na Hora"}</span>
      </div>
    </div>
  `;
}

/**
 * Renderiza dinamicamente as abas de categorias com base nas categorias ativas do sistema
 */
function renderizarAbasCategorias() {
  const tabsContainer = document.querySelector(".menu__tabs");
  if (!tabsContainer) return;

  sincronizarArrayProdutosGlobal();
  const categoriasAtivas = obterCategoriasDoSistema().filter((c) => c.ativo !== false);
  const slugsAtivos = new Set(categoriasAtivas.map((c) => c.slug));
  const produtosAtivos = produtos.filter(
    (p) => p.ativo !== false && slugsAtivos.has(p.categoriaSlug)
  );

  // Se a categoria selecionada não existir mais ou estiver inativa, volta para "todos"
  if (categoriaAtiva !== "todos" && !slugsAtivos.has(categoriaAtiva)) {
    categoriaAtiva = "todos";
  }

  const botoesHTML = [
    `
      <button
        type="button"
        class="menu__tab-btn ${categoriaAtiva === "todos" ? "menu__tab-btn--active" : ""}"
        role="tab"
        aria-selected="${categoriaAtiva === "todos" ? "true" : "false"}"
        data-category="todos"
      >
        Todos <span class="menu__tab-badge">${produtosAtivos.length}</span>
      </button>
    `
  ];

  categoriasAtivas.forEach((cat) => {
    const qtd = produtosAtivos.filter((p) => p.categoriaSlug === cat.slug).length;
    const isAtiva = categoriaAtiva === cat.slug;
    botoesHTML.push(`
      <button
        type="button"
        class="menu__tab-btn ${isAtiva ? "menu__tab-btn--active" : ""}"
        role="tab"
        aria-selected="${isAtiva ? "true" : "false"}"
        data-category="${escaparHTML(cat.slug)}"
      >
        ${escaparHTML(cat.nome)} <span class="menu__tab-badge">${qtd}</span>
      </button>
    `);
  });

  tabsContainer.innerHTML = botoesHTML.join("");

  tabsContainer.querySelectorAll(".menu__tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = btn.getAttribute("data-category");
      selecionarCategoria(cat);
    });
  });
}

/**
 * Renderiza o cardápio completo na grade ou filtrado por categoria/busca
 */
function renderizarCardapio() {
  const container = document.getElementById("menu-grid");
  if (!container) return;

  sincronizarArrayProdutosGlobal();
  const categoriasAtivas = obterCategoriasDoSistema().filter((c) => c.ativo !== false);
  const slugsAtivos = new Set(categoriasAtivas.map((c) => c.slug));

  const termoNormalizado = termoBusca.trim().toLowerCase();

  const produtosFiltrados = produtos.filter((produto) => {
    if (produto.ativo === false || !slugsAtivos.has(produto.categoriaSlug)) {
      return false;
    }
    const matchCategoria =
      categoriaAtiva === "todos" || produto.categoriaSlug === categoriaAtiva;
    const matchBusca =
      termoNormalizado === "" ||
      produto.nome.toLowerCase().includes(termoNormalizado) ||
      produto.descricao.toLowerCase().includes(termoNormalizado) ||
      produto.categoria.toLowerCase().includes(termoNormalizado);

    return matchCategoria && matchBusca;
  });

  if (produtosFiltrados.length === 0) {
    container.innerHTML = `
      <div class="menu__empty">
        <p class="menu__empty-title">Nenhum produto encontrado</p>
        <p class="menu__empty-text">Tente buscar por outro termo ou selecione a categoria "Todos".</p>
        <button type="button" class="btn btn--primary btn--sm" id="btn-limpar-filtros">
          Mostrar Todos os Produtos
        </button>
      </div>
    `;
    const btnLimpar = document.getElementById("btn-limpar-filtros");
    if (btnLimpar) {
      btnLimpar.addEventListener("click", () => {
        selecionarCategoria("todos");
        const inputBusca = document.getElementById("menu-search-input");
        if (inputBusca) inputBusca.value = "";
        termoBusca = "";
        renderizarCardapio();
      });
    }
    return;
  }

  // Se estiver na visão "todos" e sem busca ativa, agrupa visualmente por cabeçalho de categoria
  if (categoriaAtiva === "todos" && termoNormalizado === "") {
    container.innerHTML = categoriasAtivas
      .map((cat) => {
        const itensDaCategoria = produtosFiltrados.filter(
          (p) => p.categoriaSlug === cat.slug
        );
        if (itensDaCategoria.length === 0) return "";

        const iconeCatHTML = cat.imagem
          ? `<img src="${escaparHTML(cat.imagem)}" alt="" class="menu__category-flag" style="object-fit:cover;background:none;" onerror="this.style.display='none'">`
          : `<span class="menu__category-flag" aria-hidden="true"></span>`;

        return `
          <div class="menu__category-group" data-category-group="${escaparHTML(cat.slug)}">
            <div class="menu__category-header">
              <div class="menu__category-title-wrap">
                ${iconeCatHTML}
                <div>
                  <h3 class="menu__category-title">${escaparHTML(cat.nome)}</h3>
                  <p class="menu__category-desc">${escaparHTML(cat.subtitulo || "")}</p>
                </div>
              </div>
              <span class="menu__category-count">${itensDaCategoria.length} ${itensDaCategoria.length === 1 ? "opção" : "opções"}</span>
            </div>
            <div class="menu__cards-grid">
              ${itensDaCategoria.map((produto) => criarCardProdutoHTML(produto)).join("")}
            </div>
          </div>
        `;
      })
      .join("");
  } else {
    container.innerHTML = `
      <div class="menu__cards-grid">
        ${produtosFiltrados.map((produto) => criarCardProdutoHTML(produto)).join("")}
      </div>
    `;
  }
}

/**
 * Cria o HTML individual de um card de produto seguindo o design oficial
 * @param {object} produto
 * @returns {string}
 */
function criarCardProdutoHTML(produto) {
  const itemNoCarrinho = estadoCarrinho.find((i) => i.id === produto.id);
  const qtdNoCarrinho = itemNoCarrinho ? itemNoCarrinho.quantidade : 0;

  return `
    <article class="card" data-cat="${escaparHTML(produto.categoriaSlug)}" data-product-id="${produto.id}">
      ${criarMidiaProdutoHTML(produto)}
      <div class="card__body">
        <div class="card__meta">
          <span class="card__category-label">${escaparHTML(produto.categoria)}</span>
          ${qtdNoCarrinho > 0 ? `<span class="card__in-cart-badge" aria-label="${qtdNoCarrinho} no carrinho">${qtdNoCarrinho} no carrinho</span>` : ""}
        </div>
        <h4 class="card__title">${escaparHTML(produto.nome)}</h4>
        <p class="card__text">${escaparHTML(produto.descricao)}</p>
        <div class="card__footer">
          <div class="card__price-box">
            <span class="card__price-label">Preço</span>
            <span class="card__price">${formatarMoeda(produto.preco)}</span>
          </div>
          <button
            class="card__add-btn"
            type="button"
            data-action="add-to-cart"
            data-id="${produto.id}"
            aria-label="Adicionar ${escaparHTML(produto.nome)} ao carrinho"
          >
            <svg class="card__add-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            <span>ADICIONAR AO CARRINHO</span>
          </button>
        </div>
      </div>
    </article>
  `;
}

/**
 * Aplica no DOM do site público os banners configurados no painel administrativo
 */
function aplicarBannersNoSite() {
  if (typeof obterBannersDoSistema !== "function") return;
  const banners = obterBannersDoSistema();
  const info = typeof obterInfoHamburgueria === "function" ? obterInfoHamburgueria() : INFO_PADRAO;

  // 1. Banner Principal (Hero)
  const heroSection = document.getElementById("inicio");
  const bannerHero = banners.find((b) => b.tipo === "hero") || banners[0];
  if (heroSection && bannerHero) {
    if (bannerHero.ativo === false) {
      heroSection.hidden = true;
      heroSection.style.display = "none";
    } else {
      heroSection.hidden = false;
      heroSection.style.display = "";

      const tagEl = heroSection.querySelector(".hero__tag");
      const titleEl = heroSection.querySelector(".hero__title");
      const textEl = heroSection.querySelector(".hero__text");
      const actionsEl = heroSection.querySelector(".hero__actions");
      const imgEl = heroSection.querySelector(".hero__logo-img");

      if (tagEl) tagEl.textContent = bannerHero.tag || `${info.subtitulo} • Since ${info.desde}`;
      if (titleEl) {
        const sub = bannerHero.subtitulo ? `<br>${escaparHTML(bannerHero.subtitulo)}` : "";
        titleEl.innerHTML = `${escaparHTML(bannerHero.titulo)} <span class="text-gradient">${escaparHTML(info.nome)}</span>!${sub}`;
        if (bannerHero.titulo.toLowerCase().includes(info.nome.toLowerCase())) {
          // Caso o título já contenha o nome da hamburgueria, destaca o nome
          const regex = new RegExp(`(${info.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i");
          titleEl.innerHTML = `${escaparHTML(bannerHero.titulo).replace(regex, '<span class="text-gradient">$1</span>')}${sub}`;
        }
      }
      if (textEl) textEl.textContent = bannerHero.texto || "";
      if (imgEl && bannerHero.imagem) {
        imgEl.src = bannerHero.imagem;
      }
      if (actionsEl) {
        const btn1 = bannerHero.textoBotaoPrimario
          ? `<a href="${escaparHTML(bannerHero.linkBotaoPrimario || "#cardapio")}" class="btn btn--primary btn--pulse">${escaparHTML(bannerHero.textoBotaoPrimario)}</a>`
          : "";
        const btn2 = bannerHero.textoBotaoSecundario
          ? `<a href="${escaparHTML(bannerHero.linkBotaoSecundario || "#sobre")}" class="btn btn--outline">${escaparHTML(bannerHero.textoBotaoSecundario)}</a>`
          : "";
        actionsEl.innerHTML = `${btn1}${btn2}`;
      }
    }
  }

  // 2. Banners de Destaque / Promocionais na seção do Cardápio
  const featuredArticle = document.querySelector(".featured");
  if (!featuredArticle) return;

  // Container para banners de destaque (reaproveita o elemento .featured original ou lista de destaques)
  let wrapperDestaques = document.getElementById("featured-banners-container");
  if (!wrapperDestaques) {
    wrapperDestaques = document.createElement("div");
    wrapperDestaques.id = "featured-banners-container";
    featuredArticle.parentNode.insertBefore(wrapperDestaques, featuredArticle);
    featuredArticle.remove();
  }

  const bannersDestaqueAtivos = banners.filter(
    (b) => b.tipo !== "hero" && b.ativo !== false
  );

  if (bannersDestaqueAtivos.length === 0) {
    wrapperDestaques.innerHTML = "";
    return;
  }

  wrapperDestaques.innerHTML = bannersDestaqueAtivos
    .map((b) => {
      const prodVinculado = b.produtoId ? buscarProdutoPorId(b.produtoId) : null;
      const tituloExibido = b.titulo || (prodVinculado ? prodVinculado.nome : "");
      const textoExibido = b.texto || (prodVinculado ? prodVinculado.descricao : "");
      const precoExibido = prodVinculado
        ? formatarMoeda(prodVinculado.preco)
        : b.subtitulo || "";
      const imgExibida = b.imagem || (prodVinculado ? prodVinculado.imagem : "");

      const botaoAcaoHTML = prodVinculado
        ? `
          <button
            type="button"
            class="btn btn--primary"
            data-action="add-to-cart"
            data-id="${prodVinculado.id}"
          >
            ${escaparHTML(b.textoBotaoPrimario || "+ Adicionar ao Carrinho")}
          </button>
        `
        : b.textoBotaoPrimario
        ? `
          <a href="${escaparHTML(b.linkBotaoPrimario || "#cardapio")}" class="btn btn--primary">
            ${escaparHTML(b.textoBotaoPrimario)}
          </a>
        `
        : "";

      const midiaHTML = imgExibida
        ? `
          <div class="featured__media">
            <img
              src="${escaparHTML(imgExibida)}"
              alt="${escaparHTML(tituloExibido)}"
              width="520"
              height="380"
              loading="lazy"
            >
          </div>
        `
        : "";

      return `
        <article class="featured reveal">
          <div class="featured__content">
            ${b.tag ? `<span class="featured__tag">${escaparHTML(b.tag)}</span>` : ""}
            <h3 class="featured__title">${escaparHTML(tituloExibido)}</h3>
            <p class="featured__text">${escaparHTML(textoExibido)}</p>
            <div class="featured__footer">
              ${precoExibido ? `<span class="featured__price">${escaparHTML(precoExibido)}</span>` : ""}
              ${botaoAcaoHTML}
            </div>
          </div>
          ${midiaHTML}
        </article>
      `;
    })
    .join("");
}

/**
 * Aplica as informações comerciais da hamburgueria no cabeçalho, sobre, rodapé e carrinho
 */
function aplicarInformacoesHamburgueriaNoSite() {
  if (typeof obterInfoHamburgueria !== "function") return;
  const info = obterInfoHamburgueria();

  // Título da aba e Favicon
  if (info.nome) {
    document.title = `${info.nome} | Cardápio Online & Pedidos via WhatsApp`;
  }
  const favicon = document.querySelector("link[rel='icon']");
  if (favicon && info.logoEmblema) {
    favicon.href = info.logoEmblema;
  }

  // Cabeçalho
  const headerLogo = document.querySelector(".header__logo");
  if (headerLogo && info.logoEmblema) {
    headerLogo.src = info.logoEmblema;
    headerLogo.alt = `Logo Oficial ${info.nome}`;
  }
  const headerBrandTitle = document.querySelector(".header__brand-title");
  if (headerBrandTitle && info.nome) {
    const partes = info.nome.trim().split(" ");
    if (partes.length > 1) {
      const ultima = partes.pop();
      headerBrandTitle.innerHTML = `${escaparHTML(partes.join(" ").toUpperCase())} <span>${escaparHTML(ultima.toUpperCase())}</span>`;
    } else {
      headerBrandTitle.textContent = info.nome.toUpperCase();
    }
  }
  const headerBrandSub = document.querySelector(".header__brand-sub");
  if (headerBrandSub) {
    headerBrandSub.textContent = info.subtitulo || "Hamburgueria Artesanal";
  }

  // Seção Sobre
  const aboutTag = document.querySelector(".about__tag");
  if (aboutTag) {
    aboutTag.textContent = `Desde ${info.desde || "2019"} • ${info.subtitulo || "Hamburgueria Artesanal"}`;
  }
  const aboutTitle = document.getElementById("about-title");
  if (aboutTitle) {
    aboutTitle.textContent = `Conheça a ${info.nome}`;
  }
  const aboutParagraph = document.querySelector(".about__content p");
  if (aboutParagraph && info.descricaoSobre) {
    aboutParagraph.textContent = info.descricaoSobre;
  }
  const aboutList = document.querySelector(".about__list");
  if (aboutList && Array.isArray(info.diferenciais) && info.diferenciais.length > 0) {
    aboutList.innerHTML = info.diferenciais
      .filter((item) => String(item).trim() !== "")
      .map((item) => `<li>${escaparHTML(item)}</li>`)
      .join("");
  }
  const aboutLogo = document.querySelector(".about__logo-showcase");
  if (aboutLogo && info.logo) {
    aboutLogo.src = info.logo;
    aboutLogo.alt = `Logo Oficial ${info.nome} — ${info.slogan || ""}`;
  }

  // Carrinho Lateral
  const cartDrawerLogo = document.querySelector(".cart-drawer__logo");
  if (cartDrawerLogo && info.logoEmblema) {
    cartDrawerLogo.src = info.logoEmblema;
  }
  const cartDrawerSub = document.querySelector(".cart-drawer__subtitle");
  if (cartDrawerSub) {
    cartDrawerSub.textContent = info.nome;
  }

  // Rodapé
  const footerLogo = document.querySelector(".footer__logo");
  if (footerLogo && info.logo) {
    footerLogo.src = info.logo;
    footerLogo.alt = `Logo ${info.nome}`;
  }
  const footerBrand = document.querySelector(".footer__brand");
  if (footerBrand) {
    footerBrand.textContent = info.nome;
  }
  const footerText = document.querySelector(".footer__text");
  if (footerText) {
    footerText.innerHTML = `${escaparHTML(info.subtitulo || "Hamburgueria Artesanal")} &bull; Since ${escaparHTML(info.desde || "2019")}.<br>${escaparHTML(info.slogan || "Sua parada obrigatória!")}`;
  }

  const footerAddress = document.querySelector(".footer__address");
  if (footerAddress) {
    const blocos = [];
    if (info.infoEntrega) {
      blocos.push(`<p>${escaparHTML(info.infoEntrega)}</p>`);
    }
    if (info.horarioFuncionamento) {
      blocos.push(`<p><strong>Horário:</strong> ${escaparHTML(info.horarioFuncionamento)}</p>`);
    }
    if (info.endereco) {
      blocos.push(`<p><strong>Endereço:</strong> ${escaparHTML(info.endereco)}</p>`);
    }
    if (info.telefone) {
      blocos.push(`<p><strong>Telefone:</strong> ${escaparHTML(info.telefone)}</p>`);
    }
    if (info.instagram) {
      const instaLimpo = info.instagram.replace(/^@/, "").trim();
      const instaUrl = instaLimpo.startsWith("http")
        ? instaLimpo
        : `https://instagram.com/${instaLimpo}`;
      blocos.push(
        `<p><strong>Instagram:</strong> <a href="${escaparHTML(instaUrl)}" target="_blank" rel="noopener" class="link">@${escaparHTML(instaLimpo.replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, ""))}</a></p>`
      );
    }
    if (Number(info.taxaEntrega) > 0) {
      blocos.push(`<p><strong>Taxa de Entrega:</strong> ${formatarMoeda(info.taxaEntrega)}</p>`);
    }
    footerAddress.innerHTML = blocos.join("");
  }

  const footerCopy = document.querySelector(".footer__copy");
  if (footerCopy) {
    const anoAtual = new Date().getFullYear();
    footerCopy.innerHTML = `&copy; ${escaparHTML(info.desde || "2019")}–${anoAtual} ${escaparHTML(info.nome)}. Todos os direitos reservados.`;
  }
}

/**
 * Aplica feedback visual temporário ao botão do card quando um produto é adicionado
 * @param {number} produtoId
 */
function destacarBotaoCardAdicionado(produtoId) {
  const card = document.querySelector(`.card[data-product-id="${produtoId}"]`);
  if (!card) return;
  const btn = card.querySelector(".card__add-btn");
  if (!btn) return;

  btn.classList.add("card__add-btn--added");
  const spanTexto = btn.querySelector("span");
  const textoOriginal = spanTexto ? spanTexto.textContent : "ADICIONAR AO CARRINHO";
  if (spanTexto) {
    spanTexto.textContent = "ADICIONADO!";
  }

  setTimeout(() => {
    btn.classList.remove("card__add-btn--added");
    if (spanTexto) {
      spanTexto.textContent = textoOriginal;
    }
  }, 900);
}

/**
 * Atualiza todos os elementos visuais do carrinho (badges, lista lateral, subtotais, total)
 * @param {boolean} animarBotaoFlutuante
 */
function atualizarInterfaceCarrinho(animarBotaoFlutuante = false) {
  const qtdTotal = calcularQuantidadeTotalItens();
  const valorTotal = calcularTotalCarrinho();
  const itensDetalhados = obterItensDetalhadosCarrinho();
  const info = typeof obterInfoHamburgueria === "function" ? obterInfoHamburgueria() : { taxaEntrega: 0 };
  const taxaEntrega = Number(info.taxaEntrega) || 0;

  // 1. Atualiza badge no cabeçalho e no botão flutuante
  const headerBadge = document.getElementById("header-cart-count");
  const floatingBadge = document.getElementById("floating-cart-count");
  const floatingTotal = document.getElementById("floating-cart-total");
  const floatingBtn = document.getElementById("floating-cart-btn");

  if (headerBadge) {
    headerBadge.textContent = qtdTotal;
    headerBadge.hidden = qtdTotal === 0;
  }

  if (floatingBadge) {
    floatingBadge.textContent = qtdTotal;
  }

  if (floatingTotal) {
    floatingTotal.textContent = formatarMoeda(valorTotal);
  }

  if (floatingBtn) {
    floatingBtn.classList.toggle("floating-cart--has-items", qtdTotal > 0);
    if (animarBotaoFlutuante) {
      floatingBtn.classList.remove("floating-cart--bump");
      void floatingBtn.offsetWidth;
      floatingBtn.classList.add("floating-cart--bump");
    }
  }

  // 2. Atualiza badges "X no carrinho" nos cards sem perder a posição de rolagem
  document.querySelectorAll(".card[data-product-id]").forEach((cardEl) => {
    const id = Number(cardEl.getAttribute("data-product-id"));
    const item = estadoCarrinho.find((i) => i.id === id);
    const qtd = item ? item.quantidade : 0;
    const metaEl = cardEl.querySelector(".card__meta");
    if (!metaEl) return;
    let badgeEl = metaEl.querySelector(".card__in-cart-badge");

    if (qtd > 0) {
      if (!badgeEl) {
        badgeEl = document.createElement("span");
        badgeEl.className = "card__in-cart-badge";
        metaEl.appendChild(badgeEl);
      }
      badgeEl.textContent = `${qtd} no carrinho`;
      badgeEl.setAttribute("aria-label", `${qtd} no carrinho`);
    } else if (badgeEl) {
      badgeEl.remove();
    }
  });

  // 3. Atualiza conteúdo do modal/painel lateral do carrinho
  const cartItemsContainer = document.getElementById("cart-items-list");
  const cartEmptyState = document.getElementById("cart-empty-state");
  const cartCheckoutDetails = document.getElementById("cart-checkout-details");
  const cartTotalValue = document.getElementById("cart-total-value");
  const btnFinalizar = document.getElementById("btn-finalizar-pedido");
  const btnLimparCarrinho = document.getElementById("btn-limpar-carrinho");

  if (!cartItemsContainer) return;

  // Exibe ou oculta informação de taxa de entrega se houver
  let taxaRowEl = document.getElementById("cart-delivery-fee-row");
  const summaryContainer = document.querySelector(".cart-summary");
  if (summaryContainer && !taxaRowEl) {
    taxaRowEl = document.createElement("div");
    taxaRowEl.id = "cart-delivery-fee-row";
    taxaRowEl.className = "cart-summary__row";
    taxaRowEl.style.fontSize = "0.82rem";
    taxaRowEl.style.color = "#d4d4d8";
    summaryContainer.insertBefore(taxaRowEl, summaryContainer.firstChild);
  }

  if (itensDetalhados.length === 0) {
    cartItemsContainer.innerHTML = "";
    if (cartEmptyState) cartEmptyState.hidden = false;
    if (cartCheckoutDetails) cartCheckoutDetails.hidden = true;
    if (cartTotalValue) cartTotalValue.textContent = formatarMoeda(0);
    if (taxaRowEl) taxaRowEl.hidden = true;
    if (btnFinalizar) btnFinalizar.disabled = true;
    if (btnLimparCarrinho) btnLimparCarrinho.hidden = true;
    return;
  }

  if (cartEmptyState) cartEmptyState.hidden = true;
  if (cartCheckoutDetails) cartCheckoutDetails.hidden = false;
  if (taxaRowEl) {
    if (taxaEntrega > 0) {
      taxaRowEl.hidden = false;
      taxaRowEl.innerHTML = `<span>Taxa de Entrega:</span><strong>${formatarMoeda(taxaEntrega)}</strong>`;
    } else {
      taxaRowEl.hidden = true;
    }
  }
  if (cartTotalValue) cartTotalValue.textContent = formatarMoeda(valorTotal);
  if (btnFinalizar) btnFinalizar.disabled = false;
  if (btnLimparCarrinho) btnLimparCarrinho.hidden = false;

  cartItemsContainer.innerHTML = itensDetalhados
    .map(
      (item) => `
      <li class="cart-item" data-cart-item-id="${item.id}">
        <div class="cart-item__info">
          <div class="cart-item__header">
            <h4 class="cart-item__title">${escaparHTML(item.nome)}</h4>
            <button
              type="button"
              class="cart-item__remove"
              data-action="remove-item"
              data-id="${item.id}"
              aria-label="Remover ${escaparHTML(item.nome)} do carrinho"
              title="Remover item"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>
              </svg>
            </button>
          </div>
          <p class="cart-item__unit-price">${formatarMoeda(item.precoUnitario)} cada</p>
          <div class="cart-item__controls-row">
            <div class="cart-item__qty-group" role="group" aria-label="Quantidade de ${escaparHTML(item.nome)}">
              <button
                type="button"
                class="cart-item__qty-btn"
                data-action="decrease-qty"
                data-id="${item.id}"
                aria-label="Diminuir quantidade de ${escaparHTML(item.nome)}"
              >&minus;</button>
              <span class="cart-item__qty-label">Quantidade: <strong>${item.quantidade}</strong></span>
              <button
                type="button"
                class="cart-item__qty-btn"
                data-action="increase-qty"
                data-id="${item.id}"
                aria-label="Aumentar quantidade de ${escaparHTML(item.nome)}"
              >+</button>
            </div>
            <div class="cart-item__subtotal">
              <span>Subtotal:</span>
              <strong>${formatarMoeda(item.subtotal)}</strong>
            </div>
          </div>
        </div>
      </li>
    `
    )
    .join("");
}

/**
 * Abre o painel lateral do carrinho
 */
function abrirCarrinho() {
  const drawer = document.getElementById("cart-drawer");
  const overlay = document.getElementById("cart-overlay");
  if (!drawer || !overlay) return;

  drawer.classList.add("cart-drawer--open");
  overlay.classList.add("cart-overlay--open");
  drawer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

/**
 * Fecha o painel lateral do carrinho
 */
function fecharCarrinho() {
  const drawer = document.getElementById("cart-drawer");
  const overlay = document.getElementById("cart-overlay");
  if (!drawer || !overlay) return;

  drawer.classList.remove("cart-drawer--open");
  overlay.classList.remove("cart-overlay--open");
  drawer.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

/**
 * Seleciona uma categoria do cardápio e atualiza os botões de aba
 * @param {string} slugCategoria
 */
function selecionarCategoria(slugCategoria) {
  categoriaAtiva = slugCategoria;

  document.querySelectorAll(".menu__tab-btn").forEach((btn) => {
    const isAtiva = btn.getAttribute("data-category") === slugCategoria;
    btn.classList.toggle("menu__tab-btn--active", isAtiva);
    btn.setAttribute("aria-selected", isAtiva ? "true" : "false");
  });

  renderizarCardapio();
}

/**
 * Exibe uma notificação flutuante (toast) na tela
 * @param {string} mensagem
 * @param {"success"|"info"|"error"} tipo
 */
function mostrarNotificacao(mensagem, tipo = "success") {
  const toast = document.getElementById("toast-notification");
  const toastMessage = document.getElementById("toast-message");
  if (!toast || !toastMessage) return;

  toastMessage.textContent = mensagem;
  toast.className = `toast toast--visible toast--${tipo}`;

  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
  }

  toastTimeoutId = setTimeout(() => {
    toast.classList.remove("toast--visible");
  }, 3000);
}

/**
 * Atualiza toda a visão pública quando os dados do sistema mudam no painel administrativo
 */
function sincronizarSitePublicoComAdmin() {
  sincronizarArrayProdutosGlobal();
  aplicarInformacoesHamburgueriaNoSite();
  aplicarBannersNoSite();
  renderizarAbasCategorias();
  renderizarCardapio();
  carregarCarrinhoDoStorage();
  atualizarInterfaceCarrinho(false);
}

/**
 * Inicializa todos os eventos do cardápio e do carrinho
 */
function inicializarCardapioECarrinho() {
  sincronizarSitePublicoComAdmin();
  restaurarDadosClienteDoStorage();

  // Escuta alterações feitas no Painel Administrativo em outra aba em tempo real
  window.addEventListener("storage", (evento) => {
    if (
      evento.key === STORAGE_KEYS.PRODUTOS ||
      evento.key === STORAGE_KEYS.CATEGORIAS ||
      evento.key === STORAGE_KEYS.BANNERS ||
      evento.key === STORAGE_KEYS.INFO ||
      evento.key === STORAGE_KEY_CARRINHO
    ) {
      sincronizarSitePublicoComAdmin();
    }
  });

  // Delegação de clique nos cards de produtos e destaque da casa
  document.addEventListener("click", (evento) => {
    const btnAdd = evento.target.closest("[data-action='add-to-cart']");
    if (btnAdd) {
      const id = btnAdd.getAttribute("data-id");
      adicionarAoCarrinho(id);
      return;
    }

    const btnIncrease = evento.target.closest("[data-action='increase-qty']");
    if (btnIncrease) {
      alterarQuantidadeCarrinho(btnIncrease.getAttribute("data-id"), 1);
      return;
    }

    const btnDecrease = evento.target.closest("[data-action='decrease-qty']");
    if (btnDecrease) {
      alterarQuantidadeCarrinho(btnDecrease.getAttribute("data-id"), -1);
      return;
    }

    const btnRemove = evento.target.closest("[data-action='remove-item']");
    if (btnRemove) {
      removerDoCarrinho(btnRemove.getAttribute("data-id"));
      return;
    }
  });

  // Busca em tempo real no cardápio
  const btnToggleSearch = document.getElementById("header-search-btn");
  const searchBarWrap = document.getElementById("menu-search-wrap");
  const inputBusca = document.getElementById("menu-search-input");
  const btnClearSearch = document.getElementById("menu-search-clear");

  if (btnToggleSearch && searchBarWrap && inputBusca) {
    btnToggleSearch.addEventListener("click", () => {
      searchBarWrap.classList.toggle("menu__search-wrap--open");
      const secCardapio = document.getElementById("cardapio");
      if (secCardapio) {
        secCardapio.scrollIntoView({ behavior: "smooth" });
      }
      setTimeout(() => inputBusca.focus(), 300);
    });
  }

  if (inputBusca) {
    inputBusca.addEventListener("input", (e) => {
      termoBusca = e.target.value;
      if (btnClearSearch) {
        btnClearSearch.hidden = termoBusca.trim() === "";
      }
      renderizarCardapio();
    });
  }

  if (btnClearSearch && inputBusca) {
    btnClearSearch.addEventListener("click", () => {
      inputBusca.value = "";
      termoBusca = "";
      btnClearSearch.hidden = true;
      renderizarCardapio();
      inputBusca.focus();
    });
  }

  // Botões de abrir/fechar o carrinho
  const floatingBtn = document.getElementById("floating-cart-btn");
  const headerCartBtn = document.getElementById("header-cart-btn");
  const closeCartBtn = document.getElementById("cart-close-btn");
  const continueShoppingBtn = document.getElementById("btn-continuar-comprando");
  const emptyContinueBtn = document.getElementById("btn-empty-ver-cardapio");
  const cartOverlay = document.getElementById("cart-overlay");
  const btnLimpar = document.getElementById("btn-limpar-carrinho");

  if (floatingBtn) floatingBtn.addEventListener("click", abrirCarrinho);
  if (headerCartBtn) headerCartBtn.addEventListener("click", abrirCarrinho);
  if (closeCartBtn) closeCartBtn.addEventListener("click", fecharCarrinho);
  if (continueShoppingBtn) continueShoppingBtn.addEventListener("click", fecharCarrinho);
  if (emptyContinueBtn) {
    emptyContinueBtn.addEventListener("click", () => {
      fecharCarrinho();
      const secCardapio = document.getElementById("cardapio");
      if (secCardapio) secCardapio.scrollIntoView({ behavior: "smooth" });
    });
  }
  if (cartOverlay) cartOverlay.addEventListener("click", fecharCarrinho);

  if (btnLimpar) {
    btnLimpar.addEventListener("click", () => {
      limparCarrinho(false);
    });
  }

  // Fechar carrinho com tecla ESC e fechar menu mobile ao clicar em link
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      fecharCarrinho();
    }
  });

  document.querySelectorAll(".nav__link").forEach((link) => {
    link.addEventListener("click", () => {
      const toggleInput = document.getElementById("menu-toggle");
      if (toggleInput) toggleInput.checked = false;
    });
  });

  // Salvar nome do cliente e observações enquanto digita
  const inputNome = document.getElementById("cliente-nome");
  const inputObs = document.getElementById("pedido-observacoes");
  if (inputNome) {
    inputNome.addEventListener("input", () => {
      inputNome.classList.remove("cart-form__input--error");
      const erroEl = document.getElementById("cart-form-error");
      if (erroEl) erroEl.hidden = true;
      salvarDadosClienteNoStorage();
    });
  }
  if (inputObs) {
    inputObs.addEventListener("input", salvarDadosClienteNoStorage);
  }
}

document.addEventListener("DOMContentLoaded", inicializarCardapioECarrinho);
