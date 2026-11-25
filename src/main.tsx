import { createRoot } from 'react-dom/client';
import '../app/globals.css';
import { CampusLanguageProvider } from '@/components/campus-language';
import Page from '../app/page';

createRoot(document.getElementById('root')!).render(
  <CampusLanguageProvider>
    <Page />
  </CampusLanguageProvider>,
);
