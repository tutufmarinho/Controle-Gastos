import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    signInWithCustomToken, // Importar para usar o token do Canvas
    signInAnonymously // Para login anônimo
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot
} from 'firebase/firestore';

// Carrega a biblioteca SheetJS para exportação de Excel
const XLSX = typeof window !== 'undefined' ? window.XLSX : null;

// Variáveis globais do ambiente Canvas (assumindo que estão disponíveis)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;


// Identificador único para a sua aplicação dentro do Firestore.
const APP_IDENTIFIER = "controle-gastos-app";

// Contexto para autenticação e Firestore (para fácil acesso em componentes aninhados)
const AuthContext = createContext(null);

// Componente de Modal de Confirmação customizado (substitui 'confirm()')
function ConfirmModal({ message, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full text-center rounded-lg">
                <p className="text-lg font-semibold mb-6">{message}</p>
                <div className="flex justify-center gap-4">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-md transition duration-200"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition duration-200"
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
}

// Componente Principal do Aplicativo React
function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dbInstance, setDbInstance] = useState(null);
    const [authInstance, setAuthInstance] = useState(null);
    const [userId, setUserId] = useState(null); // ID do usuário logado

    useEffect(() => {
        console.log("App useEffect [Início]: Iniciando inicialização do Firebase...");

        if (!firebaseConfig) {
            console.error("App useEffect [Erro Config]: Configuração do Firebase faltando.");
            setLoading(false);
            return;
        }

        let app;
        let auth;
        let db;

        try {
            app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);

            setAuthInstance(auth);
            setDbInstance(db);
            console.log("App useEffect [Inicializado]: Firebase app, auth, db instanciados.");
        } catch (error) {
            console.error("App useEffect [Erro Init]: Erro ao inicializar Firebase:", error);
            setLoading(false);
            return;
        }

        console.log("App useEffect [Listener]: Configurando listener de autenticação.");
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            console.log("App useEffect [onAuthStateChanged]: Callback disparado. currentUser:", currentUser);
            if (currentUser) {
                setUser(currentUser);
                setUserId(currentUser.uid);
                console.log("App useEffect [onAuthStateChanged]: Usuário autenticado definido no estado:", currentUser.uid);
            } else {
                setUser(null);
                setUserId(null);
                console.log("App useEffect [onAuthStateChanged]: Nenhum usuário autenticado, estado 'user' limpo.");

                // Tenta login com token Canvas ou anônimo apenas se não houver usuário logado
                if (auth) { // Garante que auth esteja disponível
                    try {
                        if (initialAuthToken) {
                            console.log("App useEffect [onAuthStateChanged]: Tentando login com token inicial do Canvas...");
                            await signInWithCustomToken(auth, initialAuthToken);
                            console.log("App useEffect [onAuthStateChanged]: Login com token inicial bem-sucedido.");
                        } else {
                            console.log("App useEffect [onAuthStateChanged]: Token inicial não disponível, tentando login anônimo...");
                            await signInAnonymously(auth);
                            console.log("App useEffect [onAuthStateChanged]: Login anônimo bem-sucedido.");
                        }
                    } catch (error) {
                        console.error("App useEffect [onAuthStateChanged]: Erro no login (token/anônimo):", error);
                    }
                }
            }
            setLoading(false);
            console.log("App useEffect [onAuthStateChanged]: Loading set to false.");
        });

        return () => {
            console.log("App useEffect [Cleanup]: Desinscrevendo do listener de autenticação.");
            unsubscribe();
        };
    }, []); // Array de dependências vazio para rodar apenas uma vez

    // Logs de depuração no render do componente App
    console.log("App Render [Início]: Componente App renderizando.");
    console.log("App Render [Estado]: user:", user ? user.email : "null", "loading:", loading);


    if (loading) {
        console.log("App Render: Mostrando tela de carregamento.");
        return <div className="loading-screen text-center p-8 text-xl">Carregando aplicativo...</div>;
    }

    if (!firebaseConfig || !firebaseConfig.apiKey || !firebaseConfig.projectId || firebaseConfig.apiKey === "YOUR_API_KEY") {
        console.log("App Render: Mostrando erro de configuração do Firebase.");
        return (
            <div className="flex items-center justify-center min-h-screen bg-red-100 text-red-800 p-8">
                <div className="bg-white p-6 rounded-lg shadow-md text-center rounded-lg">
                    <h2 className="text-2xl font-bold mb-4">Erro de Configuração do Firebase!</h2>
                    <p className="mb-4">Por favor, edite o arquivo `src/App.jsx` e insira suas credenciais do Firebase no objeto `firebaseConfig`.</p>
                    <p>Você pode encontrá-las no <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Console do Firebase</a>.</p>
                </div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, userId, auth: authInstance, db: dbInstance }}>
            {console.log("App Render: Provedor AuthContext renderizado. user no contexto:", user ? user.email : "null")}
            <div className="min-h-screen flex flex-col bg-gray-100 font-sans antialiased text-gray-800">
                <header className="bg-blue-900 text-white p-6 text-center shadow-lg rounded-b-lg">
                    <h1 className="text-3xl font-bold">Controle de Gastos Personalizado</h1>
                    {user && (
                        <div className="text-sm mt-2">
                            Olá, {user.email || "Usuário Anônimo"}! (ID: {userId})
                            <button
                                onClick={() => signOut(authInstance)}
                                className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md transition duration-200"
                            >
                                Sair
                            </button>
                        </div>
                    )}
                </header>
                <main className="flex-grow p-4 md:p-8 max-w-4xl mx-auto w-full">
                    {console.log("App Render: Condicional de renderização. user é:", user ? "autenticado" : "NÃO autenticado")}
                    {!user ? <AuthScreen /> : <Dashboard />}
                </main>
                <footer className="bg-blue-900 text-white p-4 text-center text-sm shadow-inner rounded-t-lg mt-auto">
                    <p>&copy; 2024 Controle de Gastos. Todos os direitos reservados.</p>
                </footer>
            </div>
        </AuthContext.Provider>
    );
}

