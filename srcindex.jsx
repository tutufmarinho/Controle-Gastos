import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Importa o seu componente principal App

// Seleciona o elemento div com id "root" onde o aplicativo React será montado
const root = ReactDOM.createRoot(document.getElementById('root'));

// Renderiza o componente App dentro do elemento "root"
// React.StrictMode ajuda a identificar potenciais problemas no seu aplicativo
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
