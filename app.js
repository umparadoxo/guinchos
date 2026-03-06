// ============================================
// CONFIGURAÇÃO SUPABASE
// ============================================
const SUPABASE_URL = 'https://zonbdgbsjdqnlmtaszdg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvbmJkZ2JzamRxbmxtdGFzemRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMjY5NTksImV4cCI6MjA4NTcwMjk1OX0.99u9VaALZBEFY0Fe4AiqWjY79MlzdacoVPHQX8SxPbM';

let supabase = null;
let registros = [];
let editMode = false;
let filtroDatas = { inicio: '', fim: '' };
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let currentUser = null;
let currentFiles = [];

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ============================================
// MODAL DE CONFIRMAÇÃO
// ============================================
let confirmCallback = null;

function showConfirmModal(title, message, onConfirm) {
    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalMessage').textContent = message;
    document.getElementById('confirmModal').classList.add('active');
    confirmCallback = onConfirm;
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('active');
    confirmCallback = null;
}

function executeConfirm() {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
}

// ============================================
// MODAL DE HISTÓRICO
// ============================================
function showHistoryModal(placa) {
    const historico = registros.filter(r => r.placa.toUpperCase() === placa.toUpperCase());
    const container = document.getElementById('historyList');

    document.getElementById('historyModalPlaca').textContent = placa;

    if (historico.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Nenhum registro encontrado para esta placa.</p></div>';
    } else {
        container.innerHTML = historico.map(r => `
            <div class="history-item">
                <div>
                    <div class="history-date"><i class="fas fa-calendar-alt"></i> ${formatData(r.dataHora)}</div>
                    <div class="history-details">${r.tipoPane} - ${r.consultor}</div>
                </div>
                <span class="badge badge-primary">${r.tipoGuincho}</span>
            </div>
        `).join('');
    }

    document.getElementById('historyModal').classList.add('active');
}

function closeHistoryModal() {
    document.getElementById('historyModal').classList.remove('active');
}

// ============================================
// MODAL DE DETALHES
// ============================================
function showDetailModal(id) {
    const r = registros.find(x => x.id == id);
    if (!r) return;

    document.getElementById('detailModalPlaca').textContent = r.placa;

    const paneTxt = r.tipoPane === 'Retorno' ? `Retorno (OS: ${r.numeroOS})` : r.tipoPane;
    const zap = r.telefoneProprietario ? `https://wa.me/55${r.telefoneProprietario.replace(/\D/g, '')}` : null;
    const zapGuincheiro = r.telefoneGuincheiro ? `https://wa.me/55${r.telefoneGuincheiro.replace(/\D/g, '')}` : null;

    const content = document.getElementById('detailContent');

    // Separar fotos de documentos
    let fotosHtml = '';
    let docsHtml = '';
    if (r.fotos && r.fotos.length > 0) {
        const imagens = r.fotos.filter(url => url.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp)/i));
        const documentos = r.fotos.filter(url => !url.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp)/i));

        if (imagens.length > 0) {
            fotosHtml = `
            <div class="detail-section">
                <div class="detail-section-title"><i class="fas fa-camera"></i> Fotos Anexadas</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(80px, 1fr));gap:0.5rem;margin-top:0.5rem">
                    ${imagens.map(url => `<a href="${url}" target="_blank"><img src="${url}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:0.5rem;border:1px solid var(--gray-200)"></a>`).join('')}
                </div>
            </div>`;
        }

        if (documentos.length > 0) {
            docsHtml = `
            <div class="detail-section">
                <div class="detail-section-title"><i class="fas fa-file-alt"></i> Arquivos Anexados</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(80px, 1fr));gap:0.5rem;margin-top:0.5rem">
                    ${documentos.map(url => {
                let fileName = url.split('/').pop().split('?')[0];
                if (fileName.includes('_')) {
                    const parts = fileName.split('_');
                    if (parts.length > 1) {
                        fileName = "Doc " + parts[parts.length - 1];
                    }
                }
                let iconClass = 'fa-file-alt';
                if (fileName.toLowerCase().endsWith('.pdf')) iconClass = 'fa-file-pdf';
                else if (fileName.toLowerCase().endsWith('.doc') || fileName.toLowerCase().endsWith('.docx')) iconClass = 'fa-file-word';

                return `<a href="${url}" target="_blank" style="text-decoration:none">
                            <div class="doc-preview" style="border-radius:0.5rem;border:1px solid var(--gray-200);aspect-ratio:1;width:100%;height:100%;box-sizing:border-box">
                                <i class="fas ${iconClass}"></i>
                                <span class="doc-name" style="line-clamp: 2;">${fileName}</span>
                            </div>
                        </a>`;
            }).join('')}
                </div>
            </div>`;
        }
    }

    content.innerHTML = `
        <div class="detail-section">
            <div class="detail-section-title"><i class="fas fa-car"></i> Veículo</div>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Placa</div>
                    <div class="detail-value highlight">${r.placa}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Modelo</div>
                    <div class="detail-value">${r.modelo || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Marca</div>
                    <div class="detail-value">${r.marca || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Data de Chegada</div>
                    <div class="detail-value">${formatData(r.dataHora)}</div>
                </div>
            </div>
        </div>
        
        ${fotosHtml}
        ${docsHtml}

        <div class="detail-section">
            <div class="detail-section-title"><i class="fas fa-user"></i> Proprietário</div>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Nome</div>
                    <div class="detail-value">${r.nomeProprietario}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">WhatsApp</div>
                    <div class="detail-value">
                        ${zap ? `<a href="${zap}" target="_blank"><i class="fab fa-whatsapp"></i> ${r.telefoneProprietario}</a>` : (r.telefoneProprietario || '-')}
                    </div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <div class="detail-section-title"><i class="fas fa-tools"></i> Atendimento</div>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Consultor Técnico</div>
                    <div class="detail-value">${r.consultor}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Tipo de Guincho</div>
                    <div class="detail-value">${r.tipoGuincho || '-'}</div>
                </div>
                <div class="detail-item full-width">
                    <div class="detail-label">Motivo/Pane</div>
                    <div class="detail-value">${paneTxt}</div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <div class="detail-section-title"><i class="fas fa-truck-pickup"></i> Guincheiro</div>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Nome</div>
                    <div class="detail-value">${r.nomeGuincheiro || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Telefone</div>
                    <div class="detail-value">
                        ${zapGuincheiro ? `<a href="${zapGuincheiro}" target="_blank"><i class="fab fa-whatsapp"></i> ${r.telefoneGuincheiro}</a>` : (r.telefoneGuincheiro || '-')}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Metadados de criação/alteração
    const metaInfo = document.getElementById('detailMetaInfo');
    let metaHtml = '';

    if (r.createdBy || r.createdAt) {
        const createdAtFormatted = r.createdAt ? formatDataHora(r.createdAt) : 'Data não registrada';
        metaHtml += `
            <div class="detail-meta-row">
                <i class="fas fa-plus-circle"></i>
                <span>Criado por <strong>${r.createdBy || 'Não registrado'}</strong> em ${createdAtFormatted}</span>
            </div>
        `;
    }

    if (r.updatedBy || r.updatedAt) {
        const updatedAtFormatted = r.updatedAt ? formatDataHora(r.updatedAt) : 'Data não registrada';
        metaHtml += `
            <div class="detail-meta-row">
                <i class="fas fa-edit"></i>
                <span>Última alteração por <strong>${r.updatedBy || 'Não registrado'}</strong> em ${updatedAtFormatted}</span>
            </div>
        `;
    }

    if (!metaHtml) {
        metaHtml = `
            <div class="detail-meta-row">
                <i class="fas fa-info-circle"></i>
                <span>Informações de criação/alteração não disponíveis</span>
            </div>
        `;
    }

    metaInfo.innerHTML = metaHtml;

    document.getElementById('detailModal').classList.add('active');
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('active');
}

function formatDataHora(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const ano = date.getFullYear();
    const hora = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} às ${hora}:${min}`;
}