// --- Components ---

// Authentication Component (Login/Register)
function AuthScreen() {
    const { auth } = useContext(AuthContext);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState('');
    const [loadingAuth, setLoadingAuth] = useState(false);
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [messageContent, setMessageContent] = useState('');

    const showModal = (message) => {
        setMessageContent(message);
        setShowMessageModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoadingAuth(true);
        console.log("AuthScreen: Tentando submeter, loadingAuth = true");

        try {
            if (isRegistering) {
                console.log("AuthScreen: Chamando createUserWithEmailAndPassword...");
                await createUserWithEmailAndPassword(auth, email, password);
                console.log("AuthScreen: Registro bem-sucedido.");
                showModal('Registro realizado com sucesso! Faça login.');
                setIsRegistering(false); // Volta para a tela de login
            } else {
                console.log("AuthScreen: Chamando signInWithEmailAndPassword...");
                await signInWithEmailAndPassword(auth, email, password);
                console.log("AuthScreen: Login bem-sucedido.");
                showModal('Login realizado com sucesso!');
            }
        } catch (err) {
            console.error("AuthScreen: Erro de autenticação:", err);
            let errorMessage = "Ocorreu um erro. Tente novamente.";
            if (err.code === 'auth/email-already-in-use') {
                errorMessage = "Este e-mail já está em uso.";
            } else if (err.code === 'auth/invalid-email') {
                errorMessage = "E-mail inválido.";
            } else if (err.code === 'auth/weak-password') {
                errorMessage = "Senha muito fraca (mínimo de 6 caracteres).";
            } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                errorMessage = "E-mail ou senha incorretos.";
            }
            setError(errorMessage);
        } finally {
            setLoadingAuth(false);
            console.log("AuthScreen: Submissão concluída, loadingAuth = false.");
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md mx-auto my-8 rounded-lg">
            {showMessageModal && (
                <ConfirmModal
                    message={messageContent}
                    onConfirm={() => setShowMessageModal(false)}
                    onCancel={() => setShowMessageModal(false)} // No caso de um alerta, ambos fecham
                />
            )}
            <h2 className="text-2xl font-semibold mb-6 text-center text-blue-800">{isRegistering ? 'Criar Conta' : 'Fazer Login'}</h2>
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 rounded-md" role="alert">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">E-mail:</label>
                    <input
                        type="email"
                        id="email"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">Senha:</label>
                    <input
                        type="password"
                        id="password"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-200 rounded-md"
                    disabled={loadingAuth}
                >
                    {loadingAuth ? 'Carregando...' : (isRegistering ? 'Registrar' : 'Entrar')}
                </button>
            </form>
            <p className="mt-6 text-center text-gray-600">
                {isRegistering ? (
                    <>Já tem uma conta? <button type="button" onClick={() => setIsRegistering(false)} className="text-blue-600 hover:underline font-medium">Faça login</button></>
                ) : (
                    <>Não tem uma conta? <button type="button" onClick={() => setIsRegistering(true)} className="text-blue-600 hover:underline font-medium">Crie uma aqui</button></>
                )}
            </p>
        </div>
    );
}

