/* Moteur de match — module ES sans dépendance (navigateur et Node). */
/* =====================================================================
   MOTEUR DE MATCH 11 contre 11 — indépendant de l'affichage.
   Chaque joueur reçoit à chaque tick une "entrée" :
   {mx,my,sprint,pass,shoot,power,lob,tackle,press,help,auto}
   Un poste est tenu par controller:'human' (entrées venues de l'extérieur)
   ou controller:'bot' (entrées calculées ici par botThink).
   En ligne, ce même moteur tournera sur le serveur : chaque client envoie
   ses entrées, le serveur appelle step() et diffuse l'état.
   Déterministe : graine + entrées humaines => exactement le même match.
   Unités : mètres et secondes.
   ===================================================================== */
export const W=100,H=64,GOAL_W=7.32,BAR=2.44,BOX_D=16.5,BOX_W=40.3,SIX_D=5.5,SIX_W=18.32,CIRCLE=9.15,TPS=30,DT=1/TPS;
export const MIN_PTS=3,MAX_PTS=30,TOTAL_PTS=100;
export const OUT_ATTRS=['vitesse','endurance','force','dribble','passe','tir','defense','vision'];
export const GK_ATTRS=['reflexes','plongeon','placement','detente','jeuPied'];
export const ATTR_INFO={
  vitesse:['Vitesse','Course et accélération'],endurance:['Endurance','Énergie qui baisse moins vite'],
  force:['Force','Duels, épaule contre épaule, têtes'],dribble:['Dribble','Contrôle et conservation du ballon'],
  passe:['Passe','Précision des passes et centres'],tir:['Tir','Puissance et précision des frappes'],
  defense:['Défense','Réussite des tacles'],vision:['Vision','Choix de jeu (robots) et passes'],
  reflexes:['Réflexes','Chance d\'arrêter un tir'],plongeon:['Plongeon','Distance couverte pour un arrêt'],
  placement:['Placement','Position dans le but'],detente:['Détente','Vitesse de déplacement, ballons aériens'],
  jeuPied:['Jeu au pied','Relances et dégagements']
};
export const POSTES={ATT:{label:'Attaquant',slot:'BU1'},MIL:{label:'Milieu',slot:'MC1'},DEF:{label:'Défenseur',slot:'DC1'},GK:{label:'Gardien',slot:'GK'}};
export const ARCHETYPES={
  ATT:[{id:'renard',name:'Renard des surfaces',desc:'Finisseur, toujours bien placé',attrs:{vitesse:16,endurance:8,force:10,dribble:12,passe:6,tir:30,defense:3,vision:15}},
       {id:'fleche',name:'Flèche',desc:'Très rapide, élimine en dribble',attrs:{vitesse:28,endurance:10,force:5,dribble:20,passe:7,tir:20,defense:3,vision:7}}],
  MIL:[{id:'meneur',name:'Meneur de jeu',desc:'Passes et vision',attrs:{vitesse:8,endurance:12,force:5,dribble:18,passe:28,tir:8,defense:5,vision:16}},
       {id:'b2b',name:'Box-to-Box',desc:'Infatigable, partout sur le terrain',attrs:{vitesse:14,endurance:22,force:12,dribble:10,passe:14,tir:10,defense:12,vision:6}}],
  DEF:[{id:'roc',name:'Roc défensif',desc:'Gagne les duels',attrs:{vitesse:10,endurance:12,force:24,dribble:3,passe:8,tir:3,defense:30,vision:10}},
       {id:'relanceur',name:'Défenseur relanceur',desc:'Défend et relance proprement',attrs:{vitesse:12,endurance:12,force:12,dribble:8,passe:20,tir:3,defense:24,vision:9}}],
  GK:[{id:'reflexe',name:'Gardien réflexe',desc:'Arrêts spectaculaires',attrs:{reflexes:30,plongeon:25,placement:20,detente:15,jeuPied:10}},
      {id:'libero',name:'Gardien libéro',desc:'Relance comme un joueur de champ',attrs:{reflexes:22,plongeon:18,placement:20,detente:15,jeuPied:25}}]
};
/* 4-4-2 : position de base en fraction du terrain (x vers le but adverse, y en largeur) */
export const SLOTS=['GK','DG','DC1','DC2','DD','MG','MC1','MC2','MD','BU1','BU2'],NS=SLOTS.length;
export const BASE={GK:[0.025,0.5],DG:[0.2,0.13],DC1:[0.16,0.38],DC2:[0.16,0.62],DD:[0.2,0.87],MG:[0.37,0.13],MC1:[0.33,0.4],MC2:[0.33,0.6],MD:[0.37,0.87],BU1:[0.5,0.42],BU2:[0.5,0.58]};
export const SLOT_POSTE={GK:'GK',DG:'DEF',DC1:'DEF',DC2:'DEF',DD:'DEF',MG:'MIL',MC1:'MIL',MC2:'MIL',MD:'MIL',BU1:'ATT',BU2:'ATT'};
export const SLOT_ARCH={GK:'reflexe',DG:'relanceur',DC1:'roc',DC2:'roc',DD:'relanceur',MG:'b2b',MC1:'meneur',MC2:'b2b',MD:'b2b',BU1:'renard',BU2:'fleche'};
export const SLOT_NUM={GK:1,DG:3,DC1:4,DC2:5,DD:2,MG:11,MC1:8,MC2:6,MD:7,BU1:9,BU2:10};
export const NOINPUT={mx:0,my:0,sprint:false,pass:false,shoot:false,power:0,lob:false,tackle:false,press:false,help:false,auto:false};