// ============================================
// LOADING
// ============================================
function mostrarLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

// ============================================
// GESTÃO DE VIEWS (TELAS INTERNAS)
// ============================================
function toggleFormView(show) {
    const formView = document.getElementById('formView');
    const listView = document.getElementById('listView');
    if (show) {
        formView.classList.remove('hidden');
        listView.classList.add('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        formView.classList.add('hidden');
        listView.classList.remove('hidden');
        resetForm(); // Limpa e recarrega na hora de voltar
    }
}

// ============================================
// AUTENTICAÇÃO
// ============================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

async function initSupabase() {
    const { createClient } = window.supabase;
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Carregar email salvo
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
        document.getElementById('loginEmail').value = savedEmail;
        document.getElementById('rememberUser').checked = true;
    }

    // Verificar sessao existente
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        await enterApp();
    } else {
        mostrarLoading(false);
        showScreen('loginScreen');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const rememberUser = document.getElementById('rememberUser').checked;

    if (!validateEmail(email)) {
        showFieldError('loginEmail', 'Email invalido');
        return;
    }

    mostrarLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        mostrarLoading(false);
        showToast('Email ou senha incorretos', 'error');
        return;
    }

    // Salvar ou remover email do localStorage
    if (rememberUser) {
        localStorage.setItem('rememberedEmail', email);
    } else {
        localStorage.removeItem('rememberedEmail');
    }

    currentUser = data.user;
    await enterApp();
}

async function handleRegister(e) {
    e.preventDefault();
    const nome = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    // Validações
    let valid = true;
    if (!nome) { showFieldError('registerName', 'Nome é obrigatório'); valid = false; }
    if (!validateEmail(email)) { showFieldError('registerEmail', 'Email inválido'); valid = false; }
    if (password.length < 6) { showFieldError('registerPassword', 'Mínimo 6 caracteres'); valid = false; }
    if (password !== confirmPassword) { showFieldError('registerConfirmPassword', 'Senhas não conferem'); valid = false; }

    if (!valid) return;

    mostrarLoading(true);
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nome } }
    });

    if (error) {
        mostrarLoading(false);
        showToast(error.message, 'error');
        return;
    }

    mostrarLoading(false);
    showToast('Conta criada! Verifique seu email para confirmar.', 'success');
    showScreen('loginScreen');
}

async function handleLogout() {
    await supabase.auth.signOut();
    currentUser = null;
    showScreen('loginScreen');
    showToast('Você saiu do sistema', 'info');
}

async function enterApp() {
    showScreen('appScreen');
    document.getElementById('userName').textContent = currentUser.user_metadata?.nome || currentUser.email.split('@')[0];
    document.getElementById('userInitial').textContent = (currentUser.user_metadata?.nome || currentUser.email)[0].toUpperCase();
    await carregarRegistros();
    resetForm();
    mostrarLoading(false);
}

// ============================================
// EDITAR NOME DO USUARIO
// ============================================
function showEditNameModal() {
    document.getElementById('userDropdown').classList.remove('active');
    const currentName = currentUser.user_metadata?.nome || '';
    document.getElementById('editNameInput').value = currentName;
    document.getElementById('editNameModal').classList.add('active');
    document.getElementById('editNameInput').focus();
}

