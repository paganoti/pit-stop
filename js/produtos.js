/**
 * CATÁLOGO DE PRODUTOS E CAMADA DE DADOS CENTRALIZADA — PIT STOP BURGER
 * ==========================================================================
 * Estrutura centralizada de produtos, categorias, banners, informações da
 * hamburgueria e pedidos. Sincroniza automaticamente entre o Painel Admin
 * (/admin) e o site público via localStorage.
 */

const STORAGE_KEYS = {
  PRODUTOS: "pitstop_burger_produtos_v1",
  CATEGORIAS: "pitstop_burger_categorias_v1",
  BANNERS: "pitstop_burger_banners_v1",
  INFO: "pitstop_burger_info_v1",
  CLIQUES_WHATSAPP: "pitstop_burger_cliques_whatsapp_v1",
  ADMIN_CREDENCIAIS: "pitstop_burger_admin_cred_v1",
  ADMIN_SESSAO: "pitstop_burger_admin_sessao_v1"
};

// Catálogo original padrão da Pit Stop Burger (19 produtos)
const PRODUTOS_PADRAO = [
  // ========================================================================
  // CATEGORIA: Pit Stop Burgers
  // ========================================================================
  {
    id: 1,
    numero: "Nº 1",
    nome: "Pit Stop House (Nº 1)",
    descricao: "Pão brioche, burg 180g, queijo mussarela e molho especial.",
    preco: 17.90,
    imagem: "",
    categoria: "Pit Stop Burgers",
    categoriaSlug: "pit-stop-burgers",
    destaque: "Clássico Nº 1",
    ativo: true,
    ordem: 1
  },
  {
    id: 2,
    numero: "Nº 2",
    nome: "Pit Stop Mixed (Nº 2)",
    descricao: "Pão brioche, burg 180g, queijo mussarela, bacon, tomate e molho especial.",
    preco: 20.90,
    imagem: "assets/pit-stop-mixed.png",
    categoria: "Pit Stop Burgers",
    categoriaSlug: "pit-stop-burgers",
    destaque: "",
    ativo: true,
    ordem: 2
  },
  {
    id: 3,
    numero: "Nº 3",
    nome: "Pit Stop Cheese (Nº 3)",
    descricao: "Pão brioche, burg 180g, queijo cheddar, cebola roxa, creme cheddar e molho especial.",
    preco: 23.90,
    imagem: "assets/pit-stop-cheese.png",
    categoria: "Pit Stop Burgers",
    categoriaSlug: "pit-stop-burgers",
    destaque: "Mais pedido",
    ativo: true,
    ordem: 3
  },
  {
    id: 4,
    numero: "Nº 4",
    nome: "Pit Stop Americano (Nº 4)",
    descricao: "Pão brioche, burg 180g, queijo mussarela, bacon, ovo, alface americano, tomate, cebola roxa e molho especial.",
    preco: 25.90,
    imagem: "assets/pit-stop-americano.png",
    categoria: "Pit Stop Burgers",
    categoriaSlug: "pit-stop-burgers",
    destaque: "Destaque",
    ativo: true,
    ordem: 4
  },
  {
    id: 5,
    numero: "Nº 5",
    nome: "Pit Stop Double (Nº 5)",
    descricao: "Pão brioche, 2 burg 180g, queijo mussarela, bacon, cebola roxa e molho especial.",
    preco: 32.90,
    imagem: "assets/pit-stop-double.png",
    categoria: "Pit Stop Burgers",
    categoriaSlug: "pit-stop-burgers",
    destaque: "Duplo 360g",
    ativo: true,
    ordem: 5
  },
  {
    id: 6,
    numero: "Nº 6",
    nome: "Pit Stop Big (Nº 6)",
    descricao: "Pão brioche, burg 180g, mix de queijo, bacon, ovo, alface americano, tomate, cebola roxa e molho especial.",
    preco: 34.90,
    imagem: "assets/pit-stop-big.png",
    categoria: "Pit Stop Burgers",
    categoriaSlug: "pit-stop-burgers",
    destaque: "Super Completo",
    ativo: true,
    ordem: 6
  },
  {
    id: 7,
    numero: "Nº 7",
    nome: "Pit Stop Kids (Nº 7)",
    descricao: "Pão brioche, burg 180g e queijo mussarela.",
    preco: 21.90,
    imagem: "assets/pit-stop-kids.png",
    categoria: "Pit Stop Burgers",
    categoriaSlug: "pit-stop-burgers",
    destaque: "",
    ativo: true,
    ordem: 7
  },
  {
    id: 8,
    numero: "Nº 8",
    nome: "Pit Stop Nordestino (Nº 8)",
    descricao: "Pão brioche, burg 180g e ingredientes conforme a receita original do estabelecimento.",
    preco: 24.90,
    imagem: "assets/pit-stop-nordestino.png",
    categoria: "Pit Stop Burgers",
    categoriaSlug: "pit-stop-burgers",
    destaque: "Especial",
    ativo: true,
    ordem: 8
  },
  {
    id: 9,
    numero: "Nº 9",
    nome: "Pit Stop Arretado (Nº 9)",
    descricao: "Ingredientes conforme a receita original do estabelecimento.",
    preco: 25.90,
    imagem: "assets/pit-stop-arretado.png",
    categoria: "Pit Stop Burgers",
    categoriaSlug: "pit-stop-burgers",
    destaque: "Especial",
    ativo: true,
    ordem: 9
  },
  {
    id: 10,
    numero: "Nº 10",
    nome: "Pit Stop Onion (Nº 10)",
    descricao: "Ingredientes conforme a receita original do estabelecimento.",
    preco: 26.90,
    imagem: "",
    categoria: "Pit Stop Burgers",
    categoriaSlug: "pit-stop-burgers",
    destaque: "",
    ativo: true,
    ordem: 10
  },

  // ========================================================================
  // CATEGORIA: Hambúrgueres Tradicionais
  // ========================================================================
  {
    id: 11,
    numero: "",
    nome: "Hambúrguer",
    descricao: "Pão tostado, salada e burg industrial.",
    preco: 9.00,
    imagem: "",
    categoria: "Hambúrgueres Tradicionais",
    categoriaSlug: "hamburgueres-tradicionais",
    destaque: "",
    ativo: true,
    ordem: 11
  },
  {
    id: 12,
    numero: "",
    nome: "X-Burguer",
    descricao: "Pão tostado, queijo, salada e burg industrial.",
    preco: 10.00,
    imagem: "",
    categoria: "Hambúrgueres Tradicionais",
    categoriaSlug: "hamburgueres-tradicionais",
    destaque: "",
    ativo: true,
    ordem: 12
  },
  {
    id: 13,
    numero: "",
    nome: "X-Egg",
    descricao: "Pão tostado, queijo, ovo, salada e burg industrial.",
    preco: 12.00,
    imagem: "",
    categoria: "Hambúrgueres Tradicionais",
    categoriaSlug: "hamburgueres-tradicionais",
    destaque: "",
    ativo: true,
    ordem: 13
  },
  {
    id: 14,
    numero: "",
    nome: "X-Bacon",
    descricao: "Pão tostado, queijo, bacon, salada e burg industrial.",
    preco: 15.00,
    imagem: "",
    categoria: "Hambúrgueres Tradicionais",
    categoriaSlug: "hamburgueres-tradicionais",
    destaque: "Tradicional",
    ativo: true,
    ordem: 14
  },
  {
    id: 15,
    numero: "",
    nome: "X-Frango",
    descricao: "Pão tostado, queijo, frango, salada e burg industrial.",
    preco: 15.00,
    imagem: "",
    categoria: "Hambúrgueres Tradicionais",
    categoriaSlug: "hamburgueres-tradicionais",
    destaque: "",
    ativo: true,
    ordem: 15
  },
  {
    id: 16,
    numero: "",
    nome: "X-Calabresa",
    descricao: "Pão tostado, queijo, calabresa, salada e burg industrial.",
    preco: 13.00,
    imagem: "",
    categoria: "Hambúrgueres Tradicionais",
    categoriaSlug: "hamburgueres-tradicionais",
    destaque: "",
    ativo: true,
    ordem: 16
  },
  {
    id: 17,
    numero: "",
    nome: "X-Tudo",
    descricao: "Pão tostado, queijo, bacon, salsicha, calabresa, ovo, presunto, salada e burg industrial.",
    preco: 21.00,
    imagem: "",
    categoria: "Hambúrgueres Tradicionais",
    categoriaSlug: "hamburgueres-tradicionais",
    destaque: "Completo",
    ativo: true,
    ordem: 17
  },

  // ========================================================================
  // CATEGORIA: Batata Frita
  // ========================================================================
  {
    id: 18,
    numero: "",
    nome: "Batata Frita Pequena",
    descricao: "Porção individual de batata frita.",
    preco: 10.00,
    imagem: "",
    categoria: "Batata Frita",
    categoriaSlug: "batata-frita",
    destaque: "",
    ativo: true,
    ordem: 18
  },
  {
    id: 19,
    numero: "",
    nome: "Batata Frita Grande",
    descricao: "Porção grande de batata frita para compartilhar.",
    preco: 18.00,
    imagem: "",
    categoria: "Batata Frita",
    categoriaSlug: "batata-frita",
    destaque: "Para dividir",
    ativo: true,
    ordem: 19
  }
];

