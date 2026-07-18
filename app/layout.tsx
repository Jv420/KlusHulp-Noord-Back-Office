import type {Metadata,Viewport} from 'next';
import './globals.css';
import './version-v7.css';
import './facturatie-v10.css';
import './werkbonnen-v10.css';
import './sprint-1-v10.css';
import PwaRegister from '@/components/PwaRegister';
import ModuleLauncher from '@/components/ModuleLauncher';

export const metadata:Metadata={
 title:'KlusHulp Noord Back Office v10',
 description:'Geïntegreerde ERP, planning, werkbonnen, facturatie, voorraad en bedrijfsbeheer voor KlusHulp Noord',
 manifest:'/manifest.webmanifest',
 appleWebApp:{capable:true,statusBarStyle:'default',title:'KlusHulp Noord'},
 icons:{icon:'/icons/icon-192.svg',apple:'/icons/icon-192.svg'}
};

export const viewport:Viewport={
 themeColor:'#173f35',
 width:'device-width',
 initialScale:1,
 viewportFit:'cover'
};

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="nl"><body><ModuleLauncher/>{children}<PwaRegister/></body></html>;
}