function closeEditNameModal() {
    document.getElementById('editNameModal').classList.remove('active');
}

async function saveNewName() {
    const newName = document.getElementById('editNameInput').value.trim();

    if (!newName) {
        showToast('Digite um nome valido', 'error');
        return;
    }

    mostrarLoading(true);
    try {
        const { data, error } = await supabase.auth.updateUser({
            data: { nome: newName }
        });

        if (error) throw error;

        currentUser = data.user;
        document.getElementById('userName').textContent = newName;
        document.getElementById('userInitial').textContent = newName[0].toUpperCase();

        closeEditNameModal();
        showToast('Nome atualizado com sucesso!', 'success');
    } catch (err) {
        showToast('Erro ao atualizar nome: ' + err.message, 'error');
    } finally {
        mostrarLoading(false);
    }
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    field.classList.add('error');
    const errorEl = field.nextElementSibling;
    if (errorEl && errorEl.classList.contains('error-message')) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
}

function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    field.classList.remove('error');
    const errorEl = field.nextElementSibling;
    if (errorEl && errorEl.classList.contains('error-message')) {
        errorEl.style.display = 'none';
    }
}

// ============================================
// DADOS - CARREGAMENTO DO SUPABASE
// ============================================
async function carregarRegistros(page = 1) {
    console.log('📥 carregarRegistros chamado - Página:', page);
    mostrarLoading(true);
    currentPage = page;

    try {
        // Calcular paginação
        const from = (page - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        console.log('📊 Buscando registros:', { from, to, page });

        // Construir query base
        let query = supabase
            .from('guinchos')
            .select('*', { count: 'exact' });

        // Aplicar filtros de data
        if (filtroDatas.inicio) {
            query = query.gte('data_hora', filtroDatas.inicio);
        }
        if (filtroDatas.fim) {
            query = query.lte('data_hora', filtroDatas.fim);
        }

        // Aplicar busca textual
        const termoBusca = document.getElementById('buscaInteligente')?.value.trim();
        if (termoBusca) {
            const term = `%${termoBusca}%`;
            query = query.or(`placa.ilike.${term},nome_proprietario.ilike.${term},modelo.ilike.${term},consultor.ilike.${term}`);
        }

        // Ordenar por data e hora (mais recentes primeiro) e paginar
        query = query
            .order('data_hora', { ascending: false })
            .order('created_at', { ascending: false })
            .range(from, to);

        // Executar query
        const { data, error, count } = await query;

        console.log('📦 Dados recebidos do Supabase:', {
            total: count,
            registrosNaPagina: data?.length,
            primeiroId: data?.[0]?.id
        });

        if (error) {
            console.error('Erro Supabase:', error);
            throw new Error(error.message);
        }

        // Mapear dados para formato interno
        registros = (data || []).map(item => ({
            id: item.id,
            dataHora: item.data_hora,
            nomeProprietario: item.nome_proprietario || 'N/A',
            telefoneProprietario: item.telefone_proprietario || '',
            placa: item.placa || '',
            marca: item.marca || '',
            modelo: item.modelo || '',
            tipoGuincho: item.tipo_guincho || '',
            tipoPane: item.tipo_pane || '',
            numeroOS: item.numero_os || '',
            consultor: item.consultor || '',
            nomeGuincheiro: item.nome_guincheiro || '',
            telefoneGuincheiro: item.telefone_guincheiro || '',
            fotos: item.fotos || [],
            createdBy: item.created_by || null,
            createdAt: item.created_at || null,
            updatedBy: item.updated_by || null,
            updatedAt: item.updated_at || null
        }));

        // Atualizar interface
        renderizarTabela(count || 0);

    } catch (err) {
        console.error('Erro ao carregar registros:', err);
        showToast('Erro ao carregar dados: ' + err.message, 'error');
        registros = [];
        renderizarTabela(0);
    } finally {
        mostrarLoading(false);
    }
}

// ============================================
// FILTROS E BUSCA
// ============================================
function atualizarIndicadorFiltros() {
    const termoBusca = document.getElementById('buscaInteligente')?.value.trim() || '';
    const di = filtroDatas.inicio;
    const df = filtroDatas.fim;

    const indicator = document.getElementById('filterActiveIndicator');
    const textEl = document.getElementById('filterActiveText');

    if (!indicator || !textEl) return;

    const filtrosAtivos = [];
    if (termoBusca) filtrosAtivos.push(`Busca: "${termoBusca}"`);
    if (di) filtrosAtivos.push(`De: ${formatData(di)}`);
    if (df) filtrosAtivos.push(`Até: ${formatData(df)}`);

    if (filtrosAtivos.length > 0) {
        textEl.textContent = filtrosAtivos.join(' | ');
        indicator.style.display = 'flex';
    } else {
        indicator.style.display = 'none';
    }
}

// ============================================
// RENDERIZAÇÃO DA TABELA
// ============================================
function renderizarTabela(totalCount) {
    const tbody = document.getElementById('tableBody');
    const mobileCards = document.getElementById('mobileCards');
    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

    // Limpar conteúdo anterior
    tbody.innerHTML = '';
    mobileCards.innerHTML = '';

    // Atualizar contador
    document.getElementById('counter').innerText = `${totalCount} Veículo${totalCount !== 1 ? 's' : ''}`;

    // Atualizar indicador de filtros
    atualizarIndicadorFiltros();

    // Mostrar estado vazio se não houver dados
    const emptyState = document.getElementById('emptyState');
    if (registros.length === 0) {
        emptyState.style.display = 'block';
        renderPagination(totalCount, totalPages);
        return;
    }
    emptyState.style.display = 'none';

    // Renderizar registros
    let lastDate = null;

    registros.forEach(registro => {
        // Adicionar separador de data se mudou
        if (registro.dataHora !== lastDate) {
            tbody.innerHTML += criarSeparadorData(registro.dataHora);
            lastDate = registro.dataHora;
        }

        // Adicionar linha da tabela (desktop)
        tbody.innerHTML += criarLinhaTabela(registro);

        // Adicionar card (mobile)
        mobileCards.innerHTML += criarCardMobile(registro);
    });

    // Renderizar paginação
    renderPagination(totalCount, totalPages);
}

// Criar separador de data
function criarSeparadorData(dataHora) {
    return `
        <tr class="date-group">
            <td colspan="6">
                <i class="fas fa-calendar-day"></i> ${formatDataCurta(dataHora)}
            </td>
        </tr>`;
}

// Criar linha da tabela (desktop)
function criarLinhaTabela(r) {
    const paneTxt = r.tipoPane === 'Retorno' ? `Retorno (OS: ${r.numeroOS})` : r.tipoPane;
    const zapProprietario = r.telefoneProprietario
        ? `https://wa.me/55${r.telefoneProprietario.replace(/\D/g, '')}`
        : null;
    const zapGuincheiro = r.telefoneGuincheiro
        ? `https://wa.me/55${r.telefoneGuincheiro.replace(/\D/g, '')}`
        : null;

    const horaEntrada = r.createdAt ? new Date(r.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

    return `
        <tr onclick="showDetailModal('${r.id}')" style="cursor: pointer;">
            <td>
                <div style="font-weight:600">${r.nomeProprietario}</div>
                ${zapProprietario ? `<a href="${zapProprietario}" target="_blank" class="whatsapp-link" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i> Contato</a>` : ''}
            </td>
            <td>
                <div style="display:flex; align-items:center; gap:0.5rem">
                    <div style="font-weight:700;color:var(--primary-600)">${r.placa}</div>
                    ${horaEntrada ? `<div style="font-size:0.75rem;color:var(--gray-500)"><i class="far fa-clock"></i> ${horaEntrada}</div>` : ''}
                </div>
                <div style="font-size:0.75rem;color:var(--gray-500)">${r.modelo}</div>
            </td>
            <td><span class="badge badge-warning">${paneTxt}</span></td>
            <td>${r.consultor}</td>
            <td>
                <div>${r.nomeGuincheiro || '-'}</div>
                ${zapGuincheiro ? `<a href="${zapGuincheiro}" target="_blank" class="whatsapp-link" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i> Contato</a>` : ''}
            </td>
            <td>
                <div class="action-btns">
                    <button class="action-btn history" onclick="event.stopPropagation(); showHistoryModal('${r.placa}')" title="Histórico">
                        <i class="fas fa-history"></i>
                    </button>
                    <button class="action-btn edit" onclick="event.stopPropagation(); editarRegistro('${r.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="event.stopPropagation(); confirmarExclusao('${r.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
}

// Criar card mobile
function criarCardMobile(r) {
    const zapGuincheiro = r.telefoneGuincheiro
        ? `https://wa.me/55${r.telefoneGuincheiro.replace(/\D/g, '')}`
        : null;

    const horaEntrada = r.createdAt ? new Date(r.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

    return `
        <div class="vehicle-card" onclick="showDetailModal('${r.id}')" style="cursor: pointer;">
            <div class="vehicle-card-header">
                <span class="vehicle-card-plate">${r.placa}</span>
                <div style="display:flex; gap:0.5rem; align-items:center;">
                    ${horaEntrada ? `<span class="badge" style="background:var(--gray-100);color:var(--gray-600)"><i class="far fa-clock"></i> ${horaEntrada}</span>` : ''}
                    <span class="badge badge-primary">${formatDataCurta(r.dataHora)}</span>
                </div>
            </div>
            <div class="vehicle-card-row">
                <span class="vehicle-card-label">Proprietário</span>
                <span>${r.nomeProprietario}</span>
            </div>
            <div class="vehicle-card-row">
                <span class="vehicle-card-label">Modelo</span>
                <span>${r.modelo}</span>
            </div>
            <div class="vehicle-card-row">
                <span class="vehicle-card-label">Consultor</span>
                <span>${r.consultor}</span>
            </div>
            <div class="vehicle-card-row">
                <span class="vehicle-card-label">Guincheiro</span>
                <span>
                    ${r.nomeGuincheiro || '-'} 
                    ${zapGuincheiro ? `<a href="${zapGuincheiro}" target="_blank" class="whatsapp-link" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i></a>` : ''}
                </span>
            </div>
            <div class="vehicle-card-actions" onclick="event.stopPropagation()">
                <button class="btn btn-outline btn-sm" onclick="showHistoryModal('${r.placa}')">
                    <i class="fas fa-history"></i> <span class="mobile-btn-text">Histórico</span>
                </button>
                <button class="btn btn-outline btn-sm" onclick="editarRegistro('${r.id}')">
                    <i class="fas fa-edit"></i> <span class="mobile-btn-text">Editar</span>
                </button>
                <button class="btn btn-danger btn-sm" onclick="confirmarExclusao('${r.id}')">
                    <i class="fas fa-trash"></i> <span class="mobile-btn-text">Excluir</span>
                </button>
            </div>
        </div>`;
}

function renderPagination(total, totalPages) {
    const container = document.getElementById('pagination');
    if (total <= ITEMS_PER_PAGE && totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `
        <button onclick="carregarRegistros(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>
    `;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `<button class="${i === currentPage ? 'active' : ''}" onclick="carregarRegistros(${i})">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span style="padding:0 0.5rem">...</span>`;
        }
    }

    html += `
        <button onclick="carregarRegistros(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>
        <span class="pagination-info">${total} registros</span>
    `;

    container.innerHTML = html;
}

function goToPage(page) {
    // Deprecated for direct call to carregarRegistros via pagination render
    carregarRegistros(page);
}

// ============================================
// CRUD OPERATIONS
// ============================================
async function confirmarExclusao(id) {
    // Normalizar ID para string para comparação consistente
    const idStr = String(id);
    const registro = registros.find(r => String(r.id) === idStr);

    if (!registro) {
        console.error('Registro não encontrado:', id);
        showToast('Registro não encontrado', 'error');
        return;
    }

    showConfirmModal(
        'Excluir Registro',
        `Deseja realmente excluir o veículo ${registro.placa}? Esta ação não pode ser desfeita.`,
        () => removerRegistro(id)
    );
}

async function removerRegistro(id) {
    mostrarLoading(true);

    try {
        // Verificar autenticação
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('❌ Usuário não autenticado:', authError);
            showToast('Erro: Usuário não autenticado. Faça login novamente.', 'error');
            return;
        }

        console.log('✅ Usuário autenticado:', user.email);
        console.log('🗑️ Tentando deletar registro ID:', id);

        // Tentar deletar
        const { data, error } = await supabase
            .from('guinchos')
            .delete()
            .eq('id', id)
            .select(); // Retorna o registro deletado para confirmar

        if (error) {
            console.error('❌ Erro Supabase ao deletar:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });

            // Mensagens específicas por tipo de erro
            if (error.code === '42501') {
                showToast('Erro: Sem permissão para deletar. Verifique as políticas RLS.', 'error');
            } else if (error.code === 'PGRST116') {
                showToast('Erro: Registro não encontrado.', 'error');
            } else {
                showToast(`Erro ao excluir: ${error.message}`, 'error');
            }
            throw error;
        }

        console.log('✅ Registro deletado com sucesso:', data);

        // Fechar modal de confirmação
        closeConfirmModal();

        // Verificar se a página atual ficará vazia após deletar
        const registrosNaPagina = registros.length;
        let paginaParaCarregar = currentPage;

        // Se deletar o último item da página e não for a primeira página, voltar uma página
        if (registrosNaPagina === 1 && currentPage > 1) {
            paginaParaCarregar = currentPage - 1;
            console.log('📄 Última linha da página deletada, voltando para página', paginaParaCarregar);
        }

        // Recarregar a lista
        console.log('🔄 Recarregando lista na página', paginaParaCarregar);
        await carregarRegistros(paginaParaCarregar);
        console.log('✅ Lista recarregada');

        showToast('Registro excluído com sucesso!', 'success');

    } catch (err) {
        console.error('❌ Erro na remoção:', err);
        if (!err.message.includes('Erro:')) {
            showToast('Erro ao excluir: ' + err.message, 'error');
        }
    } finally {
        mostrarLoading(false);
    }
}

async function editarRegistro(id) {
    // Buscar detalhes do registro. Se não estiver na lista (pagination), fetch especifico
    let r = registros.find(x => x.id == id);
    if (!r) {
        // Fetch single record if needed
        const { data } = await supabase.from('guinchos').select('*').eq('id', id).single();
        if (data) {
            r = {
                id: data.id,
                dataHora: data.data_hora,
                nomeProprietario: data.nome_proprietario || 'N/A',
                telefoneProprietario: data.telefone_proprietario || '',
                placa: data.placa || '',
                marca: data.marca || '',
                modelo: data.modelo || '',
                tipoGuincho: data.tipo_guincho || '',
                tipoPane: data.tipo_pane || '',
                numeroOS: data.numero_os || '',
                consultor: data.consultor || '',
                nomeGuincheiro: data.nome_guincheiro || '',
                telefoneGuincheiro: data.telefone_guincheiro || '',
            };
        } else {
            return;
        }
    }

    document.getElementById('editId').value = r.id;
    document.getElementById('dataHora').value = r.dataHora;
    document.getElementById('dataHoraVisual').value = formatData(r.dataHora);
    document.getElementById('nomeProprietario').value = r.nomeProprietario;
    document.getElementById('telefoneProprietario').value = r.telefoneProprietario;
    document.getElementById('placa').value = r.placa;
    document.getElementById('marca').value = r.marca;
    carregarModelos(r.modelo);
    document.getElementById('tipoGuincho').value = r.tipoGuincho;
    document.getElementById('tipoPane').value = r.tipoPane;
    verificarCampoOS();
    document.getElementById('numeroOS').value = r.numeroOS;
    document.getElementById('consultor').value = r.consultor;
    document.getElementById('nomeGuincheiro').value = r.nomeGuincheiro;
    document.getElementById('telefoneGuincheiro').value = r.telefoneGuincheiro;

    // Setup fotos para edição
    currentFiles = [...(r.fotos || [])];
    renderPreviews();

    document.getElementById('formTitle').innerText = 'Editar Registro';
    document.getElementById('editModeIndicator').classList.remove('hidden');
    document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Salvar Alteracao';
    editMode = true;

    toggleFormView(true); // Abre o formulário
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleFormSubmit(e) {
    e.preventDefault();

    // Validações
    if (!validateForm()) return;

    mostrarLoading(true);
    const id = document.getElementById('editId').value;
    const userName = currentUser?.user_metadata?.nome || currentUser?.email?.split('@')[0] || 'Usuário';
    const now = new Date().toISOString();

    // Upload Fotos
    const placa = document.getElementById('placa').value.toUpperCase().replace(/\W/g, '');
    let fotosUrls = [];
    try {
        fotosUrls = await uploadImages(placa);
    } catch (e) {
        console.error('Erro upload local, seguindo sem fotos novas', e);
        // Fallback: se houver erro no upload, mantem as que ja existiam (urls strings)
        fotosUrls = currentFiles.filter(f => typeof f === 'string');
    }

    const dados = {
        data_hora: document.getElementById('dataHora').value,
        nome_proprietario: document.getElementById('nomeProprietario').value,
        telefone_proprietario: document.getElementById('telefoneProprietario').value,
        placa: document.getElementById('placa').value.toUpperCase(),
        marca: document.getElementById('marca').value,
        modelo: document.getElementById('modelo').value,
        tipo_guincho: document.getElementById('tipoGuincho').value,
        tipo_pane: document.getElementById('tipoPane').value,
        numero_os: document.getElementById('numeroOS').value,
        consultor: document.getElementById('consultor').value,
        nome_guincheiro: document.getElementById('nomeGuincheiro').value,
        telefone_guincheiro: document.getElementById('telefoneGuincheiro').value,
        fotos: fotosUrls // Salva array de URLs
    };

    // Adicionar metadados de criação ou atualização
    if (id) {
        dados.updated_by = userName;
        dados.updated_at = now;
    } else {
        dados.created_by = userName;
        dados.created_at = now;
    }

    try {
        let res;
        if (id) res = await supabase.from('guinchos').update(dados).eq('id', id);
        else res = await supabase.from('guinchos').insert([dados]);
        if (res.error) throw res.error;

        showToast(id ? 'Registro atualizado!' : 'Veículo registrado com sucesso!', 'success');
        toggleFormView(false); // Fecha o form e limpa ele
        // Recarregar pagina atual (ou ir para primeira se for novo)
        await carregarRegistros(id ? currentPage : 1);
    } catch (err) {
        showToast('Erro ao salvar: ' + err.message, 'error');
    } finally {
        mostrarLoading(false);
    }
}

function validateForm() {
    let valid = true;

    const placa = document.getElementById('placa').value;
    const placaRegex = /^[A-Z]{3}-?\d[A-Z\d]\d{2}$/i;
    if (!placa || !placaRegex.test(placa.replace('-', ''))) {
        showFieldError('placa', 'Placa inválida (ex: ABC1234 ou ABC1D23)');
        valid = false;
    }

    if (!document.getElementById('marca').value) {
        showToast('Selecione uma marca', 'error');
        valid = false;
    }
    if (!document.getElementById('modelo').value) {
        showToast('Selecione um modelo', 'error');
        valid = false;
    }
    if (!document.getElementById('tipoGuincho').value) {
        showToast('Selecione o tipo de guincho', 'error');
        valid = false;
    }
    if (!document.getElementById('tipoPane').value) {
        showToast('Selecione o motivo/pane', 'error');
        valid = false;
    }
    if (!document.getElementById('consultor').value) {
        showToast('Selecione o consultor', 'error');
        valid = false;
    }

    const tipoPane = document.getElementById('tipoPane').value;
    if (tipoPane === 'Retorno' && !document.getElementById('numeroOS').value) {
        showToast('Informe o número da O.S.', 'error');
        valid = false;
    }

    return valid;
}

function resetForm() {
    currentFiles = [];
    renderPreviews();
    document.getElementById('entryForm').reset();
    document.getElementById('editId').value = '';
    document.getElementById('formTitle').innerText = 'Nova Entrada';
    document.getElementById('editModeIndicator').classList.add('hidden');
    document.getElementById('submitBtn').innerHTML = '<i class="fas fa-plus"></i> Registrar';
    document.getElementById('divNumeroOS').classList.add('hidden');
    editMode = false;

    const now = new Date();
    const iso = now.toISOString().split('T')[0];
    document.getElementById('dataHora').value = iso;
    document.getElementById('dataHoraVisual').value = formatData(iso);

    // Limpar erros
    document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
}

function limparFiltro() {
    filtroDatas = { inicio: '', fim: '' };
    document.getElementById('filtroDataInicio').value = '';
    document.getElementById('filtroDataFim').value = '';
    document.getElementById('buscaInteligente').value = '';
    carregarRegistros(1);
}

// ============================================
// AUXILIARES
// ============================================
function mascaraTelefone(i) {
    let v = i.value.replace(/\D/g, '');
    v = v.length > 10 ? v.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3') : v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    i.value = v;
}

function mascaraPlaca(i) {
    let v = i.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (v.length > 3) v = v.slice(0, 3) + '-' + v.slice(3);
    i.value = v.slice(0, 8);
}

function formatData(s) {
    if (!s) return '';
    const p = s.split('-');
    return `${p[2]}/${p[1]}/${p[0]}`;
}

function formatDataCurta(s) {
    if (!s) return '';
    const p = s.split('-');
    return `${p[2]}/${p[1]}`;
}

function verificarCampoOS() {
    const isRetorno = document.getElementById('tipoPane').value === 'Retorno';
    document.getElementById('divNumeroOS').classList.toggle('hidden', !isRetorno);
    document.getElementById('numeroOS').required = isRetorno;
}

function carregarModelos(sel = "") {
    const marca = document.getElementById('marca').value;
    const m = document.getElementById('modelo');
    m.innerHTML = '<option value="">Selecione...</option>';
    const opcoes = {
        "RAM": [
            "Rampage 2.0 Gas",
            "Rampage 2.0 Diesel",
            "Rampage 2.2 Diesel",
            "RAM 1500",
            "RAM 2500",
            "RAM 3500"
        ],
        "Jeep": [
            "Renegade Flex",
            "Renegade Diesel",
            "Compass Flex",
            "Compass Diesel",
            "Compass 4XE",
            "Commander Flex",
            "Commander Gas",
            "Commander Diesel",
            "Grand Cherokee (2010-2020)",
            "Grand Cherokee 4XE",
            "Jeep Wrangler",
            "Jeep Rubicon",
            "Jeep Gladiator"
        ],
        "Importadas": [
            "Jouney",
            "Dodge"
        ]
    };
    if (marca) {
        m.disabled = false;
        m.style.background = 'var(--gray-50)';
        opcoes[marca].forEach(opt => {
            const o = document.createElement('option');
            o.value = `${marca} ${opt}`;
            o.text = opt;
            if (sel === o.value) o.selected = true;
            m.appendChild(o);
        });
    } else {
        m.disabled = true;
    }
}

async function exportToCSV() {
    // Exportar pode exigir fetch de todos os registros que casam com o filtro
    mostrarLoading(true);
    try {
        let query = supabase.from('guinchos').select('*');
        const termoBusca = document.getElementById('buscaInteligente').value.trim();
        const di = filtroDatas.inicio;
        const df = filtroDatas.fim;

        if (di) query = query.gte('data_hora', di);
        if (df) query = query.lte('data_hora', df);
        if (termoBusca) {
            const term = `%${termoBusca}%`;
            query = query.or(`placa.ilike.${term},nome_proprietario.ilike.${term},modelo.ilike.${term},consultor.ilike.${term}`);
        }

        query = query.order('data_hora', { ascending: false }).order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;

        const dadosFiltrados = (data || []).map(item => ({
            dataHora: item.data_hora,
            placa: item.placa || '',
            marca: item.marca || '',
            modelo: item.modelo || '',
            tipoGuincho: item.tipo_guincho || '',
            tipoPane: item.tipo_pane || '',
            consultor: item.consultor || ''
        }));

        if (dadosFiltrados.length === 0) {
            showToast('Nenhum registro para exportar', 'error');
            return;
        }

        let csv = "Data;Placa;Marca;Modelo;Tipo Guincho;Pane;Consultor\n";
        dadosFiltrados.forEach(r => {
            csv += `${r.dataHora};${r.placa};${r.marca};${r.modelo};${r.tipoGuincho};${r.tipoPane};${r.consultor}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', 'Relatorio de Guinchos.csv');
        a.click();
        showToast(`Planilha exportada com ${dadosFiltrados.length} registro(s)!`, 'success');

    } catch (e) {
        showToast('Erro ao exportar: ' + e.message, 'error');
    } finally {
        mostrarLoading(false);
    }
}

// ============================================
// CALENDÁRIO
// ============================================
let calState = { tipo: null, ano: new Date().getFullYear(), mes: new Date().getMonth() };

function abrirCalendario(tipo, e) {
    e.stopPropagation();
    document.querySelectorAll('.calendar-popup').forEach(c => c.classList.remove('active'));
    calState.tipo = tipo;
    const cal = document.getElementById(`calendar${tipo}`);
    cal.classList.add('active');
    renderCalendario(tipo);
}

function renderCalendario(tipo) {
    const el = document.getElementById(`calendar${tipo}`);
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const diasSemana = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    const hoje = new Date();
    const totalDias = new Date(calState.ano, calState.mes + 1, 0).getDate();
    const primeiroDia = new Date(calState.ano, calState.mes, 1).getDay();

    let html = `
        <div class="calendar-header">
            <button type="button" class="calendar-nav" onclick="navegarMes(-1, '${tipo}', event)"><i class="fas fa-chevron-left"></i></button>
            <span>${meses[calState.mes]} ${calState.ano}</span>
            <button type="button" class="calendar-nav" onclick="navegarMes(1, '${tipo}', event)"><i class="fas fa-chevron-right"></i></button>
        </div>
        <div class="calendar-grid">
    `;

    diasSemana.forEach(d => html += `<div class="calendar-day-name">${d}</div>`);

    for (let i = 0; i < primeiroDia; i++) html += `<div class="calendar-day other-month"></div>`;

    for (let i = 1; i <= totalDias; i++) {
        const iso = `${calState.ano}-${String(calState.mes + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const isToday = hoje.getDate() === i && hoje.getMonth() === calState.mes && hoje.getFullYear() === calState.ano;
        html += `<div class="calendar-day${isToday ? ' today' : ''}" onclick="selecionarData('${iso}')">${i}</div>`;
    }

    html += '</div>';
    el.innerHTML = html;
}

function navegarMes(delta, tipo, e) {
    e.stopPropagation();
    calState.mes += delta;
    if (calState.mes > 11) { calState.mes = 0; calState.ano++; }
    if (calState.mes < 0) { calState.mes = 11; calState.ano--; }
    renderCalendario(tipo);
}

function selecionarData(iso) {
    if (calState.tipo === 'Cadastro') {
        document.getElementById('dataHora').value = iso;
        document.getElementById('dataHoraVisual').value = formatData(iso);
    } else {
        filtroDatas[calState.tipo.toLowerCase()] = iso;
        document.getElementById(`filtroData${calState.tipo}`).value = formatData(iso);
        carregarRegistros(1);
    }
    document.querySelectorAll('.calendar-popup').forEach(c => c.classList.remove('active'));
}

function fecharCalendariosSeClicarFora(e) {
    if (!e.target.closest('.calendar-popup') && !e.target.closest('.calendar-wrapper')) {
        document.querySelectorAll('.calendar-popup').forEach(c => c.classList.remove('active'));
    }
}

// User menu
function toggleUserMenu() {
    document.getElementById('userDropdown').classList.toggle('active');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu')) {
        document.getElementById('userDropdown')?.classList.remove('active');
    }
});

// ============================================
// PWA & INICIALIZAÇÃO
// ============================================

let deferredPrompt;
const installBanner = document.getElementById('pwa-install-banner');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBanner) installBanner.classList.add('visible');
});

function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            deferredPrompt = null;
            if (installBanner) installBanner.classList.remove('visible');
        });
    }
}

