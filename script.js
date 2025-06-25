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
    const exportarExcelBtn = document.getElementById('exportarExcelBtn');

    let categoriaSelecionada = '';
    let gastos = [];

    function carregarGastos() {
        const gastosSalvos = localStorage.getItem('gastosDiarios');
        if (gastosSalvos) {
            gastos = JSON.parse(gastosSalvos);
        }
    }

    function salvarGastos() {
        localStorage.setItem('gastosDiarios', JSON.stringify(gastos));
    }

    carregarGastos();
    atualizarListaGastos();
    atualizarTotais();

    botoesCategoria.forEach(botao => {
        botao.addEventListener('click', function() {
            botoesCategoria.forEach(btn => btn.classList.remove('selecionado'));
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

            valorGastoInput.value = '';
            categoriaSelecionada = '';
            botoesCategoria.forEach(btn => btn.classList.remove('selecionado'));
        } else {
            let mensagemErro = '';
            if (!(valorGasto > 0)) { // valorGastoInput.value pode ser string vazia ou não número, resultando em NaN ou 0 para parseFloat.
                mensagemErro += 'Por favor, insira um valor monetário válido.\n';
            }
            if (!categoriaSelecionada) {
                mensagemErro += 'Por favor, selecione uma categoria.\n';
            }
            alert(mensagemErro.trim());
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

        for (let categoriaKey in totaisCategorias) {
            // MODIFICAÇÃO AQUI:
            // Garante que totais[categoriaKey] seja um número antes de chamar toFixed()
            // e define como '0.00' caso contrário ou se a categoria não tiver gastos.
            if (totais.hasOwnProperty(categoriaKey) && typeof totais[categoriaKey] === 'number') {
                 totaisCategorias[categoriaKey].textContent = totais[categoriaKey].toFixed(2);
            } else {
                 totaisCategorias[categoriaKey].textContent = '0.00';
            }
        }
        totalGeral.textContent = total.toFixed(2);
    }

    exportarExcelBtn.addEventListener('click', function() {
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

        const ws = XLSX.utils.aoa_to_sheet(dadosParaExportar);

        ws['!cols'] = [
            { wch: 20 },
            { wch: 15 }
        ];

        if (ws['A1']) {
            ws['A1'].s = { font: { bold: true } };
        }
        if (ws['B1']) {
            ws['B1'].s = { font: { bold: true } };
        }

        const lastRowIndex = dadosParaExportar.length;
        const totalGeralCellA = XLSX.utils.encode_cell({ r: lastRowIndex - 1, c: 0 });
        const totalGeralCellB = XLSX.utils.encode_cell({ r: lastRowIndex - 1, c: 1 });

        if (ws[totalGeralCellA]) {
            ws[totalGeralCellA].s = { font: { bold: true } };
        }
        if (ws[totalGeralCellB]) {
            ws[totalGeralCellB].s = { font: { bold: true } };
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Resumo de Gastos");
        XLSX.writeFile(wb, "resumo_gastos_familia.xlsx");
    });
});
