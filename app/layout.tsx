import type {Metadata,Viewport} from 'next';
import './globals.css';
import './version-v7.css';
import './facturatie-v10.css';
import './werkbonnen-v10.css';
import './sprint-1-v10.css';
import './dashboard-v11.css';
import './customers-v15.css';
import PwaRegister from '@/components/PwaRegister';
import ModuleLauncher from '@/components/ModuleLauncher';
import CustomerRouteBridge from '@/components/customers/CustomerRouteBridge';

export const metadata:Metadata={
 title:'KlusHulp Noord Back Office',
 description:'De dagelijkse bedrijfsadministratie van eenmanszaak KlusHulp Noord',
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
 return <html lang="nl"><body><ModuleLauncher/><CustomerRouteBridge/>{children}<PwaRegister/></body></html>;
}
