document.addEventListener('DOMContentLoaded', function() {
    const valorGastoInput = document.getElementById('valorGasto');
    const botoesCategoria = document.querySelectorAll('.btn-categoria');
    const adicionarBtn = document.getElementById('adicionarBtn');
    const listaGastos = document.getElementById('listaGastos');
    const totaisCategorias = {
        gasolina: document.getElementById('totalGasolina'),
        mercado: document.getElementById('totalMercado'),
        servicosDomesticos: document.getElementById('totalServicosDomesticos'),
        cuidadosPessoais: document.getElementById('totalCuidadosPessoais'),
        passeios: document.getElementById('totalPasseios'),
        outros: document.getElementById('totalOutros')
    };
    const totalGeral = document.getElementById('totalGeral');

    let categoriaSelecionada = '';
    let gastos = []; // Inicializamos a lista de gastos aqui

    // --- Nova Função: Carregar Gastos do LocalStorage ---
    function carregarGastos() {
        const gastosSalvos = localStorage.getItem('gastosDiarios');
        if (gastosSalvos) {
            gastos = JSON.parse(gastosSalvos); // Converte a string de volta para array de objetos
        }
    }

    // --- Nova Função: Salvar Gastos no LocalStorage ---
    function salvarGastos() {
        localStorage.setItem('gastosDiarios', JSON.stringify(gastos)); // Converte o array para string e salva
    }

    // Carrega os gastos assim que a página é carregada
    carregarGastos();
    // Atualiza a exibição com os gastos carregados
    atualizarListaGastos();
    atualizarTotais();

    botoesCategoria.forEach(botao => {
        botao.addEventListener('click', function() {
            // Remove a classe 'selecionado' de todos os botões
            botoesCategoria.forEach(btn => btn.classList.remove('selecionado'));
            // Adiciona a classe 'selecionado' apenas ao botão clicado
            this.classList.add('selecionado');
            categoriaSelecionada = this.dataset.categoria;
        });
    });

    adicionarBtn.addEventListener('click', function() {
        const valorGasto = parseFloat(valorGastoInput.value);
        if (valorGasto > 0 && categoriaSelecionada) { // Verifica se o valor é positivo
            const novoGasto = { categoria: categoriaSelecionada, valor: valorGasto };
            gastos.push(novoGasto);
            salvarGastos(); // Salva os gastos após adicionar um novo
            atualizarListaGastos();
            atualizarTotais();
            
            // Limpa o input e a seleção de categoria
            valorGastoInput.value = '';
            categoriaSelecionada = '';
            botoesCategoria.forEach(btn => btn.classList.remove('selecionado')); // Remove seleção
        } else {
            alert('Por favor, insira um valor válido e selecione uma categoria.');
        }
    });

    function atualizarListaGastos() {
        listaGastos.innerHTML = '';
        gastos.forEach((gasto, index) => { // Adicionamos 'index' para identificar o item
            const gastoItem = document.createElement('div');
            gastoItem.className = 'gasto-item';
            gastoItem.innerHTML = `
                <span>${gasto.categoria}: R$ <span class="valor">${gasto.valor.toFixed(2)}</span></span>
                <button class="btn-remover" data-index="${index}">Remover</button>
            `;
            listaGastos.appendChild(gastoItem);
        });

        // Adiciona evento de clique para os botões de remover
        document.querySelectorAll('.btn-remover').forEach(botaoRemover => {
            botaoRemover.addEventListener('click', function() {
                const indexParaRemover = parseInt(this.dataset.index);
                removerGasto(indexParaRemover);
            });
        });
    }

    function removerGasto(index) {
        gastos.splice(index, 1); // Remove o gasto do array
        salvarGastos(); // Salva os gastos atualizados
        atualizarListaGastos(); // Atualiza a lista na tela
        atualizarTotais(); // Atualiza os totais
    }

    function atualizarTotais() {
        const totais = {
            gasolina: 0,
            mercado: 0,
            servicosDomesticos: 0,
            cuidadosPessoais: 0,
            passeios: 0,
            outros: 0
        };
        let total = 0;

        gastos.forEach(gasto => {
            if (totais.hasOwnProperty(gasto.categoria)) { // Garante que a categoria existe nos totais
                totais[gasto.categoria] += gasto.valor;
            } else {
                // Se a categoria não estiver mapeada, joga para 'outros' ou ignora (decisão de design)
                totais['outros'] += gasto.valor; 
            }
            total += gasto.valor;
        });

        for (let categoria in totaisCategorias) { // Itera pelos elementos HTML de totais
            if (totais.hasOwnProperty(categoria)) { // Verifica se a categoria existe nos totais calculados
                 totaisCategorias[categoria].textContent = totais[categoria].toFixed(2);
            } else {
                 totaisCategorias[categoria].textContent = '0.00'; // Caso a categoria não tenha gastos
            }
        }
        totalGeral.textContent = total.toFixed(2);
    }
});