export function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
export const clamp=(v,a,b)=>v<a?a:v>b?b:v;
/* Rendements décroissants : 3 pts -> 18, 10 -> 49, 20 -> 74, 30 -> 86 */
export const rating=v=>100*(1-Math.exp(-v/15));
export function attrsFor(poste){return poste==='GK'?GK_ATTRS:OUT_ATTRS;}
export function sumAttrs(p){return attrsFor(p.poste).reduce((s,k)=>s+(p.attrs[k]||0),0);}

/* Validation : la même fonction tournera côté serveur. Ne jamais faire confiance au client. */
export function validateProfile(p){
  const e=[];
  if(!p||typeof p!=='object')return['Profil manquant'];
  if(typeof p.name!=='string'||!p.name.trim()||p.name.trim().length>16)e.push('Nom : 1 à 16 caractères');
  if(!Number.isInteger(p.numero)||p.numero<1||p.numero>99)e.push('Numéro : entre 1 et 99');
  if(!POSTES[p.poste])return e.concat('Poste inconnu');
  const keys=attrsFor(p.poste),given=Object.keys(p.attrs||{});
  if(given.length!==keys.length||!keys.every(k=>given.includes(k)))e.push('Qualités incorrectes pour ce poste');
  let s=0;
  for(const k of keys){const v=p.attrs&&p.attrs[k];
    if(!Number.isInteger(v)||v<MIN_PTS||v>MAX_PTS)e.push(ATTR_INFO[k][0]+' : entre '+MIN_PTS+' et '+MAX_PTS);
    s+=v|0;}
  if(s!==TOTAL_PTS)e.push('Total : '+s+' au lieu de '+TOTAL_PTS);
  return e;
}
export function computeStats(pr){
  const a=pr.attrs,r=rating;
  if(pr.poste==='GK')return{vitesse:r(a.detente)*0.85,endurance:60,force:r(a.detente)*0.8,dribble:20,passe:r(a.jeuPied),tir:r(a.jeuPied)*0.9,defense:r(a.placement),vision:r(a.jeuPied),reflexes:r(a.reflexes),plongeon:r(a.plongeon),placement:r(a.placement)};
  const s={};for(const k of OUT_ATTRS)s[k]=r(a[k]);s.reflexes=s.plongeon=s.placement=0;return s;
}

