export default function OfflinePage(){
 return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,background:'#f7f7f2',color:'#173f35'}}>
  <section style={{width:'min(560px,100%)',background:'white',borderRadius:24,padding:32,boxShadow:'0 18px 60px rgba(23,63,53,.12)',textAlign:'center'}}>
   <div style={{fontSize:54}}>🛠️</div>
   <h1 style={{margin:'12px 0 8px'}}>Je bent offline</h1>
   <p style={{lineHeight:1.6,color:'#49655e'}}>Eerder geopende onderdelen van KlusHulp Noord blijven beschikbaar. Voor nieuwe gegevens, synchronisatie en verzending is opnieuw internet nodig.</p>
   <a href="/" style={{display:'inline-block',marginTop:16,padding:'12px 18px',borderRadius:999,background:'#173f35',color:'white',fontWeight:800,textDecoration:'none'}}>Opnieuw proberen</a>
  </section>
 </main>;
}