function dismissPWA() {
    if (installBanner) installBanner.classList.remove('visible');
}

// Debounce para busca
let timeoutBusca;
function handleSearchInput() {
    clearTimeout(timeoutBusca);
    timeoutBusca = setTimeout(() => {
        carregarRegistros(1);
    }, 500);
}
// Attach debounce to input
document.getElementById('buscaInteligente').oninput = handleSearchInput;


document.addEventListener('DOMContentLoaded', () => {
    mostrarLoading(true);
    initSupabase();

    // Fechar calendário ao clicar fora
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.calendar-popup') && !e.target.closest('.calendar-wrapper input')) {
            document.querySelectorAll('.calendar-popup').forEach(c => c.classList.remove('active'));
        }
    });

    initDragAndDrop();
});

// ============================================
// UPLOAD DE FOTOS E ARQUIVOS
// ============================================
function handleFileSelect(event) {
    handleFiles(event.target.files);
}

function handleFiles(filesList) {
    const files = Array.from(filesList);
    if (!files.length) return;

    // Limite de 5 arquivos
    if (currentFiles.length + files.length > 5) {
        showToast('Máximo de 5 arquivos permitido', 'error');
        return;
    }

    currentFiles = [...currentFiles, ...files];
    renderPreviews();
}

function initDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    if (!dropZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        handleFiles(e.dataTransfer.files);
    }, false);
}

