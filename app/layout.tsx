import './globals.css';
import './version-v7.css';

export const metadata={
 title:'KlusHulp Noord Administratie v7',
 description:'ERP en administratie voor KlusHulp Noord'
};

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="nl"><body>{children}</body></html>
}