export class Match{
  /* cfg = {seed, duration (s), kickoffTeam, teams:[{name, skill, slots:{<slot>:{profile, controller:'human'|'bot'}}}]} */
  constructor(cfg){
    this.cfg=cfg;this.rng=mulberry32(cfg.seed>>>0);this.botRng=mulberry32((cfg.seed^0x9E3779B9)>>>0);
    this.tick=0;this.maxTick=Math.round(cfg.duration*TPS);this.score=[0,0];this.events=[];this.over=false;this.freeze=0;this.help=[0,0];
    this.ball={x:W/2,y:H/2,z:0,vx:0,vy:0,vz:0,owner:-1,lastTouch:-1,passFrom:-1,shot:null};
    this.players=[];
    cfg.teams.forEach((t,ti)=>{for(const slot of SLOTS){const s=t.slots[slot];
      this.players.push({id:this.players.length,team:ti,slot,profile:s.profile,controller:s.controller,name:s.profile.name,numero:s.profile.numero,
        st:computeStats(s.profile),x:0,y:0,vx:0,vy:0,fx:ti===0?1:-1,fy:0,stamina:1,stun:0,pickupCd:0,tackleCd:0,kickCd:0,
        stats:{buts:0,tirs:0,passes:0,passesOk:0,tacles:0,taclesOk:0,ballons:0,arrets:0},bot:{next:0,hold:0}});}});
    this.kickoff(cfg.kickoffTeam||0);
  }
  sgn(team){return team===0?1:-1;}
  world(team,fx,fy){return team===0?[fx*W,fy*H]:[(1-fx)*W,(1-fy)*H];}
  gk(team){return this.players[team*NS];}
  emit(type,data){this.events.push(Object.assign({type,tick:this.tick},data||{}));}
  kickoff(team){
    for(const p of this.players){const[bx,by]=BASE[p.slot];const[x,y]=this.world(p.team,Math.min(bx,p.team===team?0.45:0.4),by);
      p.x=x;p.y=y;p.vx=p.vy=0;p.fx=p.team===0?1:-1;p.fy=0;p.stun=0;p.pickupCd=0;p.kickCd=0.3;}
    const a=this.players[team*NS+SLOTS.indexOf('BU1')],[x,y]=this.world(team,0.493,0.5);a.x=x;a.y=y;
    const b=this.ball;b.owner=a.id;b.vx=b.vy=b.vz=0;b.z=0;b.shot=null;b.passFrom=-1;b.lastTouch=a.id;this.syncBall();
    this.freeze=Math.round(1.0*TPS);this.emit('kickoff',{team});
  }
  step(inputs){
    if(this.over)return;
    const P=this.players,b=this.ball;
    const ins=P.map(p=>p.controller==='human'?((inputs&&inputs[p.id])||NOINPUT):botThink(this,p));
    for(const p of P){const inp=ins[p.id];if(p.controller!=='human')continue;
      if(inp.help)this.help[p.team]=this.tick+TPS*3;
      const idle=Math.hypot(inp.mx||0,inp.my||0)<0.2;
      if(b.owner===p.id)continue;
      if(inp.press)ins[p.id]=Object.assign({},inp,this.chaseInput(p,inp.sprint));
      else if(inp.auto&&idle)ins[p.id]=Object.assign({},inp,this.autoInput(p,inp.sprint));}
    if(this.freeze>0){this.freeze--;for(const p of P){p.vx*=0.5;p.vy*=0.5;}this.syncBall();this.tick++;this.checkEnd();return;}
    for(const p of P){p.stun=Math.max(0,p.stun-DT);p.pickupCd=Math.max(0,p.pickupCd-DT);p.tackleCd=Math.max(0,p.tackleCd-DT);p.kickCd=Math.max(0,p.kickCd-DT);}
    const n=P.length,start=this.tick%n;
    for(let k=0;k<n;k++){const p=P[(start+k)%n],inp=ins[p.id];if(p.stun>0.3)continue;
      if(b.owner===p.id){if(p.kickCd>0)continue;if(inp.shoot)this.shoot(p,inp);else if(inp.lob)this.lob(p,inp);else if(inp.pass)this.pass(p,inp);}
      else if(inp.tackle&&p.tackleCd<=0)this.tackle(p);}
    for(const p of P)this.move(p,ins[p.id]);
    this.collide();
    this.updateBall();
    this.saves();
    this.headers();
    this.pickup();
    this.tick++;this.checkEnd();
  }
  /* Pressing : aller vers le ballon sans que l'humain ait à diriger */
  chaseInput(p,sprint){
    const b=this.ball,tx=b.x+b.vx*0.25,ty=b.y+b.vy*0.25,dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy)||1,s=Math.min(1,d/1.2);
    return{mx:dx/d*s,my:dy/d*s,sprint:sprint||(d>4&&p.stamina>0.35)};
  }
  /* Auto-pressing (joystick lâché) : presse si le ballon est proche et pas à nous, sinon se replace */
  autoInput(p,sprint){
    const b=this.ball,own=b.owner>=0&&this.players[b.owner].team===p.team;
    let tx,ty;
    if(p.slot==='GK'){const sg=this.sgn(p.team);tx=(p.team===0?0:W)+sg*1.5;ty=H/2+clamp((b.y-H/2)*0.15,-GOAL_W*0.45,GOAL_W*0.45);}
    else if(!own&&Math.hypot(b.x-p.x,b.y-p.y)<24)return this.chaseInput(p,sprint);
    else[tx,ty]=this.formation(p,own);
    const dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy);if(d<0.4)return{mx:0,my:0,sprint:false};
    const s=Math.min(1,d/1.5);return{mx:dx/d*s,my:dy/d*s,sprint:sprint||(d>10&&p.stamina>0.5)};
  }
  checkEnd(){if(this.tick>=this.maxTick&&!this.over){this.over=true;this.emit('end');}}
  move(p,inp){
    let mx=inp.mx||0,my=inp.my||0;const m=Math.hypot(mx,my);if(m>1){mx/=m;my/=m;}
    const mag=Math.min(1,m),e=1.45-p.st.endurance/100;
    let top=(5.2+p.st.vitesse*0.04)*(0.72+0.28*p.stamina);
    if(inp.sprint&&mag>0.3&&p.stamina>0.04){top*=1.28;p.stamina-=DT*0.05*e;}
    else if(mag>0.5)p.stamina-=DT*0.004*e;else p.stamina+=DT*0.03;
    p.stamina=clamp(p.stamina,0,1);
    if(this.ball.owner===p.id)top*=0.84+p.st.dribble*0.0013;
    if(p.stun>0)top*=0.35;
    const k=Math.min(1,DT*(5+p.st.vitesse*0.05));
    p.vx+=(mx*top-p.vx)*k;p.vy+=(my*top-p.vy)*k;
    p.x=clamp(p.x+p.vx*DT,-1,W+1);p.y=clamp(p.y+p.vy*DT,-1,H+1);
    if(mag>0.15){const a=Math.hypot(mx,my),r=Math.min(1,DT*14);p.fx+=(mx/a-p.fx)*r;p.fy+=(my/a-p.fy)*r;const l=Math.hypot(p.fx,p.fy)||1;p.fx/=l;p.fy/=l;}
  }
  collide(){
    const P=this.players;
    for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){const a=P[i],c=P[j];let dx=c.x-a.x,dy=c.y-a.y;if(dx>1||dx<-1||dy>1||dy<-1)continue;const d=Math.hypot(dx,dy);
      if(d<1.0){if(d<1e-6){dx=1;dy=0;}else{dx/=d;dy/=d;}
        const o=1.0-d,fa=a.st.force+10,fc=c.st.force+10,wa=fc/(fa+fc),wc=fa/(fa+fc); /* la Force pousse l'autre */
        a.x-=dx*o*wa;a.y-=dy*o*wa;c.x+=dx*o*wc;c.y+=dy*o*wc;}}
  }
  syncBall(){const b=this.ball;if(b.owner>=0){const o=this.players[b.owner];b.x=clamp(o.x+o.fx*0.7,0.1,W-0.1);b.y=clamp(o.y+o.fy*0.7,0.1,H-0.1);b.vx=o.vx;b.vy=o.vy;b.z=0;b.vz=0;}}
  updateBall(){
    const b=this.ball;if(b.owner>=0){this.syncBall();return;}
    b.x+=b.vx*DT;b.y+=b.vy*DT;
    if(b.z>0||b.vz>0){b.z+=b.vz*DT;b.vz-=9.8*DT;if(b.z<=0){b.z=0;if(b.vz<-2.5){b.vz=-b.vz*0.45;b.vx*=0.85;b.vy*=0.85;}else b.vz=0;}}
    const air=b.z>0.05,f=Math.exp(-(air?0.12:(b.shot?0.5:1.1))*DT); /* en l'air ou en tir, le ballon freine moins */
    b.vx*=f;b.vy*=f;
    if(b.shot&&Math.hypot(b.vx,b.vy)<6&&b.z<0.1)b.shot=null;
    /* Sorties : but, touche, corner, sortie de but */
    if(b.x<0||b.x>W){const side=b.x<0?0:1;
      if(Math.abs(b.y-H/2)<GOAL_W/2&&b.z<BAR){this.goal(1-side);return;}
      const lt=b.lastTouch>=0?this.players[b.lastTouch].team:-1;
      if(lt===side)this.corner(1-side,b.y<H/2);else this.goalKick(side);return;}
    if(b.y<0||b.y>H){const lt=b.lastTouch>=0?this.players[b.lastTouch].team:1;
      this.restart(1-lt,clamp(b.x,1,W-1),b.y<0?0.4:H-0.4,'throw');}
  }
  /* Remise en jeu : le joueur de champ le plus proche vient la jouer, les adversaires reculent */
  restart(team,x,y,kind){
    let best=null,bd=1e9;
    for(const p of this.players){if(p.team!==team||p.slot==='GK')continue;const d=Math.hypot(p.x-x,p.y-y);if(d<bd){bd=d;best=p;}}
    best.x=x;best.y=y;best.vx=best.vy=0;const ux=W/2-x,uy=H/2-y,ul=Math.hypot(ux,uy)||1;best.fx=ux/ul;best.fy=uy/ul;
    for(const o of this.players){if(o.team===team)continue;const d=Math.hypot(o.x-x,o.y-y);if(d<6){const vx=(o.x-x)/(d||1),vy=(o.y-y)/(d||1);o.x=clamp(x+vx*6,0.5,W-0.5);o.y=clamp(y+vy*6,0.5,H-0.5);}}
    const b=this.ball;b.shot=null;b.passFrom=-1;this.take(best);best.kickCd=0.2;this.emit(kind,{team});this.freeze=Math.round(0.8*TPS);
  }
  corner(team,top){const x=team===0?W-0.4:0.4,y=top?0.4:H-0.4;this.restart(team,x,y,'corner');}
  goalKick(team){
    const g=this.gk(team);g.x=team===0?5.5:W-5.5;g.y=H/2;g.vx=g.vy=0;g.fx=this.sgn(team);g.fy=0;
    for(const p of this.players)if(p.team!==team&&Math.abs(p.x-(team===0?0:W))<BOX_D+1&&Math.abs(p.y-H/2)<BOX_W/2+1)p.x=team===0?BOX_D+2:W-BOX_D-2;
    const b=this.ball;b.shot=null;b.passFrom=-1;this.take(g);this.emit('goalkick',{team});this.freeze=Math.round(0.8*TPS);
  }
  goal(team){
    this.score[team]++;const b=this.ball,P=this.players;
    const sc=b.shot?P[b.shot.by]:(b.lastTouch>=0?P[b.lastTouch]:null);const own=!!sc&&sc.team!==team;
    if(sc&&!own)sc.stats.buts++;
    this.emit('goal',{team,scorer:sc?sc.id:-1,own});this.kickoff(1-team);
  }
  kick(p,ang,speed,vz){const b=this.ball;b.owner=-1;b.vx=Math.cos(ang)*speed;b.vy=Math.sin(ang)*speed;b.z=vz?0.05:0;b.vz=vz||0;
    b.x=clamp(p.x+Math.cos(ang)*0.75,0.1,W-0.1);b.y=clamp(p.y+Math.sin(ang)*0.75,0.1,H-0.1);
    b.lastTouch=p.id;b.passFrom=-1;b.shot=null;p.pickupCd=0.3;p.kickCd=0.35;}
  nearestOpp(p){let o=null,m=99;for(const q of this.players)if(q.team!==p.team){const d=Math.hypot(q.x-p.x,q.y-p.y);if(d<m){m=d;o=q;}}return{o,d:m};}
  shoot(p,inp){
    const gx=p.team===0?W:0,aimY=inp.aimY!=null?inp.aimY:H/2+clamp(inp.my||0,-1,1)*GOAL_W*0.38;
    const dx=gx-p.x,dy=aimY-p.y,d=Math.hypot(dx,dy),press=this.nearestOpp(p).d<2?1.3:1;
    /* Puissance (0..1) : bouton TIR maintenu plus ou moins longtemps. Trop fort = au-dessus. */
    const pw=clamp(inp.power||0.7,0.1,1);
    const err=((1-p.st.tir/100)*0.16+d/45*0.07)*press*(0.7+0.6*pw)*(this.rng()*2-1);
    const sp=(13+p.st.tir*0.09+pw*8)*(0.85+0.15*p.stamina);
    const vz=1+pw*pw*4.5+(pw>0.9?(pw-0.9)*30:0)+(1-p.st.tir/100)*this.rng()*2;
    this.kick(p,Math.atan2(dy,dx)+err,sp,vz);this.ball.shot={team:p.team,by:p.id,tried:false};p.stats.tirs++;this.emit('shot',{by:p.id});
  }
  laneOpen(a,c){let m=99;const dx=c.x-a.x,dy=c.y-a.y,L2=dx*dx+dy*dy||1;
    for(const o of this.players){if(o.team===a.team)continue;const u=clamp(((o.x-a.x)*dx+(o.y-a.y)*dy)/L2,0,1);const d=Math.hypot(a.x+dx*u-o.x,a.y+dy*u-o.y);if(d<m)m=d;}return m;}
  passTarget(p,dir,forBot){
    let best=null,bs=-1e9;const sg=this.sgn(p.team);
    for(const t of this.players){if(t.team!==p.team||t.id===p.id)continue;
      const dx=t.x-p.x,dy=t.y-p.y,d=Math.hypot(dx,dy);if(d<3||d>35)continue;
      const cos=(dx*dir[0]+dy*dir[1])/d,open=this.laneOpen(p,t);
      let s=cos*(forBot?1:3)+Math.min(open,4)*0.5-d*0.03;
      if(forBot)s+=clamp(dx*sg/10,-1,1.2)-(t.slot==='GK'?2:0);
      if(s>bs){bs=s;best=t;}}
    return best?{t:best,score:bs,open:this.laneOpen(p,best)}:null;
  }
  pass(p,inp){
    let t=null;
    if(inp.passTo!=null){t=this.players[inp.passTo];if(!t||t.team!==p.team||t.id===p.id)t=null;}
    if(!t){let dir=[inp.mx||0,inp.my||0];const m=Math.hypot(dir[0],dir[1]);dir=m>0.2?[dir[0]/m,dir[1]/m]:[p.fx,p.fy];
      const r=this.passTarget(p,dir,false);t=r?r.t:null;
      if(!t){this.kick(p,Math.atan2(dir[1],dir[0]),14);this.ball.passFrom=p.id;p.stats.passes++;this.emit('pass',{by:p.id});return;}}
    const d0=Math.hypot(t.x-p.x,t.y-p.y),sp0=clamp(6+d0*1.05,9,28),lead=d0/sp0*1.3;
    const tx=t.x+t.vx*lead,ty=t.y+t.vy*lead,d=Math.hypot(tx-p.x,ty-p.y),sp=clamp(6+d*1.05,9,28);
    const press=this.nearestOpp(p).d<2.2?1.4:1,err=(1-p.st.passe/100)*0.24*press*(this.rng()*2-1);
    this.kick(p,Math.atan2(ty-p.y,tx-p.x)+err,sp);this.ball.passFrom=p.id;p.stats.passes++;this.emit('pass',{by:p.id});
  }
  /* Passe en profondeur / centre : lobée, devant le receveur */
  lob(p,inp){
    const sg=this.sgn(p.team);let dir=[inp.mx||0,inp.my||0];const m=Math.hypot(dir[0],dir[1]);dir=m>0.2?[dir[0]/m,dir[1]/m]:[sg,0];
    let t=null;if(inp.passTo!=null){t=this.players[inp.passTo];if(!t||t.team!==p.team||t.id===p.id)t=null;}
    if(!t){const r=this.passTarget(p,dir,false);t=r?r.t:null;}
    let tx,ty;if(t){tx=t.x+t.vx*0.9+sg*3;ty=t.y+t.vy*0.9;}else{tx=p.x+dir[0]*20;ty=p.y+dir[1]*20;}
    tx=clamp(tx,1,W-1);ty=clamp(ty,1,H-1);
    const d=Math.hypot(tx-p.x,ty-p.y),sp=clamp(7+d*0.45,9,21),T=d/sp,q=1-p.st.passe/100;
    const err=q*0.2*(this.rng()*2-1),vz=4.9*T*(1+q*0.25*(this.rng()-0.5));
    this.kick(p,Math.atan2(ty-p.y,tx-p.x)+err,sp,vz);this.ball.passFrom=p.id;p.stats.passes++;this.emit('pass',{by:p.id,lob:true});
  }
  tackle(p){
    const b=this.ball;p.tackleCd=0.9;const o=b.owner>=0?this.players[b.owner]:null;
    if(!o||o.team===p.team||Math.hypot(o.x-p.x,o.y-p.y)>1.8){p.stun=0.2;return;}
    p.stats.tacles++;
    /* Duel : Défense (+ Force) du tacleur contre Dribble (+ Force) du porteur */
    const a=p.st.defense+0.35*p.st.force,dd=o.st.dribble+0.35*o.st.force,pr=clamp(a/(a+dd),0.12,0.88);
    if(this.rng()<pr){p.stats.taclesOk++;b.owner=-1;const ang=Math.atan2(p.fy,p.fx)+(this.rng()-0.5)*1.4;
      b.vx=Math.cos(ang)*5;b.vy=Math.sin(ang)*5;b.lastTouch=p.id;b.passFrom=-1;b.shot=null;o.stun=0.5;o.pickupCd=0.5;
      this.emit('tackle',{by:p.id,on:o.id,ok:true});}
    else{p.stun=0.7;this.emit('tackle',{by:p.id,on:o.id,ok:false});}
  }
  saves(){
    const b=this.ball;if(b.owner>=0||!b.shot||b.shot.tried||b.z>2.7)return;
    const g=this.gk(1-b.shot.team);if(g.stun>0.3)return;
    const d=Math.hypot(g.x-b.x,g.y-b.y,Math.max(0,b.z-1)*0.8),reach=0.8+g.st.plongeon*0.016;if(d>reach)return;
    b.shot.tried=true;const sp=Math.hypot(b.vx,b.vy);
    const pr=clamp(0.28+g.st.reflexes*0.0055+g.st.placement*0.0015-(sp-14)*0.03-(d/reach)*0.3,0.05,0.9);
    if(this.rng()<pr){g.stats.arrets++;
      if(sp<19&&this.rng()<0.3+g.st.reflexes*0.004){this.take(g);this.emit('save',{by:g.id,caught:true});}
      else{const dir=g.team===0?1:-1;b.vx=dir*Math.abs(b.vx)*0.35+(this.rng()-0.5)*4;b.vy=(this.rng()<0.5?-1:1)*(4+this.rng()*5);b.vz=Math.max(b.vz,2+this.rng()*3);
        b.lastTouch=g.id;g.pickupCd=0.4;this.emit('save',{by:g.id,caught:false});}}
    else g.pickupCd=0.4;
  }
  /* Jeu de tête : ballon aérien entre 1 et 2,5 m. Attaquant dans la surface = tête vers le but, sinon dégagement. */
  headers(){
    const b=this.ball;if(b.owner>=0||b.z<1.0||b.z>2.5||b.shot)return;
    let best=null,bd=0.9;
    for(const p of this.players){if(p.slot==='GK'||p.pickupCd>0||p.stun>0.3)continue;const d=Math.hypot(p.x-b.x,p.y-b.y);if(d<bd){bd=d;best=p;}}
    if(!best)return;const p=best,gx=p.team===0?W:0;
    if(this.rng()>0.45+p.st.force*0.004){p.pickupCd=0.3;return;}
    const inBox=Math.abs(gx-p.x)<BOX_D&&Math.abs(p.y-H/2)<BOX_W/2;
    if(inBox){const aim=H/2+(this.rng()-0.5)*GOAL_W*0.8,err=(1-p.st.tir/100)*0.25*(this.rng()*2-1);
      this.kick(p,Math.atan2(aim-p.y,gx-p.x)+err,12+p.st.force*0.06,1.2);b.z=1.6;b.shot={team:p.team,by:p.id,tried:false};p.stats.tirs++;this.emit('shot',{by:p.id,header:true});}
    else{this.kick(p,(p.team===0?0:Math.PI)+(this.rng()-0.5)*1.2,10+p.st.force*0.05,4);b.z=1.6;this.emit('header',{by:p.id});}
  }
  pickup(){
    const b=this.ball;if(b.owner>=0)return;let best=null,bd=0.95;
    for(const p of this.players){if(p.pickupCd>0||p.stun>0.3||b.z>(p.slot==='GK'?2.6:1.0))continue;const d=Math.hypot(p.x-b.x,p.y-b.y);if(d<bd){bd=d;best=p;}}
    if(!best)return;const sp=Math.hypot(b.vx,b.vy);
    if(b.shot&&best.team!==b.shot.team&&best.slot!=='GK'){
      /* Tir contré ? Rare : la Défense aide un peu. Sinon le ballon passe. */
      best.pickupCd=0.5;
      if(this.rng()<0.14+best.st.defense*0.0015){const a=Math.atan2(b.vy,b.vx)+(this.rng()-0.5)*2.2;b.vx=Math.cos(a)*sp*0.4;b.vy=Math.sin(a)*sp*0.4;b.lastTouch=best.id;b.shot=null;this.emit('block',{by:best.id});}
      return;}
    if(sp>11&&best.slot!=='GK'&&this.rng()>0.3+best.st.dribble*0.006){best.pickupCd=0.35;b.vx*=0.55;b.vy*=0.55;b.lastTouch=best.id;return;}
    this.take(best);
  }
  take(p){
    const b=this.ball;
    if(b.passFrom>=0){const f=this.players[b.passFrom];if(f.team===p.team&&f.id!==p.id)f.stats.passesOk++;}
    b.owner=p.id;b.shot=null;b.passFrom=-1;b.lastTouch=p.id;p.stats.ballons++;p.bot.hold=0;this.syncBall();
  }
  formation(p,att){
    const b=this.ball,team=p.team,[bx,by]=BASE[p.slot];
    const bf=team===0?b.x/W:1-b.x/W,bfy=team===0?b.y/H:1-b.y/H;
    let fx=bx+(att?0.13:-0.04)+(bf-0.5)*0.35;
    if(att&&(p.slot==='BU1'||p.slot==='BU2'))fx+=0.07;
    const fy=0.5+(by-0.5)*(att?1:0.8)+(bfy-0.5)*0.28;
    return this.world(team,clamp(fx,0.04,0.9),clamp(fy,0.04,0.96));
  }
  /* Le robot le plus proche d'un point (les humains décident seuls de presser ou non) */
  closestBot(team,x,y){let best=null,bd=1e9;for(const p of this.players){if(p.team!==team||p.slot==='GK'||p.controller!=='bot'||p.stun>0.3)continue;const d=Math.hypot(p.x-x,p.y-y);if(d<bd){bd=d;best=p;}}return best;}
  secondBot(team,x,y){const l=this.players.filter(p=>p.team===team&&p.slot!=='GK'&&p.controller==='bot'&&p.stun<=0.3).sort((a,c)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(c.x-x,c.y-y));return l[1]||null;}
  hash(){let h=this.score[0]*1000+this.score[1];for(const p of this.players)h+=p.x*0.731+p.y*1.337;return this.tick+':'+h.toFixed(4)+':'+this.ball.x.toFixed(4);}
}

