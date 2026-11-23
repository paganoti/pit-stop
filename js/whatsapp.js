/**
 * INTEGRAÇÃO COM WHATSAPP — PIT STOP BURGER
 * ==========================================================================
 * Monta dinamicamente a mensagem com todos os itens, quantidades, subtotais,
 * valor total, nome do cliente e observações, incrementa o contador de
 * redirecionamentos para o WhatsApp e abre a conversa oficial.
 */

// Número padrão de fallback caso não tenha sido alterado no painel administrativo
const WHATSAPP_NUMBER = "5511999999999";

/**
 * Obtém o número de WhatsApp configurado nas informações da hamburgueria
 * @returns {string}
 */
function obterNumeroWhatsAppOficial() {
  if (typeof obterInfoHamburgueria === "function") {
    const info = obterInfoHamburgueria();
    const limpo = String(info.whatsapp || "").replace(/\D/g, "");
    if (limpo.length >= 10) {
      return limpo;
    }
  }
  return WHATSAPP_NUMBER;
}

/**
 * Monta o texto da mensagem do pedido a partir dos itens do carrinho e dados do cliente
 * @param {Array} itensDetalhados
 * @param {number} valorTotal
 * @param {string} nomeCliente
 * @param {string} observacoes
 * @returns {string}
 */
function montarMensagemWhatsApp(itensDetalhados, valorTotal, nomeCliente, observacoes) {
  const info = typeof obterInfoHamburgueria === "function"
    ? obterInfoHamburgueria()
    : { nome: "Pit Stop Burger", taxaEntrega: 0 };

  const linhas = [
    `Olá! Gostaria de fazer um pedido na ${info.nome || "Pit Stop Burger"}! 🍔`,
    "",
    "*MEU PEDIDO:*",
    ""
  ];

  itensDetalhados.forEach((item) => {
    linhas.push(`${item.quantidade}x ${item.nome}`);
    linhas.push(`Valor: ${formatarMoeda(item.subtotal)}`);
    linhas.push("");
  });

  linhas.push("--------------------------");

  const taxaEntrega = Number(info.taxaEntrega) || 0;
  if (taxaEntrega > 0) {
    linhas.push(`Taxa de Entrega: ${formatarMoeda(taxaEntrega)}`);
  }

  linhas.push("");
  linhas.push(`*TOTAL: ${formatarMoeda(valorTotal)}*`);
  linhas.push("");

  if (nomeCliente && nomeCliente.trim() !== "") {
    linhas.push(`*Cliente:* ${nomeCliente.trim()}`);
  }

  if (observacoes && observacoes.trim() !== "") {
    linhas.push(`*Observações:* ${observacoes.trim()}`);
  }

  if ((nomeCliente && nomeCliente.trim() !== "") || (observacoes && observacoes.trim() !== "")) {
    linhas.push("");
  }

  linhas.push("Aguardo a confirmação do meu pedido!");

  return linhas.join("\n");
}

/**
 * Valida o pedido, incrementa o contador de cliques para o WhatsApp no painel admin,
 * monta a URL do WhatsApp, abre em nova aba e limpa o carrinho.
 */
function finalizarPedidoWhatsApp() {
  const itensDetalhados = obterItensDetalhadosCarrinho();
  if (itensDetalhados.length === 0) {
    mostrarNotificacao("Adicione pelo menos um produto ao carrinho antes de finalizar.", "error");
    return;
  }

  const inputNome = document.getElementById("cliente-nome");
  const inputObs = document.getElementById("pedido-observacoes");
  const erroEl = document.getElementById("cart-form-error");

  const nomeCliente = inputNome ? inputNome.value.trim() : "";
  const observacoes = inputObs ? inputObs.value.trim() : "";

  if (!nomeCliente) {
    if (erroEl) {
      erroEl.textContent = "Por favor, informe o seu nome para identificar o pedido no WhatsApp.";
      erroEl.hidden = false;
    }
    if (inputNome) {
      inputNome.classList.add("cart-form__input--error");
      inputNome.focus();
    }
    mostrarNotificacao("Informe seu nome antes de enviar o pedido.", "error");
    return;
  }

  if (erroEl) erroEl.hidden = true;
  if (inputNome) inputNome.classList.remove("cart-form__input--error");

  const valorTotal = calcularTotalCarrinho();
  const mensagem = montarMensagemWhatsApp(itensDetalhados, valorTotal, nomeCliente, observacoes);

  // Incrementa o contador de cliques no botão "Finalizar Pedido" (exibido no Dashboard do Admin)
  if (typeof registrarCliqueFinalizarWhatsApp === "function") {
    registrarCliqueFinalizarWhatsApp();
  }

  const numeroWhats = obterNumeroWhatsAppOficial();
  const url = `https://wa.me/${numeroWhats}?text=${encodeURIComponent(mensagem)}`;

  window.open(url, "_blank");

  // Limpa o carrinho após concluir o redirecionamento para o WhatsApp
  limparCarrinhoAposPedido();
  fecharCarrinho();
  mostrarNotificacao("Redirecionando para o WhatsApp para envio do seu pedido!");
}

document.addEventListener("DOMContentLoaded", () => {
  const btnFinalizar = document.getElementById("btn-finalizar-pedido");
  if (btnFinalizar) {
    btnFinalizar.addEventListener("click", finalizarPedidoWhatsApp);
  }
});