const CATEGORIAS_PADRAO = [
  {
    id: 1,
    nome: "Pit Stop Burgers",
    slug: "pit-stop-burgers",
    subtitulo: "Hambúrgueres artesanais 180g no pão brioche",
    imagem: "",
    ordem: 1,
    ativo: true
  },
  {
    id: 2,
    nome: "Hambúrgueres Tradicionais",
    slug: "hamburgueres-tradicionais",
    subtitulo: "Clássicos tradicionais preparados na chapa",
    imagem: "",
    ordem: 2,
    ativo: true
  },
  {
    id: 3,
    nome: "Batata Frita",
    slug: "batata-frita",
    subtitulo: "Acompanhamento crocante para o seu lanche",
    imagem: "",
    ordem: 3,
    ativo: true
  }
];

const BANNERS_PADRAO = [
  {
    id: 1,
    tipo: "hero",
    tag: "Hamburgueria Artesanal • Since 2019",
    titulo: "Bem-vindo à Pit Stop Burger!",
    subtitulo: "Sua parada obrigatória!",
    texto: "Hambúrgueres artesanais de 180g no pão brioche, lanches tradicionais caprichados e batata frita crocante. Escolha seus favoritos, adicione ao carrinho e envie seu pedido direto para o nosso WhatsApp!",
    textoBotaoPrimario: "Ver Cardápio Completo",
    linkBotaoPrimario: "#cardapio",
    textoBotaoSecundario: "Conheça a Casa",
    linkBotaoSecundario: "#sobre",
    imagem: "assets/logo.png",
    produtoId: null,
    ordem: 1,
    ativo: true
  },
  {
    id: 2,
    tipo: "destaque",
    tag: "Destaque da Pista • Nº 6",
    titulo: "Pit Stop Big (Nº 6)",
    subtitulo: "R$ 34,90",
    texto: "Pão brioche, burg 180g, mix de queijo, bacon, ovo, alface americano, tomate, cebola roxa e molho especial. O gigante da casa para quem tem fome de campeão!",
    textoBotaoPrimario: "+ Adicionar ao Carrinho",
    linkBotaoPrimario: "#cardapio",
    textoBotaoSecundario: "",
    linkBotaoSecundario: "",
    imagem: "assets/pit-stop-big.png",
    produtoId: 6,
    ordem: 2,
    ativo: true
  }
];