/* ===================== IA DES ROBOTS ===================== */
export function botThink(m,p){
  const b=m.ball,P=m.players,team=p.team,sg=team===0?1:-1,oppGX=team===0?W:0,ownGX=team===0?0:W;
  const skill=m.cfg.teams[team].skill!=null?m.cfg.teams[team].skill:0.6,R=m.botRng;
  const inp={mx:0,my:0,sprint:false,pass:false,shoot:false,power:0,lob:false,tackle:false,press:false,help:false,auto:false};
  const think=m.tick>=p.bot.next;if(think)p.bot.next=m.tick+Math.round(9-5*skill)+Math.floor(R()*3);
  const owner=b.owner>=0?P[b.owner]:null;if(owner!==p)p.bot.hold=0;
  const goTo=(tx,ty,sprint)=>{const dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy);if(d>0.3){const s=Math.min(1,d/1.5)*(0.7+0.3*skill);inp.mx=dx/d*s;inp.my=dy/d*s;}inp.sprint=!!sprint&&d>3&&p.stamina>0.3;};
  const ef=(1-Math.exp(-1.1*0.4))/1.1,bpx=owner?b.x:b.x+b.vx*ef,bpy=owner?b.y:b.y+b.vy*ef;

  if(p.slot==='GK'){
    if(owner===p){p.bot.hold++;
      if(p.bot.hold>20&&think){const r=m.passTarget(p,[sg,0],true);
        if(r&&r.open>2.5){inp.pass=true;inp.passTo=r.t.id;}
        else{const fw=P.filter(q=>q.team===team&&(q.slot==='BU1'||q.slot==='BU2'||q.slot==='MC1'));inp.lob=true;inp.passTo=fw[Math.floor(R()*fw.length)].id;}}
      return inp;}
    const near=Math.abs(bpx-ownGX)<12&&Math.abs(bpy-H/2)<BOX_W*0.35;
    if(!owner&&near&&b.z<2.6){const c=m.closestBot(team,bpx,bpy),dc=c?Math.hypot(c.x-bpx,c.y-bpy):99;
      if(Math.hypot(p.x-bpx,p.y-bpy)<dc+1){goTo(bpx,bpy,true);return inp;}}
    goTo(ownGX+sg*1.5,H/2+clamp((b.y-H/2)*0.15,-GOAL_W*0.45,GOAL_W*0.45),false);return inp;
  }

  if(owner===p){
    const dG=Math.hypot(oppGX-p.x,H/2-p.y),near=m.nearestOpp(p);
    if(think&&p.kickCd<=0){
      if(dG<(skill<0.45?24:18)+p.st.tir*0.05&&R()<0.45+0.4*skill){inp.shoot=true;inp.power=0.5+0.35*R();const g=m.gk(1-team);inp.aimY=g.y<H/2?H/2+GOAL_W*0.36:H/2-GOAL_W*0.36;return inp;}
      /* Centre depuis le côté, près de la ligne de but */
      if(Math.abs(oppGX-p.x)<16&&Math.abs(p.y-H/2)>BOX_W/2-6&&R()<0.55){
        const tg=P.filter(q=>q.team===team&&q!==p&&q.slot!=='GK'&&Math.abs(oppGX-q.x)<BOX_D+2&&Math.abs(q.y-H/2)<BOX_W/2);
        if(tg.length){inp.lob=true;inp.passTo=tg[Math.floor(R()*tg.length)].id;return inp;}}
      const pressed=near.d<2.8;
      if(pressed||R()<0.06+p.st.vision*0.0015){const r=m.passTarget(p,[sg,0],true);
        if(r&&r.open>1.3&&(pressed||r.t.x*sg>p.x*sg+2)){let tgt=r.t;
          if(R()<(1-p.st.vision/100)*0.5*(1.4-skill)){const mates=P.filter(q=>q.team===team&&q!==p&&q.slot!=='GK');tgt=mates[Math.floor(R()*mates.length)];}
          inp.pass=true;inp.passTo=tgt.id;return inp;}
        if(r&&!pressed&&(r.t.x-p.x)*sg>12&&R()<0.3+0.3*skill){inp.lob=true;inp.passTo=r.t.id;return inp;}}
    }
    let dx=(oppGX-p.x),dy=(H/2-p.y);const d=Math.hypot(dx,dy)||1;dx/=d;dy/=d;
    if(near.d<4.5){const ax=(p.x-near.o.x)/near.d,ay=(p.y-near.o.y)/near.d,w=(4.5-near.d)/4.5*1.2;dx+=ax*w*0.3;dy+=ay*w;}
    if(p.y<3)dy+=0.6;else if(p.y>H-3)dy-=0.6;
    const n=Math.hypot(dx,dy)||1;inp.mx=dx/n;inp.my=dy/n;inp.sprint=p.stamina>0.35&&near.d<5;return inp;
  }
  const ours=owner&&owner.team===team;
  if(!ours){
    if(m.help[team]>m.tick&&m.secondBot(team,bpx,bpy)===p){goTo(bpx,bpy,true);return inp;}
    if(m.closestBot(team,bpx,bpy)===p){goTo(bpx,bpy,skill>=0.5||p.stamina>0.8);
      if(owner&&think&&p.tackleCd<=0&&Math.hypot(owner.x-p.x,owner.y-p.y)<1.6&&R()<0.3+0.55*skill)inp.tackle=true;return inp;}
    const[tx,ty]=m.formation(p,false);goTo(tx,ty,false);return inp;
  }
  const[tx,ty]=m.formation(p,true);goTo(tx,ty,false);return inp;
}
