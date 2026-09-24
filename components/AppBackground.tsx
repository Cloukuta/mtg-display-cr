type AppBackgroundProps={variant?:"rings-right"|"glow-corners"|"soft-radial"|"diamond"};

export default function AppBackground({variant="rings-right"}:AppBackgroundProps){
 return <div aria-hidden="true" className={`app-background app-background--${variant}`}>
   <span className="app-background__glow app-background__glow--one"/>
   <span className="app-background__glow app-background__glow--two"/>
   <span className="app-background__ring app-background__ring--one"/>
   <span className="app-background__ring app-background__ring--two"/>
   <span className="app-background__diamond"/>
 </div>;
}