const INFO_PADRAO = {
  nome: "Pit Stop Burger",
  subtitulo: "Hamburgueria Artesanal",
  slogan: "Sua parada obrigatória!",
  desde: "2019",
  logo: "assets/logo.png",
  logoEmblema: "assets/logo-emblem.png",
  descricaoSobre:
    "Na Pit Stop Burger, cada lanche é preparado na hora com pão brioche macio, blends suculentos de 180g e o nosso molho especial exclusivo. Nossa cozinha funciona no ritmo de um verdadeiro box de corrida: sincronia, qualidade e agilidade para você fazer a sua parada obrigatória!",
  diferenciais: [
    "Blends artesanais de 180g grelhados na hora",
    "Linha completa de Pit Stop Burgers e Tradicionais",
    "Pedido prático e direto pelo WhatsApp sem burocracia"
  ],
  endereco: "",
  telefone: "",
  whatsapp: "5511999999999",
  instagram: "",
  horarioFuncionamento: "Atendimento rápido e lanches feitos na hora.",
  infoEntrega: "Faça seu pedido online pelo site e envie direto para o nosso WhatsApp.",
  taxaEntrega: 0
};

/**
 * Gera um slug URL-safe a partir de um texto
 * @param {string} texto
 * @returns {string}
 */
function gerarSlug(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Carrega e normaliza a lista de produtos do localStorage (ou retorna o padrão)
 * @returns {Array}
 */
function obterProdutosDoSistema() {
  try {
    const salvo = localStorage.getItem(STORAGE_KEYS.PRODUTOS);
    if (!salvo) {
      return PRODUTOS_PADRAO.map((p) => ({ ...p }));
    }
    const parsed = JSON.parse(salvo);
    if (Array.isArray(parsed)) {
      return parsed
        .map((p, index) => ({
          id: Number(p.id),
          numero: p.numero !== undefined ? String(p.numero) : "",
          nome: String(p.nome || ""),
          descricao: String(p.descricao || ""),
          preco: Number(p.preco) || 0,
          imagem: String(p.imagem || "").replace(/^assets\/images\//, "assets/"),
          categoria: String(p.categoria || ""),
          categoriaSlug: String(p.categoriaSlug || gerarSlug(p.categoria || "")),
          destaque: String(p.destaque || ""),
          ativo: p.ativo !== undefined ? Boolean(p.ativo) : true,
          ordem: p.ordem !== undefined ? Number(p.ordem) : index + 1
        }))
        .sort((a, b) => a.ordem - b.ordem || a.id - b.id);
    }
  } catch (erro) {
    console.error("Erro ao carregar produtos do sistema:", erro);
  }
  return PRODUTOS_PADRAO.map((p) => ({ ...p }));
}

/**
 * Salva a lista de produtos no localStorage e atualiza a referência global `produtos`
 * @param {Array} novaLista
 */
function salvarProdutosDoSistema(novaLista) {
  const normalizados = novaLista
    .map((p, idx) => ({
      id: Number(p.id),
      numero: p.numero !== undefined ? String(p.numero) : "",
      nome: String(p.nome || "").trim(),
      descricao: String(p.descricao || "").trim(),
      preco: Number(Number(p.preco || 0).toFixed(2)),
      imagem: String(p.imagem || "").trim(),
      categoria: String(p.categoria || "").trim(),
      categoriaSlug: String(p.categoriaSlug || gerarSlug(p.categoria || "")).trim(),
      destaque: String(p.destaque || "").trim(),
      ativo: p.ativo !== undefined ? Boolean(p.ativo) : true,
      ordem: p.ordem !== undefined ? Number(p.ordem) : idx + 1
    }))
    .sort((a, b) => a.ordem - b.ordem || a.id - b.id);

  localStorage.setItem(STORAGE_KEYS.PRODUTOS, JSON.stringify(normalizados));
  sincronizarArrayProdutosGlobal();
  return normalizados;
}

/**
 * Carrega a lista de categorias do localStorage (ou retorna o padrão)
 * @returns {Array}
 */
function obterCategoriasDoSistema() {
  try {
    const salvo = localStorage.getItem(STORAGE_KEYS.CATEGORIAS);
    if (!salvo) {
      return CATEGORIAS_PADRAO.map((c) => ({ ...c }));
    }
    const parsed = JSON.parse(salvo);
    if (Array.isArray(parsed)) {
      return parsed
        .map((c, idx) => ({
          id: Number(c.id),
          nome: String(c.nome || ""),
          slug: String(c.slug || gerarSlug(c.nome || "")),
          subtitulo: String(c.subtitulo || ""),
          imagem: String(c.imagem || ""),
          ordem: c.ordem !== undefined ? Number(c.ordem) : idx + 1,
          ativo: c.ativo !== undefined ? Boolean(c.ativo) : true
        }))
        .sort((a, b) => a.ordem - b.ordem || a.id - b.id);
    }
  } catch (erro) {
    console.error("Erro ao carregar categorias do sistema:", erro);
  }
  return CATEGORIAS_PADRAO.map((c) => ({ ...c }));
}

/**
 * Salva a lista de categorias no localStorage
 * @param {Array} novaLista
 */
function salvarCategoriasDoSistema(novaLista) {
  const normalizadas = novaLista
    .map((c, idx) => ({
      id: Number(c.id),
      nome: String(c.nome || "").trim(),
      slug: String(c.slug || gerarSlug(c.nome || "")).trim(),
      subtitulo: String(c.subtitulo || "").trim(),
      imagem: String(c.imagem || "").trim(),
      ordem: c.ordem !== undefined ? Number(c.ordem) : idx + 1,
      ativo: c.ativo !== undefined ? Boolean(c.ativo) : true
    }))
    .sort((a, b) => a.ordem - b.ordem || a.id - b.id);

  localStorage.setItem(STORAGE_KEYS.CATEGORIAS, JSON.stringify(normalizadas));
  return normalizadas;
}

/**
 * Carrega os banners do sistema
 * @returns {Array}
 */
function obterBannersDoSistema() {
  try {
    const salvo = localStorage.getItem(STORAGE_KEYS.BANNERS);
    if (!salvo) {
      return BANNERS_PADRAO.map((b) => ({ ...b }));
    }
    const parsed = JSON.parse(salvo);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
        .map((b, idx) => ({
          id: Number(b.id),
          tipo: String(b.tipo || "promocional"),
          tag: String(b.tag || ""),
          titulo: String(b.titulo || ""),
          subtitulo: String(b.subtitulo || ""),
          texto: String(b.texto || ""),
          textoBotaoPrimario: String(b.textoBotaoPrimario || ""),
          linkBotaoPrimario: String(b.linkBotaoPrimario || "#cardapio"),
          textoBotaoSecundario: String(b.textoBotaoSecundario || ""),
          linkBotaoSecundario: String(b.linkBotaoSecundario || ""),
          imagem: String(b.imagem || "").replace(/^assets\/images\//, "assets/"),
          produtoId: b.produtoId ? Number(b.produtoId) : null,
          ordem: b.ordem !== undefined ? Number(b.ordem) : idx + 1,
          ativo: b.ativo !== undefined ? Boolean(b.ativo) : true
        }))
        .sort((a, b) => a.ordem - b.ordem || a.id - b.id);
    }
  } catch (erro) {
    console.error("Erro ao carregar banners do sistema:", erro);
  }
  return BANNERS_PADRAO.map((b) => ({ ...b }));
}

/**
 * Salva os banners do sistema no localStorage
 * @param {Array} novaLista
 */
function salvarBannersDoSistema(novaLista) {
  const normalizados = novaLista
    .map((b, idx) => ({
      id: Number(b.id),
      tipo: String(b.tipo || "promocional"),
      tag: String(b.tag || "").trim(),
      titulo: String(b.titulo || "").trim(),
      subtitulo: String(b.subtitulo || "").trim(),
      texto: String(b.texto || "").trim(),
      textoBotaoPrimario: String(b.textoBotaoPrimario || "").trim(),
      linkBotaoPrimario: String(b.linkBotaoPrimario || "#cardapio").trim(),
      textoBotaoSecundario: String(b.textoBotaoSecundario || "").trim(),
      linkBotaoSecundario: String(b.linkBotaoSecundario || "").trim(),
      imagem: String(b.imagem || "").trim(),
      produtoId: b.produtoId ? Number(b.produtoId) : null,
      ordem: b.ordem !== undefined ? Number(b.ordem) : idx + 1,
      ativo: b.ativo !== undefined ? Boolean(b.ativo) : true
    }))
    .sort((a, b) => a.ordem - b.ordem || a.id - b.id);

  localStorage.setItem(STORAGE_KEYS.BANNERS, JSON.stringify(normalizados));
  return normalizados;
}

/**
 * Carrega as informações comerciais da hamburgueria
 * @returns {object}
 */
function obterInfoHamburgueria() {
  try {
    const salvo = localStorage.getItem(STORAGE_KEYS.INFO);
    if (!salvo) {
      return { ...INFO_PADRAO, diferenciais: [...INFO_PADRAO.diferenciais] };
    }
    const parsed = JSON.parse(salvo);
    if (parsed && typeof parsed === "object") {
      return {
        ...INFO_PADRAO,
        ...parsed,
        logo: String(parsed.logo || INFO_PADRAO.logo).replace(/^assets\/images\//, "assets/"),
        logoEmblema: String(parsed.logoEmblema || INFO_PADRAO.logoEmblema).replace(/^assets\/images\//, "assets/"),
        taxaEntrega: Number(parsed.taxaEntrega) || 0,
        diferenciais: Array.isArray(parsed.diferenciais)
          ? parsed.diferenciais
          : [...INFO_PADRAO.diferenciais]
      };
    }
  } catch (erro) {
    console.error("Erro ao carregar informações da hamburgueria:", erro);
  }
  return { ...INFO_PADRAO, diferenciais: [...INFO_PADRAO.diferenciais] };
}

/**
 * Salva as informações comerciais da hamburgueria
 * @param {object} novasInfos
 */
function salvarInfoHamburgueria(novasInfos) {
  const atual = obterInfoHamburgueria();
  const atualizado = {
    ...atual,
    ...novasInfos,
    taxaEntrega: Number(Number(novasInfos.taxaEntrega || 0).toFixed(2))
  };
  localStorage.setItem(STORAGE_KEYS.INFO, JSON.stringify(atualizado));
  return atualizado;
}

/**
 * Obtém os dados do contador de cliques no botão "Finalizar Pedido" (redirecionamento ao WhatsApp)
 * @returns {{ totalCliques: number, ultimoCliqueEm: string|null }}
 */
function obterContadorCliquesWhatsApp() {
  try {
    const salvo = localStorage.getItem(STORAGE_KEYS.CLIQUES_WHATSAPP);
    if (!salvo) {
      return { totalCliques: 0, ultimoCliqueEm: null };
    }
    const parsed = JSON.parse(salvo);
    if (typeof parsed === "number") {
      return { totalCliques: Math.max(0, Math.floor(parsed)), ultimoCliqueEm: null };
    }
    if (parsed && typeof parsed === "object") {
      return {
        totalCliques: Math.max(0, Math.floor(Number(parsed.totalCliques) || 0)),
        ultimoCliqueEm: parsed.ultimoCliqueEm ? String(parsed.ultimoCliqueEm) : null
      };
    }
  } catch (erro) {
    console.error("Erro ao carregar contador de cliques do WhatsApp:", erro);
  }
  return { totalCliques: 0, ultimoCliqueEm: null };
}

/**
 * Incrementa o contador quando o cliente clica em "Finalizar Pedido" no carrinho para ir ao WhatsApp
 * @returns {{ totalCliques: number, ultimoCliqueEm: string|null }}
 */
function registrarCliqueFinalizarWhatsApp() {
  try {
    const atual = obterContadorCliquesWhatsApp();
    const atualizado = {
      totalCliques: atual.totalCliques + 1,
      ultimoCliqueEm: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.CLIQUES_WHATSAPP, JSON.stringify(atualizado));
    return atualizado;
  } catch (erro) {
    console.error("Erro ao registrar clique para o WhatsApp:", erro);
    return { totalCliques: 0, ultimoCliqueEm: null };
  }
}

/**
 * Zera o contador de redirecionamentos para o WhatsApp (ação administrativa)
 */
function zerarContadorCliquesWhatsApp() {
  const zerado = { totalCliques: 0, ultimoCliqueEm: null };
  localStorage.setItem(STORAGE_KEYS.CLIQUES_WHATSAPP, JSON.stringify(zerado));
  return zerado;
}

// Mantém a variável global `produtos` sempre sincronizada com o sistema
let produtos = obterProdutosDoSistema();

function sincronizarArrayProdutosGlobal() {
  const atualizados = obterProdutosDoSistema();
  produtos.length = 0;
  atualizados.forEach((item) => produtos.push(item));
}

/**
 * Formata um valor numérico para moeda Real (R$ 0,00)
 * @param {number} valor
 * @returns {string}
 */
function formatarMoeda(valor) {
  return Number(valor || 0)
    .toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    })
    .replace(/\u00A0/g, " ");
}

/**
 * Busca um produto no catálogo oficial pelo ID
 * @param {number|string} id
 * @param {boolean} incluirInativos
 * @returns {object|undefined}
 */
function buscarProdutoPorId(id, incluirInativos = false) {
  sincronizarArrayProdutosGlobal();
  const idNumerico = Number(id);
  const categoriasAtivas = new Set(
    obterCategoriasDoSistema()
      .filter((c) => c.ativo !== false)
      .map((c) => c.slug)
  );
  return produtos.find(
    (item) =>
      item.id === idNumerico &&
      (incluirInativos || (item.ativo !== false && categoriasAtivas.has(item.categoriaSlug)))
  );
}