// Dashboard Component (after login)
function Dashboard() {
    const { userId, db } = useContext(AuthContext);
    const [spreadsheets, setSpreadsheets] = useState([]);
    const [loadingSheets, setLoadingSheets] = useState(true);
    const [newSheetName, setNewSheetName] = useState('');
    const [selectedSheetId, setSelectedSheetId] = useState(null);
    const [error, setError] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [messageContent, setMessageContent] = useState('');

    const showModal = (message) => {
        setMessageContent(message);
        setShowMessageModal(true);
    };

    useEffect(() => {
        console.log("Dashboard useEffect [Início]: userId", userId, "db", db ? "presente" : "ausente");
        if (!db || !userId) {
            setLoadingSheets(false);
            console.log("Dashboard useEffect [Condição]: DB ou userId não disponíveis, pulando busca de planilhas.");
            return;
        }

        const sheetsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/spreadsheets`);
        console.log("Dashboard useEffect [Busca]: Tentando buscar planilhas do usuário:", sheetsCollectionRef.path);

        const unsubscribe = onSnapshot(sheetsCollectionRef, (snapshot) => {
            const fetchedSheets = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setSpreadsheets(fetchedSheets);
            setLoadingSheets(false);
            console.log("Dashboard useEffect [onSnapshot]: Planilhas carregadas:", fetchedSheets);
        }, (err) => {
            console.error("Dashboard useEffect [Erro]: Erro ao buscar planilhas:", err);
            setError("Erro ao carregar suas planilhas.");
            setLoadingSheets(false);
        });

        return () => {
            console.log("Dashboard useEffect [Cleanup]: Desinscrevendo do listener de planilhas.");
            unsubscribe();
        };
    }, [db, userId]);

    const createNewSpreadsheet = async () => {
        if (!newSheetName.trim()) {
            showModal('Por favor, digite um nome para a nova planilha.');
            return;
        }
        if (!db || !userId) {
            setError("Erro: Usuário não autenticado ou DB não disponível.");
            return;
        }

        try {
            const newDocRef = doc(collection(db, `artifacts/${appId}/users/${userId}/spreadsheets`));
            await setDoc(newDocRef, {
                name: newSheetName.trim(),
                ownerId: userId,
                config: {
                    categories: []
                },
                expenses: []
            });
            setNewSheetName('');
            showModal('Planilha criada com sucesso!');
        } catch (err) {
            console.error("Erro ao criar planilha:", err);
            setError("Erro ao criar a nova planilha.");
        }
    };

    const handleDeleteSpreadsheet = (sheetId) => {
        setConfirmMessage('Tem certeza que deseja excluir esta planilha? Todos os dados serão perdidos.');
        setConfirmAction(() => async () => {
            if (!db || !userId) {
                setError("Erro: Usuário não autenticado ou DB não disponível.");
                setShowConfirmModal(false);
                return;
            }
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/spreadsheets/${sheetId}`));
                if (selectedSheetId === sheetId) {
                    setSelectedSheetId(null);
                }
                showModal('Planilha excluída com sucesso!');
            } catch (err) {
                console.error("Erro ao excluir planilha:", err);
                setError("Erro ao excluir a planilha.");
            } finally {
                setShowConfirmModal(false);
            }
        });
        setShowConfirmModal(true);
    };

    if (selectedSheetId) {
        const selectedSheet = spreadsheets.find(sheet => sheet.id === selectedSheetId);
        if (selectedSheet) {
            return (
                <SpreadsheetEditor
                    sheet={selectedSheet}
                    onBack={() => setSelectedSheetId(null)}
                />
            );
        } else {
            setSelectedSheetId(null);
            return null;
        }
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-md my-8 rounded-lg">
            {showConfirmModal && (
                <ConfirmModal
                    message={confirmMessage}
                    onConfirm={confirmAction}
                    onCancel={() => setShowConfirmModal(false)}
                />
            )}
            {showMessageModal && (
                <ConfirmModal // Reutilizando ConfirmModal como MessageModal
                    message={messageContent}
                    onConfirm={() => setShowMessageModal(false)}
                    onCancel={() => setShowMessageModal(false)}
                />
            )}
            <h2 className="text-2xl font-semibold mb-6 text-blue-800">Minhas Planilhas</h2>
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 rounded-md" role="alert">{error}</div>}

            <div className="mb-8 p-4 border border-blue-200 rounded-lg bg-blue-50 rounded-lg">
                <h3 className="text-xl font-medium mb-4 text-blue-700">Criar Nova Planilha</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        placeholder="Nome da nova planilha"
                        className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
                        value={newSheetName}
                        onChange={(e) => setNewSheetName(e.target.value)}
                    />
                    <button
                        onClick={createNewSpreadsheet}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition duration-200 rounded-md"
                    >
                        Criar
                    </button>
                </div>
            </div>

            <h3 className="text-xl font-medium mb-4 text-blue-700">Minhas Planilhas Existentes</h3>
            {loadingSheets ? (
                <p className="text-center text-gray-500">Carregando planilhas...</p>
            ) : spreadsheets.length === 0 ? (
                <p className="text-center text-gray-500">Você ainda não tem nenhuma planilha. Crie uma!</p>
            ) : (
                <ul className="space-y-3">
                    {spreadsheets.map(sheet => (
                        <li key={sheet.id} className="flex flex-col sm:flex-row items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-md shadow-sm rounded-md">
                            <span className="font-semibold text-lg text-blue-700 mb-2 sm:mb-0 sm:mr-4">{sheet.name}</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedSheetId(sheet.id)}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition duration-200 rounded-md"
                                >
                                    Abrir
                                </button>
                                <button
                                    onClick={() => handleDeleteSpreadsheet(sheet.id)}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition duration-200 rounded-md"
                                >
                                    Excluir
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// Spreadsheet Editor Component (for a specific spreadsheet)
function SpreadsheetEditor({ sheet, onBack }) {
    const { db, userId } = useContext(AuthContext);
    const [categories, setCategories] = useState(sheet.config.categories || []);
    const [expenses, setExpenses] = useState(sheet.expenses || []);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryBudget, setNewCategoryBudget] = useState('');
    const [valorGasto, setValorGasto] = useState('');
    const [categoriaSelecionada, setCategoriaSelecionada] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [messageContent, setMessageContent] = useState('');

    const showModal = (message) => {
        setMessageContent(message);
        setShowMessageModal(true);
    };

    // Listener de tempo real para a planilha atual no Firestore
    useEffect(() => {
        console.log("SpreadsheetEditor useEffect [Início]: userId", userId, "db", db ? "presente" : "ausente", "sheet.id", sheet.id);
        if (!db || !userId || !sheet.id) {
            console.log("SpreadsheetEditor useEffect [Condição]: DB, userId ou sheet.id não disponíveis, pulando listener.");
            return;
        }

        const sheetDocRef = doc(db, `artifacts/${appId}/users/${userId}/spreadsheets/${sheet.id}`);
        console.log("SpreadsheetEditor useEffect [Busca]: Tentando buscar planilhas do usuário:", sheetDocRef.path);

        const unsubscribe = onSnapshot(sheetDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setCategories(data.config.categories || []);
                setExpenses(data.expenses || []);
                console.log("SpreadsheetEditor useEffect [onSnapshot]: Dados da planilha atualizados em tempo real:", data);
            } else {
                console.log("SpreadsheetEditor useEffect [Planilha não encontrada]: Planilha não encontrada. Voltando ao dashboard.");
                onBack();
            }
        }, (err) => {
            console.error("SpreadsheetEditor useEffect [Erro]: Erro no listener de planilha:", err);
            setError("Erro ao carregar dados da planilha em tempo real.");
        });

        return () => {
            console.log("SpreadsheetEditor useEffect [Cleanup]: Desinscrevendo do listener de planilha.");
            unsubscribe();
        };
    }, [db, userId, sheet.id, onBack]);

    const updateSheetInFirestore = async (newConfig, newExpenses) => {
        if (!db || !userId || !sheet.id) {
            setError("Erro: Falha na conexão com o banco de dados.");
            return;
        }
        setLoading(true);
        try {
            await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/spreadsheets/${sheet.id}`), {
                config: { categories: newConfig },
                expenses: newExpenses
            });
            setError('');
            console.log("SpreadsheetEditor: Planilha atualizada no Firestore.");
        } catch (err) {
            console.error("SpreadsheetEditor: Erro ao atualizar planilha no Firestore:", err);
            setError("Erro ao salvar alterações.");
        } finally {
            setLoading(false);
        }
    };

    // --- Funções de Configuração de Categorias ---
    const addCategory = async () => {
        if (!newCategoryName.trim() || isNaN(parseFloat(newCategoryBudget))) {
            showModal('Por favor, preencha o nome da categoria e o orçamento.');
            return;
        }
        if (categories.some(cat => cat.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
            showModal('Esta categoria já existe.');
            return;
        }
        const updatedCategories = [...categories, { name: newCategoryName.trim(), budget: parseFloat(newCategoryBudget) }];
        await updateSheetInFirestore(updatedCategories, expenses);
        setNewCategoryName('');
        setNewCategoryBudget('');
    };

    const editCategory = async (index) => {
        const currentCategory = categories[index];
        const newName = prompt(`Editar nome para "${currentCategory.name}":`, currentCategory.name);
        if (newName !== null && newName.trim() !== '') {
            const newBudget = parseFloat(prompt(`Editar orçamento para "${currentCategory.name}" (R$):`, currentCategory.budget.toFixed(2)));
            if (!isNaN(newBudget) && newBudget >= 0) {
                const updatedCategories = [...categories];
                updatedCategories[index] = { name: newName.trim(), budget: newBudget };
                await updateSheetInFirestore(updatedCategories, expenses);
            } else {
                showModal('Orçamento inválido.');
            }
        }
    };

    const handleRemoveCategory = (index) => {
        setConfirmMessage('Remover esta categoria? Os gastos associados a ela não serão excluídos, mas não aparecerão no resumo desta categoria.');
        setConfirmAction(() => async () => {
            const updatedCategories = categories.filter((_, i) => i !== index);
            await updateSheetInFirestore(updatedCategories, expenses);
            setShowConfirmModal(false);
        });
        setShowConfirmModal(true);
    };

    // --- Funções de Adicionar/Remover Gastos Individuais ---
    const addExpense = async () => {
        const val = parseFloat(valorGasto);
        if (val > 0 && categoriaSelecionada && categories.some(cat => cat.name === categoriaSelecionada)) {
            const newExpense = {
                id: Date.now(), // ID único para cada gasto
                categoria: categoriaSelecionada,
                valor: val,
                timestamp: new Date().toISOString()
            };
            const updatedExpenses = [...expenses, newExpense];
            await updateSheetInFirestore(categories, updatedExpenses);
            setValorGasto('');
            setCategoriaSelecionada('');
        } else {
            showModal('Por favor, insira um valor válido e selecione uma categoria existente.');
        }
    };

    const handleRemoveIndividualExpense = (expenseId) => {
        setConfirmMessage('Tem certeza que deseja remover este gasto?');
        setConfirmAction(() => async () => {
            const updatedExpenses = expenses.filter(exp => exp.id !== expenseId);
            await updateSheetInFirestore(categories, updatedExpenses);
            setShowConfirmModal(false);
        });
        setShowConfirmModal(true);
    };

    // --- Cálculos para a Tabela de Resumo e Totais Gerais ---
    const getCategoryTotals = () => {
        const totals = {};
        categories.forEach(cat => {
            totals[cat.name] = {
                budget: cat.budget,
                spent: 0,
                balance: 0
            };
        });

        expenses.forEach(exp => {
            if (totals[exp.categoria]) {
                totals[exp.categoria].spent += exp.valor;
            } else {
                // Caso um gasto seja de uma categoria que foi removida, ele não entra no resumo por categoria
                console.warn(`Gasto em categoria '${exp.categoria}' não encontrada nas categorias configuradas.`);
            }
        });

        for (const catName in totals) {
            totals[catName].balance = totals[catName].budget - totals[catName].spent;
        }
        return totals;
    };

    const categoryTotals = getCategoryTotals();

    const totalPrevisaoGastos = categories.reduce((sum, cat) => sum + cat.budget, 0);
    const totalJaGastos = expenses.reduce((sum, exp) => sum + exp.valor, 0);
    const totalSaldo = totalPrevisaoGastos - totalJaGastos;

    // --- Função de Exportação para Excel ---
    const exportToExcel = () => {
        if (!XLSX) {
            showModal("A biblioteca de exportação Excel não foi carregada. Tente novamente mais tarde ou verifique a conexão.");
            return;
        }
        const dadosParaPlanilha = [];

        // Linha 1: Título "CONTROLE DE GASTOS"
        dadosParaPlanilha.push(["", "CONTROLE DE GASTOS", "", ""]);
        // Linha 2: Cabeçalhos
        dadosParaPlanilha.push(["ITEM", "VALOR", "SALDO", "JÁ GASTEI"]);

        // Dados das categorias
        categories.forEach(cat => {
            const totals = categoryTotals[cat.name] || { budget: cat.budget, spent: 0, balance: 0 };
            dadosParaPlanilha.push([
                cat.name,
                totals.budget,
                totals.balance,
                totals.spent
            ]);
        });

        // Linha vazia para espaçamento
        dadosParaPlanilha.push([]);

        // Totais Finais
        dadosParaPlanilha.push(["PREVISÃO DE GASTOS", "", totalPrevisaoGastos, ""]);
        dadosParaPlanilha.push(["JÁ GASTOS", totalJaGastos, "", ""]);
        dadosParaPlanilha.push(["SALDO", totalSaldo, "", ""]);

        const ws = XLSX.utils.aoa_to_sheet(dadosParaPlanilha);

        // --- Configurações de Mesclagem de Células ---
        ws['!merges'] = [
            { s: { r: 0, c: 1 }, e: { r: 0, c: 3 } }, // Título "CONTROLE DE GASTOS"
            { s: { r: dadosParaPlanilha.length - 3, c: 0 }, e: { r: dadosParaPlanilha.length - 3, c: 1 } } // PREVISAO DE GASTOS
        ];

        // --- Estilos de Células (Negrito, Cores, Formato de Moeda) ---
        if (ws['B1']) {
            ws['B1'].s = {
                font: { bold: true, sz: 14 },
                alignment: { horizontal: "center", vertical: "center" },
                fill: { fgColor: { rgb: "FFE0E0E0" } }
            };
        }

        const headerStyle = { font: { bold: true }, fill: { fgColor: { rgb: "FFF0F0F0" } } };
        if (ws['A2']) ws['A2'].s = headerStyle;
        if (ws['B2']) ws['B2'].s = headerStyle;
        if (ws['C2']) ws['C2'].s = headerStyle;
        if (ws['D2']) ws['D2'].s = headerStyle;

        const valorCellStyle = { numFmt: 'R$ #,##0.00' };
        const saldoCellStyle = { fill: { fgColor: { rgb: "FFD9EDC8" } }, numFmt: 'R$ #,##0.00;[Red]-R$ #,##0.00' };
        const jaGasteiCellStyle = { fill: { fgColor: { rgb: "FFFEEFB3" } }, numFmt: 'R$ #,##0.00;[Red]-R$ #,##0.00' };

        for (let i = 2; i < categories.length + 2; i++) { // Iterar sobre as linhas de dados das categorias
            const valorCell = XLSX.utils.encode_cell({ r: i, c: 1 });
            const saldoCell = XLSX.utils.encode_cell({ r: i, c: 2 });
            const jaGasteiCell = XLSX.utils.encode_cell({ r: i, c: 3 });

            if (ws[valorCell]) ws[valorCell].s = valorCellStyle;
            if (ws[saldoCell]) ws[saldoCell].s = saldoCellStyle;
            if (ws[jaGasteiCell]) ws[jaGasteiCell].s = jaGasteiCellStyle;
        }

        const totalHeaderStyle = { font: { bold: true }, fill: { fgColor: { rgb: "FFF0F0F0" } } };
        const totalValueStyle = { font: { bold: true }, numFmt: 'R$ #,##0.00;[Red]-R$ #,##0.00', fill: { fgColor: { rgb: "FFF0F0F0" } } };

        const rowIndexPrevisao = dadosParaPlanilha.length - 3;
        const rowIndexJaGastos = dadosParaPlanilha.length - 2;
        const rowIndexSaldo = dadosParaPlanilha.length - 1;

        if (ws[XLSX.utils.encode_cell({ r: rowIndexPrevisao, c: 0 })]) ws[XLSX.utils.encode_cell({ r: rowIndexPrevisao, c: 0 })].s = totalHeaderStyle;
        if (ws[XLSX.utils.encode_cell({ r: rowIndexPrevisao, c: 2 })]) ws[XLSX.utils.encode_cell({ r: rowIndexPrevisao, c: 2 })].s = totalValueStyle;

        if (ws[XLSX.utils.encode_cell({ r: rowIndexJaGastos, c: 0 })]) ws[XLSX.utils.encode_cell({ r: rowIndexJaGastos, c: 0 })].s = totalHeaderStyle;
        if (ws[XLSX.utils.encode_cell({ r: rowIndexJaGastos, c: 1 })]) ws[XLSX.utils.encode_cell({ r: rowIndexJaGastos, c: 1 })].s = totalValueStyle;

        if (ws[XLSX.utils.encode_cell({ r: rowIndexSaldo, c: 0 })]) ws[XLSX.utils.encode_cell({ r: rowIndexSaldo, c: 0 })].s = totalHeaderStyle;
        if (ws[XLSX.utils.encode_cell({ r: rowIndexSaldo, c: 1 })]) ws[XLSX.utils.encode_cell({ r: rowIndexSaldo, c: 1 })].s = totalValueStyle;

        ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheet.name);
        XLSX.writeFile(wb, `${sheet.name.replace(/\s/g, '_')}_gastos.xlsx`);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md my-8 rounded-lg">
            {showConfirmModal && (
                <ConfirmModal
                    message={confirmMessage}
                    onConfirm={confirmAction}
                    onCancel={() => setShowConfirmModal(false)}
                />
            )}
            {showMessageModal && (
                <ConfirmModal // Reutilizando ConfirmModal como MessageModal
                    message={messageContent}
                    onConfirm={() => setShowMessageModal(false)}
                    onCancel={() => setShowMessageModal(false)}
                />
            )}
            <button
                onClick={onBack}
                className="mb-4 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md transition duration-200 rounded-md"
            >
                ← Voltar para Minhas Planilhas
            </button>

            <h2 className="text-2xl font-semibold mb-6 text-blue-800">{sheet.name}</h2>
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 rounded-md" role="alert">{error}</div>}
            {loading && <p className="text-center text-blue-500 mb-4">Salvando...</p>}

            {/* Seção de Configuração de Categorias para esta planilha */}
            <section className="mb-8 p-4 border border-blue-200 rounded-lg bg-blue-50 rounded-lg">
                <h3 className="text-xl font-medium mb-4 text-blue-700">Configurar Categorias e Orçamentos</h3>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <input
                        type="text"
                        placeholder="Nome da Categoria"
                        className="flex-grow px-3 py-2 border border-gray-300 rounded-md rounded-md"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                    />
                    <input
                        type="number"
                        step="0.01"
                        placeholder="Orçamento (R$)"
                        className="w-full sm:w-32 px-3 py-2 border border-gray-300 rounded-md rounded-md"
                        value={newCategoryBudget}
                        onChange={(e) => setNewCategoryBudget(e.target.value)}
                    />
                    <button
                        onClick={addCategory}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition duration-200 rounded-md"
                    >
                        Adicionar
                    </button>
                </div>
                {categories.length > 0 && (
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="border px-4 py-2 text-left">Categoria</th>
                                <th className="border px-4 py-2 text-right">Orçamento</th>
                                <th className="border px-4 py-2 text-left">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map((cat, index) => (
                                <tr key={cat.name} className="odd:bg-gray-50">
                                    <td className="border px-4 py-2">{cat.name}</td>
                                    <td className="border px-4 py-2 text-right">R$ {cat.budget.toFixed(2).replace('.', ',')}</td>
                                    <td className="border px-4 py-2">
                                        <button
                                            onClick={() => editCategory(index)}
                                            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-xs mr-2 rounded-md"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => handleRemoveCategory(index)}
                                            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md text-xs rounded-md"
                                        >
                                            Remover
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            {/* Seção de Adicionar Gasto */}
            <section className="mb-8 p-4 border border-purple-200 rounded-lg bg-purple-50 rounded-lg">
                <h3 className="text-xl font-medium mb-4 text-purple-700">Adicionar Novo Gasto</h3>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <input
                        type="number"
                        step="0.01"
                        placeholder="Valor (R$)"
                        className="flex-grow px-3 py-2 border border-gray-300 rounded-md rounded-md"
                        value={valorGasto}
                        onChange={(e) => setValorGasto(e.target.value)}
                    />
                    <select
                        className="w-full sm:w-40 px-3 py-2 border border-gray-300 rounded-md rounded-md"
                        value={categoriaSelecionada}
                        onChange={(e) => setCategoriaSelecionada(e.target.value)}
                    >
                        <option value="">Selecione a Categoria</option>
                        {categories.map(cat => (
                            <option key={cat.name} value={cat.name}>{cat.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={addExpense}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition duration-200 rounded-md"
                    >
                        Adicionar
                    </button>
                </div>
            </section>

            {/* Tabela de Resumo (agora acima da lista de gastos individuais) */}
            <section className="mb-8 p-4 border border-green-200 rounded-lg bg-white shadow-sm rounded-lg">
                <h2 className="text-xl font-medium mb-4 text-green-800 text-center">CONTROLE DE GASTOS</h2>
                <table className="w-full border-collapse mb-4">
                    <thead>
                        <tr>
                            <th className="border px-4 py-2 text-left">ITEM</th>
                            <th className="border px-4 py-2 text-right">VALOR</th>
                            <th className="border px-4 py-2 text-right bg-green-100">SALDO</th>
                            <th className="border px-4 py-2 text-right bg-yellow-100">JÁ GASTEI</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map(cat => {
                            const totals = categoryTotals[cat.name] || { budget: cat.budget, spent: 0, balance: 0 };
                            return (
                                <tr key={cat.name} className="odd:bg-gray-50">
                                    <td className="border px-4 py-2">{cat.name}</td>
                                    <td className="border px-4 py-2 text-right">R$ {totals.budget.toFixed(2).replace('.', ',')}</td>
                                    <td className="border px-4 py-2 text-right bg-green-100">R$ {totals.balance.toFixed(2).replace('.', ',')}</td>
                                    <td className="border px-4 py-2 text-right bg-yellow-100">R$ {totals.spent.toFixed(2).replace('.', ',')}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <div className="p-3 bg-gray-100 rounded-md rounded-md">
                    <p className="flex justify-between text-lg font-semibold mb-1">
                        PREVISÃO DE GASTOS: <span className="text-blue-700">R$ {totalPrevisaoGastos.toFixed(2).replace('.', ',')}</span>
                    </p>
                    <p className="flex justify-between text-lg font-semibold mb-1">
                        JÁ GASTOS: <span className="text-red-600">R$ {totalJaGastos.toFixed(2).replace('.', ',')}</span>
                    </p>
                    <p className="flex justify-between text-xl font-bold">
                        SALDO: <span className="text-green-700">R$ {totalSaldo.toFixed(2).replace('.', ',')}</span>
                    </p>
                </div>
            </section>

            {/* Lista de Gastos Individuais */}
            <section className="mb-8 p-4 border border-orange-200 rounded-lg bg-white shadow-sm rounded-lg">
                <h3 className="text-xl font-medium mb-4 text-orange-700">Detalhamento dos Gastos:</h3>
                {expenses.length === 0 ? (
                    <p className="text-center text-gray-500">Nenhum gasto registrado ainda para esta planilha.</p>
                ) : (
                    <ul className="space-y-2">
                        {expenses.map(exp => (
                            <li key={exp.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-md shadow-sm border border-gray-100 rounded-md">
                                <span className="text-gray-700">
                                    {exp.categoria}: R$ {exp.valor.toFixed(2).replace('.', ',')} ({new Date(exp.timestamp).toLocaleDateString()})
                                </span>
                                <button
                                    onClick={() => handleRemoveIndividualExpense(exp.id)}
                                    className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm transition duration-200 rounded-md"
                                >
                                    Remover
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <button
                onClick={exportToExcel}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200 rounded-lg"
            >
                Exportar para Excel
            </button>
        </div>
    );
}

export default App;
