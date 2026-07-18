import type {Metadata,Viewport} from 'next';
import './globals.css';
import './version-v7.css';
import PwaRegister from '@/components/PwaRegister';
import ModuleLauncher from '@/components/ModuleLauncher';

export const metadata:Metadata={
 title:'KlusHulp Noord Back Office v9.4',
 description:'Complete mobiele backoffice voor KlusHulp Noord',
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
 return <html lang="nl"><body>{children}<ModuleLauncher/><PwaRegister/></body></html>;
}