function removeFile(index) {
    currentFiles.splice(index, 1);
    renderPreviews();
}

function renderPreviews() {
    const container = document.getElementById('previewContainer');
    container.innerHTML = '';

    currentFiles.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'preview-item';

        const btn = document.createElement('button');
        btn.type = 'button'; // Importante para não submeter o form
        btn.className = 'preview-remove-btn';
        btn.innerHTML = '<i class="fas fa-times"></i>';
        btn.onclick = () => removeFile(index);

        let isImage = false;
        let fileUrl = '';
        let fileName = '';

        if (typeof file === 'string') {
            const urlLower = file.toLowerCase();
            if (urlLower.match(/\.(jpeg|jpg|gif|png|webp)/i)) {
                isImage = true;
                fileUrl = file;
            } else {
                fileName = file.split('/').pop().split('?')[0];
                if (fileName.includes('_')) {
                    // Try to clean up Supabase generated name format placa_timestamp_idx.ext
                    const parts = fileName.split('_');
                    if (parts.length > 1) {
                        fileName = "Doc " + parts[parts.length - 1];
                    }
                }
                isImage = false;
            }
        } else {
            if (file.type && file.type.startsWith('image/')) {
                isImage = true;
                fileUrl = URL.createObjectURL(file);
            } else if (file.name && file.name.match(/\.(jpeg|jpg|gif|png|webp)/i)) {
                isImage = true;
                fileUrl = URL.createObjectURL(file);
            } else {
                isImage = false;
                fileName = file.name;
            }
        }

        if (isImage) {
            let img = document.createElement('img');
            img.src = fileUrl;
            div.appendChild(img);
        } else {
            let docIcon = document.createElement('div');
            docIcon.className = 'doc-preview';
            docIcon.title = fileName;

            let iconClass = 'fa-file-alt';
            if (fileName.toLowerCase().endsWith('.pdf')) iconClass = 'fa-file-pdf';
            else if (fileName.toLowerCase().endsWith('.doc') || fileName.toLowerCase().endsWith('.docx')) iconClass = 'fa-file-word';

            docIcon.innerHTML = `<i class="fas ${iconClass}"></i><span class="doc-name" style="line-clamp: 2;">${fileName}</span>`;
            div.appendChild(docIcon);
        }

        div.appendChild(btn);
        container.appendChild(div);
    });
}

async function uploadImages(placa) {
    const urls = [];
    const timestamp = Date.now();

    // Separar o que é novo (File objects) do que já existe (strings URL)
    const existingUrls = currentFiles.filter(f => typeof f === 'string');
    const newFiles = currentFiles.filter(f => typeof f !== 'string');

    urls.push(...existingUrls);

    for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i];

        // CORREÇÃO: Usar o nome do arquivo original e extensão
        const ext = file.name.split('.').pop();
        const fileName = `${placa}_${timestamp}_${i}.${ext}`;
        const filePath = `${fileName}`; // Uploading to root of bucket since folders might complicate permissions

        const { data, error } = await supabase.storage
            .from('guinchos-imagens')
            .upload(filePath, file);

        if (error) {
            console.error('Erro upload:', error);
            // Se falhar upload, não adiciona e lança erro ou continua?
            // Vamos lançar erro para alertar usuário
            throw error;
        }

        // Obter URL publica
        const { data: { publicUrl } } = supabase.storage
            .from('guinchos-imagens')
            .getPublicUrl(filePath);

        urls.push(publicUrl);
    }

    return urls;
}
