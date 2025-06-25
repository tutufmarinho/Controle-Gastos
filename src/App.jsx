import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    onSnapshot,
    arrayUnion,
    arrayRemove,
    query,
    where
} from 'firebase/firestore';

// Carrega a biblioteca SheetJS para exportação de Excel
const XLSX = typeof window !== 'undefined' ? window.XLSX : null;

// Sua configuração do Firebase (copiada diretamente do seu console Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyDnQ04XWaZtw1C7_Z8yKafELcdM4cjRLS4",
  authDomain: "controle-gastos-d1cec.firebaseapp.com",
  projectId: "controle-gastos-d1cec",
  storageBucket: "controle-gastos-d1cec.appspot.com",
  messagingSenderId: "1098535347473",
  appId: "1:1098535347473:web:644cff53a3f8cb0c4658b0",
  measurementId: "G-NMNM4Y68X5"
};

// Identificador único para a sua aplicação dentro do Firestore.
// Garante que os dados de diferentes aplicações (se você tiver várias) não se misturem.
const APP_IDENTIFIER = "controle-gastos-app";

// Contexto para autenticação e Firestore (para fácil acesso em componentes aninhados)
const AuthContext = createContext(null);

// Componente de Modal de Confirmação customizado (substitui 'confirm()')
function ConfirmModal({ message, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full text-center">
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
    const [firebaseAppInstance, setFirebaseAppInstance] = useState(null);
    const [dbInstance, setDbInstance] = useState(null);
    const [authInstance, setAuthInstance] = useState(null);
    const [userId, setUserId] = useState(null); // ID do usuário logado

    useEffect(() => {
        // Initialize Firebase ONLY if the keys are provided (not the placeholders)
        if (firebaseConfig.apiKey && firebaseConfig.projectId && !firebaseAppInstance) {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            setFirebaseAppInstance(app);
            setAuthInstance(auth);
            setDbInstance(db);

            // Listener for authentication state
            const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
                if (currentUser) {
                    setUser(currentUser);
                    setUserId(currentUser.uid);
                    console.log("Usuário autenticado:", currentUser.uid);
                } else {
                    setUser(null);
                    setUserId(null);
                    console.log("Nenhum usuário autenticado.");
                }
                setLoading(false);
            });

            // Cleanup the listener
            return () => unsubscribe();
        } else if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
            console.error("Firebase config is incomplete. Please provide your API Key and Project ID.");
            setLoading(false);
        } else {
             setLoading(false); // Already initialized or without complete config
        }
    }, [firebaseAppInstance]); // Runs once on component mount, or when firebaseAppInstance changes (which shouldn't happen)

    if (loading) {
        return <div className="loading-screen text-center p-8 text-xl">Carregando aplicativo...</div>;
    }

    if (!firebaseConfig.apiKey || !firebaseConfig.projectId || firebaseConfig.apiKey === "YOUR_API_KEY") {
        return (
            <div className="flex items-center justify-center min-h-screen bg-red-100 text-red-800 p-8">
                <div className="bg-white p-6 rounded-lg shadow-md text-center">
                    <h2 className="text-2xl font-bold mb-4">Erro de Configuração do Firebase!</h2>
                    <p className="mb-4">Por favor, edite o arquivo `src/App.jsx` e insira suas credenciais do Firebase no objeto `firebaseConfig`.</p>
                    <p>Você pode encontrá-las no <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Console do Firebase</a>.</p>
                </div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, userId, auth: authInstance, db: dbInstance, firebaseApp: firebaseAppInstance }}>
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoadingAuth(true);

        try {
            if (isRegistering) {
                await createUserWithEmailAndPassword(auth, email, password);
                alert('Registro realizado com sucesso! Faça login.'); // Using alert temporarily, ideally a success modal
                setIsRegistering(false); // Back to login screen
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                alert('Login realizado com sucesso!'); // Using alert temporarily, ideally a success modal
            }
        } catch (err) {
            console.error("Erro de autenticação:", err);
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
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md mx-auto my-8">
            <h2 className="text-2xl font-semibold mb-6 text-center text-blue-800">{isRegistering ? 'Criar Conta' : 'Fazer Login'}</h2>
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">E-mail:</label>
                    <input
                        type="email"
                        id="email"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-200"
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

    useEffect(() => {
        if (!db || !userId) {
            setLoadingSheets(false); // If DB or userId are not available, don't load.
            return;
        }

        const sheetsCollectionRef = collection(db, `apps/${APP_IDENTIFIER}/users/${userId}/spreadsheets`);
        console.log("Tentando buscar planilhas do usuário:", sheetsCollectionRef.path);

        const unsubscribe = onSnapshot(sheetsCollectionRef, (snapshot) => {
            const fetchedSheets = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setSpreadsheets(fetchedSheets);
            setLoadingSheets(false);
            console.log("Planilhas carregadas:", fetchedSheets);
        }, (err) => {
            console.error("Erro ao buscar planilhas:", err);
            setError("Erro ao carregar suas planilhas.");
            setLoadingSheets(false);
        });

        return () => unsubscribe(); // Cleanup the listener
    }, [db, userId]);

    const createNewSpreadsheet = async () => {
        if (!newSheetName.trim()) {
            alert('Por favor, digite um nome para a nova planilha.');
            return;
        }
        if (!db || !userId) {
            setError("Erro: Usuário não autenticado ou DB não disponível.");
            return;
        }

        try {
            const newDocRef = doc(collection(db, `apps/${APP_IDENTIFIER}/users/${userId}/spreadsheets`));
            await setDoc(newDocRef, {
                name: newSheetName.trim(),
                ownerId: userId,
                config: {
                    categories: [] // Start empty, user will configure
                },
                expenses: [] // No expenses initially
            });
            setNewSheetName('');
            alert('Planilha criada com sucesso!');
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
                await deleteDoc(doc(db, `apps/${APP_IDENTIFIER}/users/${userId}/spreadsheets/${sheetId}`));
                if (selectedSheetId === sheetId) {
                    setSelectedSheetId(null);
                }
                alert('Planilha excluída com sucesso!');
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
            // If the selected sheet is not found (e.g., deleted by another device)
            setSelectedSheetId(null);
            return null; // or an error component
        }
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-md my-8">
            {showConfirmModal && (
                <ConfirmModal
                    message={confirmMessage}
                    onConfirm={confirmAction}
                    onCancel={() => setShowConfirmModal(false)}
                />
            )}
            <h2 className="text-2xl font-semibold mb-6 text-blue-800">Minhas Planilhas</h2>
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}

            {/* Create New Spreadsheet */}
            <div className="mb-8 p-4 border border-blue-200 rounded-lg bg-blue-50">
                <h3 className="text-xl font-medium mb-4 text-blue-700">Criar Nova Planilha</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        placeholder="Nome da nova planilha"
                        className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={newSheetName}
                        onChange={(e) => setNewSheetName(e.target.value)}
                    />
                    <button
                        onClick={createNewSpreadsheet}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition duration-200"
                    >
                        Criar
                    </button>
                </div>
            </div>

            {/* List of Existing Spreadsheets */}
            <h3 className="text-xl font-medium mb-4 text-blue-700">Minhas Planilhas Existentes</h3>
            {loadingSheets ? (
                <p className="text-center text-gray-500">Carregando planilhas...</p>
            ) : spreadsheets.length === 0 ? (
                <p className="text-center text-gray-500">Você ainda não tem nenhuma planilha. Crie uma!</p>
            ) : (
                <ul className="space-y-3">
                    {spreadsheets.map(sheet => (
                        <li key={sheet.id} className="flex flex-col sm:flex-row items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-md shadow-sm">
                            <span className="font-semibold text-lg text-blue-700 mb-2 sm:mb-0 sm:mr-4">{sheet.name}</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedSheetId(sheet.id)}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition duration-200"
                                >
                                    Abrir
                                </button>
                                <button
                                    onClick={() => handleDeleteSpreadsheet(sheet.id)}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition duration-200"
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


    // Real-time listener for the current spreadsheet in Firestore
    useEffect(() => {
        if (!db || !userId || !sheet.id) return;

        const sheetDocRef = doc(db, `apps/${APP_IDENTIFIER}/users/${userId}/spreadsheets/${sheet.id}`);
        const unsubscribe = onSnapshot(sheetDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setCategories(data.config.categories || []);
                setExpenses(data.expenses || []);
                console.log("Dados da planilha atualizados em tempo real:", data);
            } else {
                console.log("Planilha não encontrada. Voltando ao dashboard.");
                onBack(); // Go back to dashboard if the sheet was deleted
            }
        }, (err) => {
            console.error("Erro no listener de planilha:", err);
            setError("Erro ao carregar dados da planilha em tempo real.");
        });

        return () => unsubscribe();
    }, [db, userId, sheet.id, onBack]);

    const updateSheetInFirestore = async (newConfig, newExpenses) => {
        if (!db || !userId || !sheet.id) {
            setError("Erro: Falha na conexão com o banco de dados.");
            return;
        }
        setLoading(true);
        try {
            await updateDoc(doc(db, `apps/${APP_IDENTIFIER}/users/${userId}/spreadsheets/${sheet.id}`), {
                config: { categories: newConfig },
                expenses: newExpenses
            });
            setError('');
            console.log("Planilha atualizada no Firestore.");
        } catch (err) {
            console.error("Erro ao atualizar planilha no Firestore:", err);
            setError("Erro ao salvar alterações.");
        } finally {
            setLoading(false);
        }
    };

    // --- Category Configuration Functions ---
    const addCategory = async () => {
        if (!newCategoryName.trim() || isNaN(parseFloat(newCategoryBudget))) {
            alert('Por favor, preencha o nome da categoria e o orçamento.');
            return;
        }
        if (categories.some(cat => cat.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
            alert('Esta categoria já existe.');
            return;
        }
        const updatedCategories = [...categories, { name: newCategoryName.trim(), budget: parseFloat(newCategoryBudget) }];
        await updateSheetInFirestore(updatedCategories, expenses);
        setNewCategoryName('');
        setNewCategoryBudget('');
    };

    const editCategory = async (index) => {
        const currentCategory = categories[index];
        const newName = window.prompt(`Editar nome para "${currentCategory.name}":`, currentCategory.name); // Using window.prompt temporarily
        if (newName !== null && newName.trim() !== '') {
            const newBudget = parseFloat(window.prompt(`Editar orçamento para "${currentCategory.name}" (R$):`, currentCategory.budget.toFixed(2))); // Using window.prompt temporarily
            if (!isNaN(newBudget) && newBudget >= 0) {
                const updatedCategories = [...categories];
                updatedCategories[index] = { name: newName.trim(), budget: newBudget };
                await updateSheetInFirestore(updatedCategories, expenses);
            } else {
                alert('Orçamento inválido.');
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

    // --- Add/Remove Individual Expenses Functions ---
    const addExpense = async () => {
        const val = parseFloat(valorGasto);
        if (val > 0 && categoriaSelecionada && categories.some(cat => cat.name === categoriaSelecionada)) {
            const newExpense = {
                id: Date.now(), // Unique ID for each expense
                categoria: categoriaSelecionada,
                valor: val,
                timestamp: new Date().toISOString()
            };
            const updatedExpenses = [...expenses, newExpense];
            await updateSheetInFirestore(categories, updatedExpenses);
            setValorGasto('');
            setCategoriaSelecionada('');
        } else {
            alert('Por favor, insira um valor válido e selecione uma categoria existente.');
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

    // --- Calculations for Summary Table and General Totals ---
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
                // If an expense is from a category that was removed, it won't be included in the category summary
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

    // --- Excel Export Function ---
    const exportToExcel = () => {
        if (!XLSX) {
            alert("A biblioteca de exportação Excel não foi carregada. Tente novamente mais tarde ou verifique a conexão.");
            return;
        }
        const dadosParaPlanilha = [];

        // Line 1: Title "CONTROLE DE GASTOS"
        dadosParaPlanilha.push(["", "CONTROLE DE GASTOS", "", ""]);
        // Line 2: Headers
        dadosParaPlanilha.push(["ITEM", "VALOR", "SALDO", "JÁ GASTEI"]);

        // Category data
        categories.forEach(cat => {
            const totals = categoryTotals[cat.name] || { budget: cat.budget, spent: 0, balance: 0 };
            dadosParaPlanilha.push([
                cat.name,
                totals.budget,
                totals.balance,
                totals.spent
            ]);
        });

        // Empty line for spacing
        dadosParaPlanilha.push([]);

        // Final Totals
        dadosParaPlanilha.push(["PREVISÃO DE GASTOS", "", totalPrevisaoGastos, ""]);
        dadosParaPlanilha.push(["JÁ GASTOS", totalJaGastos, "", ""]);
        dadosParaPlanilha.push(["SALDO", totalSaldo, "", ""]);

        const ws = XLSX.utils.aoa_to_sheet(dadosParaPlanilha);

        // --- Cell Merging Configurations ---
        ws['!merges'] = [
            { s: { r: 0, c: 1 }, e: { r: 0, c: 3 } }, // Title "CONTROLE DE GASTOS"
            { s: { r: dadosParaPlanilha.length - 3, c: 0 }, e: { r: dadosParaPlanilha.length - 3, c: 1 } } // PREVISAO DE GASTOS
        ];

        // --- Cell Styles (Bold, Colors, Currency Format) ---
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

        for (let i = 2; i < categories.length + 2; i++) { // Iterate over category data rows
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
        <div className="bg-white p-6 rounded-lg shadow-md my-8">
            {showConfirmModal && (
                <ConfirmModal
                    message={confirmMessage}
                    onConfirm={confirmAction}
                    onCancel={() => setShowConfirmModal(false)}
                />
            )}
            <button
                onClick={onBack}
                className="mb-4 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md transition duration-200"
            >
                ← Voltar para Minhas Planilhas
            </button>

            <h2 className="text-2xl font-semibold mb-6 text-blue-800">{sheet.name}</h2>
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}
            {loading && <p className="text-center text-blue-500 mb-4">Salvando...</p>}

            {/* Section for Category Configuration for this spreadsheet */}
            <section className="mb-8 p-4 border border-blue-200 rounded-lg bg-blue-50">
                <h3 className="text-xl font-medium mb-4 text-blue-700">Configurar Categorias e Orçamentos</h3>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <input
                        type="text"
                        placeholder="Nome da Categoria"
                        className="flex-grow px-3 py-2 border border-gray-300 rounded-md"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                    />
                    <input
                        type="number"
                        step="0.01"
                        placeholder="Orçamento (R$)"
                        className="w-full sm:w-32 px-3 py-2 border border-gray-300 rounded-md"
                        value={newCategoryBudget}
                        onChange={(e) => setNewCategoryBudget(e.target.value)}
                    />
                    <button
                        onClick={addCategory}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition duration-200"
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
                                            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-xs mr-2"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => handleRemoveCategory(index)} // Changed to use custom modal
                                            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md text-xs"
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

            {/* Section to Add Expense */}
            <section className="mb-8 p-4 border border-purple-200 rounded-lg bg-purple-50">
                <h3 className="text-xl font-medium mb-4 text-purple-700">Adicionar Novo Gasto</h3>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <input
                        type="number"
                        step="0.01"
                        placeholder="Valor (R$)"
                        className="flex-grow px-3 py-2 border border-gray-300 rounded-md"
                        value={valorGasto}
                        onChange={(e) => setValorGasto(e.target.value)}
                    />
                    <select
                        className="w-full sm:w-40 px-3 py-2 border border-gray-300 rounded-md"
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
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition duration-200"
                    >
                        Adicionar
                    </button>
                </div>
            </section>

            {/* Summary Table (now above the individual expenses list) */}
            <section className="mb-8 p-4 border border-green-200 rounded-lg bg-white shadow-sm">
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
                <div className="p-3 bg-gray-100 rounded-md">
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

            {/* List of Individual Expenses */}
            <section className="mb-8 p-4 border border-orange-200 rounded-lg bg-white shadow-sm">
                <h3 className="text-xl font-medium mb-4 text-orange-700">Detalhamento dos Gastos:</h3>
                {expenses.length === 0 ? (
                    <p className="text-center text-gray-500">Nenhum gasto registrado ainda para esta planilha.</p>
                ) : (
                    <ul className="space-y-2">
                        {expenses.map(exp => (
                            <li key={exp.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-md shadow-sm border border-gray-100">
                                <span className="text-gray-700">
                                    {exp.categoria}: R$ {exp.valor.toFixed(2).replace('.', ',')} ({new Date(exp.timestamp).toLocaleDateString()})
                                </span>
                                <button
                                    onClick={() => handleRemoveIndividualExpense(exp.id)} // Changed to use custom modal
                                    className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm transition duration-200"
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
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200 text-lg"
            >
                Exportar para Excel
            </button>
        </div>
    );
}

export default App;
