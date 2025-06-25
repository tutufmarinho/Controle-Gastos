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
    updateDoc,
    deleteDoc,
    onSnapshot
} from 'firebase/firestore';

// Carrega a biblioteca SheetJS para exportação de Excel
const XLSX = typeof window !== 'undefined' ? window.XLSX : null;

// Sua configuração do Firebase (copiada diretamente do seu console Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyDnQO4XWaZtw1C7_Z8yKafELcdM4cJRLs4",
  authDomain: "controle-gastos-d1cec.firebaseapp.com",
  projectId: "controle-gastos-d1cec",
  storageBucket: "controle-gastos-d1cec.firebasestorage.app",
  messagingSenderId: "1098535347473",
  appId: "1:1098535347473:web:644cff53a3f8cb0c4658b0",
  measurementId: "G-NMNM4Y68X5"
};

// Identificador único para a sua aplicação dentro do Firestore.
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
                // alert('Registro realizado com sucesso! Faça login.'); // Removido
                setIsRegistering(false); // Volta para a tela de login
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                // alert('Login realizado com sucesso!'); // Removido
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
            setLoadingAuth(false); // Garante que o loading seja desativado em qualquer caso
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
    co
