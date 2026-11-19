import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
    return (
        <main className="grid min-h-svh place-content-center gap-3 px-8 text-center">
            <h1 className="text-5xl font-semibold tracking-tight text-primary">MyCity</h1>
            <p className="text-lg text-muted-foreground">Sua cidade, sua voz.</p>
        </main>
    );
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
