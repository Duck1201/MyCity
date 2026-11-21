import { useEffect } from 'react';
import App from './app';
import './mobile-preview.css';

export default function WebPreview() {
    useEffect(() => {
        document.title = 'MyCity · App do cidadão';
    }, []);
    return (
        <main className="mobile-preview">
            <div className="mobile-screen">
                <App />
            </div>
        </main>
    );
}
