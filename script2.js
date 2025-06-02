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
    const exportarExcelBtn = document.getElementById('exportarExcelBtn'); // Novo: Botão de exportar

    let categoriaSelecionada = '';
    let gastos = [];

    // Carregar Gastos do LocalStorage
    function carregarGastos() {
        const gastosSalvos = localStorage.getItem('gastosDiarios');
        if (gastosSalvos) {
            gastos = JSON.parse(gastosSalvos);
        }
    }

    // Salvar Gastos no LocalStorage
    function salvarGastos() {
        localStorage.setItem('gastosDiarios', JSON.stringify(gastos));
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
        if (valorGasto > 0 && categoriaSelecionada) {
            const novoGasto = { categoria: categoriaSelecionada, valor: valorGasto };
            gastos.push(novoGasto);
            salvarGastos();
            atualizarListaGastos();
            atualizarTotais();
            
            // Limpa o input e a seleção de categoria
            valorGastoInput.value = '';
            categoriaSelecionada = '';
            botoesCategoria.forEach(btn => btn.classList.remove('selecionado'));
        } else {
            alert('Por favor, insira um valor válido e selecione uma categoria.');
        }
    });

    function atualizarListaGastos() {
        listaGastos.innerHTML = '';
        gastos.forEach((gasto, index) => {
            const gastoItem = document.createElement('div');
            gastoItem.className = 'gasto-item';
            gastoItem.innerHTML = `
                <span>${gasto.categoria}: R$ <span class="valor">${gasto.valor.toFixed(2)}</span></span>
                <button class="btn-remover" data-index="${index}">Remover</button>
            `;
            listaGastos.appendChild(gastoItem);
        });

        document.querySelectorAll('.btn-remover').forEach(botaoRemover => {
            botaoRemover.addEventListener('click', function() {
                const indexParaRemover = parseInt(this.dataset.index);
                removerGasto(indexParaRemover);
            });
        });
    }

    function removerGasto(index) {
        gastos.splice(index, 1);
        salvarGastos();
        atualizarListaGastos();
        atualizarTotais();
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
            if (totais.hasOwnProperty(gasto.categoria)) {
                totais[gasto.categoria] += gasto.valor;
            } else {
                totais['outros'] += gasto.valor; 
            }
            total += gasto.valor;
        });

        for (let categoria in totaisCategorias) {
            if (totais.hasOwnProperty(categoria)) {
                 totaisCategorias[categoria].textContent = totais[categoria].toFixed(2);
            } else {
                 totaisCategorias[categoria].textContent = '0.00';
            }
        }
        totalGeral.textContent = total.toFixed(2);
    }

    // --- Nova Função: Exportar para Excel ---
    exportarExcelBtn.addEventListener('click', function() {
        // Coleta os dados dos totais por categoria
        const dadosParaExportar = [
            ["Categoria", "Total (R$)"],
            ["Gasolina", parseFloat(totaisCategorias.gasolina.textContent)],
            ["Mercado", parseFloat(totaisCategorias.mercado.textContent)],
            ["Serviços Domésticos", parseFloat(totaisCategorias.servicosDomesticos.textContent)],
            ["Cuidados Pessoais", parseFloat(totaisCategorias.cuidadosPessoais.textContent)],
            ["Passeios", parseFloat(totaisCategorias.passeios.textContent)],
            ["Outros", parseFloat(totaisCategorias.outros.textContent)],
            ["Total Geral", parseFloat(totalGeral.textContent)]
        ];

        // Cria uma nova planilha
        const ws = XLSX.utils.aoa_to_sheet(dadosParaExportar);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Resumo de Gastos");

        // Gera e baixa o arquivo Excel
        XLSX.writeFile(wb, "resumo_gastos_familia.xlsx");
    });
});
