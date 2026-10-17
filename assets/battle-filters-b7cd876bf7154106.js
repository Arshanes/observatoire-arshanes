// Filtres et tris locaux : aucun appel API et aucune reconstruction des fiches.
(() => {
  const controls = document.querySelector('#battle-filters');
  if (!controls) return;
  const grid = document.querySelector('#batailles .battle-grid');
  const cards = Array.from(grid.querySelectorAll('.battle'));
  const initialOrder = new Map(cards.map((card,index) => [card,index]));
  const wins = controls.querySelector('[name="wins"]');
  const losses = controls.querySelector('[name="losses"]');
  const principal = controls.querySelector('[name="principal"]');
  const support = controls.querySelector('[name="support"]');
  const sort = controls.querySelector('[name="sort"]');
  const direction = controls.querySelector('[name="direction"]');
  const summary = document.querySelector('#battle-filter-summary');
  const emptyState = document.querySelector('#battle-empty');

  function updateVisibleBattles() {
    // OU dans chaque catégorie, ET entre résultat et rôle. Aucune case = tous les rôles/résultats.
    const hasResultFilter = wins.checked || losses.checked;
    const hasRoleFilter = principal.checked || support.checked;
    let visibleCount = 0;
    for (const card of cards) {
      const matchesResult = !hasResultFilter
        || (wins.checked && card.dataset.result === 'win')
        || (losses.checked && card.dataset.result === 'loss');
      const isPrincipal = card.dataset.principal === 'true';
      const matchesRole = !hasRoleFilter || (principal.checked && isPrincipal) || (support.checked && !isPrincipal);
      card.hidden = !(matchesResult && matchesRole);
      if (!card.hidden) visibleCount++;
    }
    const value = card => {
      const raw = card.dataset[sort.value];
      return raw !== undefined && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : null;
    };
    const sign = direction.value === 'desc' ? -1 : 1;
    const ordered = [...cards].sort((first,second) => {
      const a = value(first), b = value(second);
      // Une valeur inconnue reste à la fin, quel que soit le sens du tri.
      if (a === null && b !== null) return 1;
      if (b === null && a !== null) return -1;
      return (a !== null && b !== null ? (a-b)*sign : 0) || initialOrder.get(first)-initialOrder.get(second);
    });
    // Déplacer les éléments conserve les volets ouverts et leurs liens.
    for (const card of ordered) grid.appendChild(card);
    summary.textContent = `${visibleCount} bataille${visibleCount > 1 ? 's' : ''} affichée${visibleCount > 1 ? 's' : ''} sur ${cards.length}`;
    emptyState.hidden = visibleCount !== 0;
  }
  controls.addEventListener('change', event => {
    // Date : ordre chronologique ; dégâts et coût : les valeurs les plus élevées d'abord.
    if (event.target === sort) direction.value = sort.value === 'date' ? 'asc' : 'desc';
    updateVisibleBattles();
  });
  controls.querySelector('button').addEventListener('click', () => {
    wins.checked = losses.checked = principal.checked = support.checked = false;
    sort.value = 'date'; direction.value = 'asc';
    updateVisibleBattles();
  });
  updateVisibleBattles();
})();

// Les rubriques utilisent details/summary : elles restent repliables sans JS.
// Ouvrir la destination avant que le navigateur ne suive un lien du sommaire.
(() => {
  function reveal(hash){
    if(!hash||hash==='#')return;
    let target;
    try{target=document.getElementById(decodeURIComponent(hash.slice(1)));}catch{return;}
    if(!target)return;
    const ownCategory=target.querySelector(':scope > .report-category');
    if(ownCategory)ownCategory.open=true;
    for(let ancestor=target;ancestor;ancestor=ancestor.parentElement){
      if(ancestor instanceof HTMLDetailsElement)ancestor.open=true;
    }
    return target;
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href^="#"]');
    if(link&&!event.defaultPrevented&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey)reveal(link.hash);
  });
  window.addEventListener('hashchange',()=>{
    const target=reveal(location.hash);
    if(target)requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));
  });
  reveal(location.hash);
})();

// Élargir la fiche sans recréer son contenu ni fermer les listes déjà ouvertes.
// Animer les dimensions réelles de la fiche : ne jamais appliquer scale(), qui
// déforme aussi la hauteur du bandeau, les caractères et les icônes.
(() => {
  const grid=document.querySelector('#batailles .battle-grid');
  if(!grid)return;
  let settle=()=>{};
  const swaps=new Map();
  const cards=()=>Array.from(grid.querySelectorAll('.battle'));
  const applyOrder=()=>{
    const ordered=cards();
    for(const [opened,left] of swaps){
      const a=ordered.indexOf(opened),b=ordered.indexOf(left);
      if(a>=0&&b>=0)[ordered[a],ordered[b]]=[ordered[b],ordered[a]];
    }
    ordered.forEach((item,index)=>{item.style.order=String(index);});
  };
  const resetOrder=()=>{
    settle();swaps.clear();
    for(const item of cards())item.style.removeProperty('order');
  };
  // Une modification de la grille termine proprement la disposition précédente.
  window.addEventListener('resize',()=>settle());
  window.addEventListener('beforeprint',()=>settle());
  document.querySelector('#battle-filters')?.addEventListener('change',resetOrder,true);
  document.querySelector('#battle-filters button')?.addEventListener('click',resetOrder,true);
  grid.addEventListener('click',event=>{
    const summary=event.target.closest('.battle-details > summary');
    if(!summary||event.defaultPrevented)return;
    event.preventDefault();
    settle();
    const details=summary.parentElement,card=details.closest('.battle');
    const visible=Array.from(grid.querySelectorAll('.battle:not([hidden])'));
    const before=new Map(visible.map(item=>[item,item.getBoundingClientRect()]));
    // Une fiche de droite s'ouvre à la hauteur de sa propre rangée, avant sa
    // voisine gauche. À la fermeture, retrouver l'ordre initial de cette paire.
    const opening=!details.open,current=before.get(card);
    // Ouvrir ensuite la voisine gauche ne doit pas annuler le déplacement de
    // la fiche droite encore ouverte. Seule cette dernière restaure sa paire.
    if(swaps.has(card))swaps.delete(card);
    if(opening){
      const left=visible.find(item=>item!==card&&Math.abs(before.get(item).top-current.top)<1
        &&before.get(item).left<current.left-1);
      if(left)swaps.set(card,left);
    }
    details.open=!details.open;
    applyOrder();
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const after=new Map(visible.map(item=>[item,item.getBoundingClientRect()]));
    const origin=grid.getBoundingClientRect(),first=before.get(card),last=after.get(card);
    const originalStyle=card.style.cssText;
    const placeholder=document.createElement('div');
    placeholder.setAttribute('aria-hidden','true');
    placeholder.style.height=last.height+'px';
    placeholder.style.gridColumn=getComputedStyle(card).gridColumn;
    placeholder.style.order=getComputedStyle(card).order;
    // Réserver la place finale pendant que la fiche redimensionne son vrai cadre
    // au-dessus de la grille. Les cartes voisines se déplacent sans étirement.
    Object.assign(card.style,{position:'absolute',left:(last.left-origin.left)+'px',
      top:(last.top-origin.top)+'px',width:last.width+'px',height:last.height+'px',
      boxSizing:'border-box',zIndex:'1'});
    card.before(placeholder);
    const timing={duration:420,easing:'cubic-bezier(.22,1,.36,1)'};
    const animations=[];
    const animation=card.animate([
      {left:(first.left-origin.left)+'px',top:(first.top-origin.top)+'px',width:first.width+'px',height:first.height+'px'},
      {left:(last.left-origin.left)+'px',top:(last.top-origin.top)+'px',width:last.width+'px',height:last.height+'px'},
    ],timing);
    animations.push(animation);
    for(const item of visible){
      if(item===card)continue;
      const first=before.get(item),last=after.get(item);
      const dx=first.left-last.left,dy=first.top-last.top;
      if(Math.abs(dx)+Math.abs(dy)<.01)continue;
      animations.push(item.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],timing));
    }
    let finished=false;
    const finish=()=>{
      if(finished)return;finished=true;
      for(const active of animations)active.cancel();
      card.style.cssText=originalStyle;placeholder.remove();
      if(settle===finish)settle=()=>{};
    };
    settle=finish;
    animation.finished.then(finish).catch(()=>{});
  });
})();

// Les composants sont stockés une fois dans l’asset de données du rapport.
// Les listes sont créées seulement lors de leur ouverture, par lots de 50 éléments.
(() => {
  const source = window.wareraBattleBreakdowns;
  if (!source || !source.battles) return;
  const names = source.names || {players:{},countries:{},mus:{}};
  const number = (value, digits=0) => new Intl.NumberFormat('fr-FR', {maximumFractionDigits:digits}).format(Number(value));
  const node = (tag, text, className) => {
    const element=document.createElement(tag);
    if(text!==undefined)element.textContent=text;
    if(className)element.className=className;
    return element;
  };
  const link = (kind,id,text) => {
    const element=node('a');element.href='https://app.warera.io/'+kind+'/'+encodeURIComponent(id);
    if(kind==='user'||kind==='mu'){
      element.className='entity-label';
      const avatar=node('span',undefined,'entity-avatar');avatar.setAttribute('aria-hidden','true');
      avatar.append(node('span',Array.from(text.trim()).slice(0,2).join('').toLocaleUpperCase('fr'),'avatar-initials'));
      const sourceUrl=source.avatars?.[kind==='user'?'players':'mus']?.[id];
      try{
        const url=new URL(sourceUrl);
        if(url.protocol==='https:'&&url.hostname==='media.warera.io'&&url.pathname.startsWith('/avatars/')){
          const image=node('img');image.className='entity-avatar-image';image.src=url.href;
          image.alt='';image.width=image.height=28;image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';
          avatar.append(image);
        }
      }catch{/* L'initiale reste visible lorsque l'URL manque. */}
      element.append(avatar,node('span',text,'entity-name'));
    }else element.textContent=text;
    element.target='_blank';element.rel='noopener noreferrer';
    if(kind==='mu'){
      const country=names.muCountries?.[id],raw=source.countryCodes?.[country];
      const code=raw?.toLowerCase()==='uk'?'gb':raw;
      if(country&&code&&/^[a-z]{2}$/i.test(code)){
        const identity=node('span',undefined,'mu-identity');
        const flag=link('country',country,code.toUpperCase().split('').map(c=>String.fromCodePoint(c.charCodeAt(0)+127397)).join(''));
        flag.className='country-flag avatar-country';flag.title=names.countries[country]||'Pays de la MU';
        flag.setAttribute('aria-label',flag.title);identity.append(element,flag);return identity;
      }
    }
    return element;
  };
  const value = (amount,kind='money',digits=0) => {
    const span=node('span',undefined,'value-with-icon');span.append(node('span',number(amount,digits)));
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('class','value-icon');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
    const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','#value-'+kind);
    svg.append(use);span.append(svg);return span;
  };
  const statuses={active:'En cours',won:'Remporté',expiredNoBids:'Expiré — non pris',expiredBattle:'Bataille terminée',expiredRound:'Manche terminée',cancelled:'Annulé',terminated:'Terminé'};
  const won = camp => camp.contracts.filter(c=>c.status==='won'&&c.winner);
  const sum = entries => entries.reduce((total,e)=>total+Number(e.amount),0);

  function describe(metric,camp,entries) {
    if(metric==='contractDamage')return entries.length+' MU ayant remporté un contrat. Total de leurs dégâts dans ce camp, surplus inclus. Le surplus dépasse les objectifs cumulés des contrats de chaque MU ; il ne permet pas de dater les coups hors contrat.';
    if(metric==='bountyDamage')return entries.length+' bénéficiaires de primes. Somme de leurs dégâts dans ce camp, chaque joueur compté une seule fois.';
    if(metric==='priceMean'){
      const damage=sum(camp.contractUnits||[]),amount=sum(won(camp));
      return number(amount)+' BTC ÷ '+number(damage)+' dégâts × 1 000 = '+(damage>0?number(amount*1000/damage,4)+' BTC / 1 000 dégâts.':'indisponible.');
    }
    if(metric==='countries')return entries.length+' pays ayant infligé des dégâts.';
    if(metric==='awarded'||metric==='forge')return entries.length+' contrats remportés. Somme attribuée : '+number(sum(entries))+' BTC.';
    if(metric==='bounties')return entries.length+' bénéficiaires. Total reçu : '+number(sum(entries))+' BTC. Chaque prime est rattachée au camp où son bénéficiaire a le plus frappé.';
    const isDamage=metric.startsWith('damage'), median=metric.endsWith('Median');
    const amounts=entries.map(e=>Number(e.amount));
    if(!amounts.length)return isDamage?'Aucun dégât enregistré.':'Aucun contrat remporté.';
    if(!median)return number(sum(entries),isDamage?0:4)+' '+(isDamage?'dégâts':'BTC / 1 000 dégâts')+' ÷ '+entries.length+' = '+number(sum(entries)/entries.length,isDamage?0:4)+(isDamage?' dégâts par soldat.':' BTC / 1 000 dégâts par contrat.');
    const middle=Math.floor(entries.length/2), selected=entries.length%2?[amounts[middle]]:[amounts[middle-1],amounts[middle]];
    return 'Valeur'+(selected.length>1?'s centrales':' centrale')+' sur '+entries.length+' : '+selected.map(v=>number(v,isDamage?0:4)).join(' et ')+'. '+(selected.length===2?'La médiane est leur moyenne.':'')+' Les éléments centraux sont mis en évidence.';
  }

  function prepare(metric,camp) {
    let entries;
    if(metric==='countries')entries=camp.countries.map(e=>({...e,kind:'country'}));
    else if(metric==='contractDamage')entries=(camp.contractUnits||[]).map(e=>({...e,kind:'mu'}));
    else if(metric==='bountyDamage')entries=(camp.bountyDamage||[]).map(e=>({...e,kind:'user'}));
    else if(metric==='bounties')entries=camp.bounties.map(e=>({...e,kind:'user'}));
    else if(metric.startsWith('damage'))entries=camp.players.map(e=>({...e,kind:'user'}));
    else {
      const contracts=metric==='created'?camp.contracts:won(camp).filter(c=>metric!=='forge'||c.forge);
      entries=contracts.map(c=>({...c,kind:'contract',amount:metric==='created'?c.budget:c.amount}));
    }
    const median=metric.endsWith('Median');
    entries.sort((a,b)=>median?Number(a.amount)-Number(b.amount):Number(b.amount)-Number(a.amount));
    if(median&&entries.length){
      const middle=Math.floor(entries.length/2);entries[middle].central=true;
      if(entries.length%2===0)entries[middle-1].central=true;
    }
    return entries;
  }

  function renderItem(entry,metric) {
    const li=node('li',undefined,entry.central?'median-item':undefined),top=node('div',undefined,'breakdown-item-top');
    const label=node('span',undefined,'breakdown-item-label');
    if(entry.kind==='country'){
      const rawCode=source.countryCodes?.[entry.id];
      const code=rawCode?.toLowerCase()==='uk'?'gb':rawCode;
      if(code&&/^[a-z]{2}$/i.test(code)){
        const flag=node('span',code.toUpperCase().split('').map(c=>String.fromCodePoint(c.charCodeAt(0)+127397)).join(''),'country-flag');
        flag.setAttribute('aria-hidden','true');label.append(flag,document.createTextNode(' '));
      }
      label.append(link('country',entry.id,names.countries[entry.id]||'Pays #'+entry.id.slice(-6)));
    }else if(entry.kind==='user')label.append(link('user',entry.id,names.players[entry.id]||'Combattant #'+entry.id.slice(-6)));
    else if(entry.kind==='mu')label.append(link('mu',entry.id,names.mus[entry.id]||'MU #'+entry.id.slice(-6)));
    else {
      // Le destinataire est l'information principale ; l'identifiant reste en
      // infobulle et dans la recherche, sans attribuer une MU aux contrats non pris.
      if(entry.winner&&entry.status!=='expiredNoBids')label.append(link('mu',entry.winner,names.mus[entry.winner]||'Unité militaire'));
      else label.textContent='Non attribué';
      label.title='Contrat #'+entry.id;
    }
    const damage=metric==='countries'||metric.startsWith('damage')||metric==='contractDamage'||metric==='bountyDamage';
    top.append(label);
    if(entry.kind==='contract'){
      top.classList.add('contract-heading');
      const status=node('span',statuses[entry.status]||entry.status,'contract-status');
      status.dataset.status=entry.status;top.append(status);
    }
    if(!(entry.kind==='contract'&&metric==='created')&&metric!=='contractDamage')top.append(value(entry.amount,damage?'damage':'money'));
    li.append(top);
    if(metric==='contractDamage'){
      const terms=node('dl',undefined,'contract-terms mu-damage-terms');
      const total=node('dd'),bonus=node('dd',undefined,'mu-damage-surplus');
      total.append(value(entry.amount,'damage'));
      if(entry.bonusDamage!=null)bonus.append(value(entry.bonusDamage,'damage'));
      else bonus.textContent='—';
      terms.append(node('dt','Dégâts totaux'),total,node('dt','Dont surplus'),bonus);li.append(terms);
    }
    if(entry.kind==='contract'&&metric==='created'){
      // Les trois valeurs partagent les mêmes colonnes, la même taille de texte
      // et le même alignement, y compris lorsque les libellés passent à la ligne.
      const terms=node('dl',undefined,'contract-terms');
      const amount=node('dd'),damage=node('dd'),price=node('dd');
      amount.append(value(entry.budget,'money'));
      const expected=entry.expectedDamage!=null?Number(entry.expectedDamage):null;
      if(expected!==null&&Number.isFinite(expected))damage.append(value(expected,'damage'));
      else damage.append(document.createTextNode('—'));
      // Le montant de cette liste est le budget proposé : son tarif doit donc
      // utiliser le même budget, plutôt que le tarif final de l'enchère gagnée.
      if(expected!==null&&expected>0)price.append(value(Number(entry.budget)*1000/expected,'money',4));
      else price.append(document.createTextNode('—'));
      terms.append(node('dt','Montant'),amount,node('dt','Dégâts attendus'),damage,node('dt','Prix / 1 000 dégâts'),price);li.append(terms);
    }
    return li;
  }

  function renderCamp(container,heading,camp,metric) {
    const searchable=metric==='created'||metric==='contractDamage',contracts=metric==='created';
    const column=node('section',undefined,'breakdown-camp');column.append(node('h4',heading));
    const allEntries=prepare(metric,camp);let entries=allEntries;
    if(metric!=='created')column.append(node('p',describe(metric,camp,entries),'breakdown-description'));
    if(!entries.length&&!searchable){column.append(node('p','Aucun élément.','breakdown-description'));container.append(column);return;}
    const list=node('ol',undefined,'breakdown-items');list.setAttribute('aria-label',heading+' : liste détaillée');
    const more=node('button',undefined,'breakdown-more');more.type='button';let shown=0;
    function appendNext(){
      const end=Math.min(shown+50,entries.length);
      for(;shown<end;shown++)list.append(renderItem(entries[shown],metric));
      more.hidden=shown===entries.length;more.textContent='Afficher la suite ('+shown+' / '+entries.length+')';
    }
    if(searchable){
      const label=node('label',undefined,'breakdown-search');
      label.append(node('span',contracts?'Rechercher un contrat':'Rechercher une MU'));
      const search=node('input');search.type='search';search.placeholder=contracts?'MU, pays, montant, statut…':'MU, pays, dégâts, surplus…';
      search.setAttribute('aria-label',(contracts?'Rechercher dans les contrats — ':'Rechercher dans les dégâts des MU sous contrat — ')+heading);
      label.append(search);column.append(label);
      const feedback=node('p','', 'breakdown-search-status');feedback.setAttribute('role','status');
      feedback.setAttribute('aria-live','polite');feedback.setAttribute('aria-atomic','true');
      const empty=node('p',contracts?'Aucun contrat ne correspond à cette recherche.':'Aucune MU ne correspond à cette recherche.','breakdown-description');
      empty.hidden=entries.length>0;
      // Indexer tous les contrats, y compris ceux des pages non encore affichées,
      // sans créer leur DOM. Accepter les accents et formats numériques usuels.
      const normalize=text=>String(text??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
        .toLocaleLowerCase('fr').replace(/(\d)[\s\u00a0\u202f]+(?=\d)/g,'$1')
        .replace(/(\d)\.(?=\d)/g,'$1,').trim();
      const indexes=new Map(allEntries.map(entry=>{
        // Ne pas indexer une ancienne MU candidate comme bénéficiaire d'un
        // contrat non pris, même lors du rendu d'un ancien relevé non migré.
        const winner=contracts?(entry.status==='expiredNoBids'?undefined:entry.winner):entry.id;
        const country=names.muCountries?.[winner],expected=Number(entry.expectedDamage);
        const price=expected>0?Number(entry.budget)*1000/expected:null;
        const fields=[entry.id,'Contrat #'+entry.id.slice(-6),entry.status,statuses[entry.status],
          names.mus[winner],names.countries[country],source.countryCodes?.[country],
          entry.budget,number(entry.budget),entry.expectedDamage,
          entry.expectedDamage!=null?number(entry.expectedDamage):'',price,price!==null?number(price,4):'',
          ...(!contracts?[entry.amount,number(entry.amount),entry.bonusDamage,entry.bonusDamage!=null?number(entry.bonusDamage):'']:[])];
        return [entry,fields.map(normalize).join(' | ')];
      }));
      search.addEventListener('input',()=>{
        const terms=normalize(search.value).split(/\s+/).filter(Boolean);
        entries=allEntries.filter(entry=>terms.every(term=>indexes.get(entry).includes(term)));
        list.replaceChildren();list.scrollTop=0;shown=0;appendNext();
        empty.hidden=entries.length>0;
        feedback.textContent=terms.length?entries.length+' résultat'+(entries.length>1?'s':''):'';
      });
      column.append(feedback,empty);
    }
    more.addEventListener('click',appendNext);appendNext();column.append(list,more);
    if(metric.endsWith('Median')){
      const jump=node('button','Voir les valeurs centrales','breakdown-more');jump.type='button';
      jump.addEventListener('click',()=>{
        const middle=Math.floor(entries.length/2);
        while(shown<=middle)appendNext();
        const item=list.querySelector('.median-item');
        if(item)list.scrollTop=Math.max(0,item.offsetTop-list.clientHeight/2);
      });
      column.append(jump);
    }
    container.append(column);
  }

  document.addEventListener('click',event=>{
    const row=event.target.closest('.battle-metric-row');if(!row)return;
    const button=row.querySelector('.battle-row-toggle');if(!button)return;
    const panelRow=document.getElementById(button.getAttribute('aria-controls'));
    const body=panelRow.querySelector('.battle-row-breakdown'),open=button.getAttribute('aria-expanded')!=='true';
    if(open&&!body.dataset.loaded){
      const battle=source.battles[body.dataset.battle];if(!battle)return;
      const side=battle.franceSide||'attacker',other=side==='attacker'?'defender':'attacker';
      const columns=node('div',undefined,'breakdown-camps'+(['created','contractDamage'].includes(body.dataset.metric)?' uniform-values':''));
      renderCamp(columns,'Alliés',battle[side],body.dataset.metric);
      renderCamp(columns,'Adversaires',battle[other],body.dataset.metric);
      body.append(columns);body.dataset.loaded='true';
    }
    button.setAttribute('aria-expanded',String(open));panelRow.hidden=!open;
  });
})();

// Infobulle locale : les valeurs exactes sont celles qui dessinent la barre.
// Le total Alliés récapitule France/FORGE/Autres et ne s'ajoute pas à ces groupes.
(() => {
  const bars=document.querySelectorAll('.battle .damage-bar[data-france]');
  if(!bars.length)return;
  const node=(tag,text,className)=>{
    const element=document.createElement(tag);
    if(text!==undefined)element.textContent=text;
    if(className)element.className=className;
    return element;
  };
  const integer=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0});
  const percent=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1});
  const tooltip=node('div',undefined,'profile-chart-tooltip battle-chart-tooltip');
  tooltip.id='battle-chart-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;document.body.append(tooltip);
  let active;
  const hide=()=>{tooltip.hidden=true;active?.removeAttribute('aria-describedby');active=undefined;};
  function damage(amount){
    const value=node('span',undefined,'value-with-icon');value.append(node('span',integer.format(amount)));
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('class','value-icon');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
    const use=document.createElementNS(svg.namespaceURI,'use');use.setAttribute('href','#value-damage');svg.append(use);value.append(svg);return value;
  }
  function show(bar,x,y){
    if(active!==bar||tooltip.hidden){
      active?.removeAttribute('aria-describedby');active=bar;
      const values=['france','forge','other','adversaries'].map(key=>Number(bar.dataset[key]));
      if(values.some(value=>!Number.isFinite(value)||value<0)){hide();return;}
      const total=values.reduce((sum,value)=>sum+value,0),allies=values[0]+values[1]+values[2];
      tooltip.replaceChildren(node('strong',bar.closest('.battle').querySelector('header h3').textContent));
      const list=node('dl');
      [['France','france-segment'],['FORGE','forge-segment'],['Autres','allies-segment'],['Adversaires','adverse-segment']].forEach(([label,color],index)=>{
        const row=node('div',undefined,'profile-tip-row'),term=node('dt'),value=node('dd');
        term.append(node('span',undefined,'battle-legend-swatch '+color),document.createTextNode(label));
        value.append(damage(values[index]),node('small',percent.format(total?values[index]*100/total:0)+' %','battle-tip-share'));
        row.append(term,value);list.append(row);
      });
      for(const [label,amount] of [['Alliés',allies],['Total des deux camps',total]]){
        const row=node('div',undefined,'profile-tip-row profile-tip-total'),value=node('dd');value.append(damage(amount));
        row.append(node('dt',label),value);list.append(row);
      }
      tooltip.append(list);tooltip.hidden=false;bar.setAttribute('aria-describedby',tooltip.id);
    }
    const box=tooltip.getBoundingClientRect(),gap=14,margin=12;
    const left=x+gap+box.width>innerWidth-margin?x-box.width-gap:x+gap;
    const top=y+gap+box.height>innerHeight-margin?y-box.height-gap:y+gap;
    tooltip.style.left=Math.max(margin,Math.min(left,innerWidth-box.width-margin))+'px';
    tooltip.style.top=Math.max(margin,Math.min(top,innerHeight-box.height-margin))+'px';
  }
  for(const bar of bars){
    bar.addEventListener('pointerenter',event=>show(bar,event.clientX,event.clientY));
    bar.addEventListener('pointermove',event=>show(bar,event.clientX,event.clientY));
    bar.addEventListener('pointerleave',hide);
    bar.addEventListener('focus',()=>{const box=bar.getBoundingClientRect();show(bar,box.left+box.width/2,box.bottom);});
    bar.addEventListener('blur',hide);
    bar.addEventListener('click',event=>{if(event.pointerType==='touch')show(bar,event.clientX,event.clientY);});
  }
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('.battle .damage-bar'))hide();});
  window.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);
})();

// Listes de citoyens : chargement du DOM à l'ouverture, recherche sur tous les
// éléments et pagination locale. Aucun appel à l'API depuis le navigateur.
(() => {
  const source=window.wareraBattleBreakdowns;
  if(!source?.profilePlayers)return;
  const pillPlayers=new Set(source.pillPlayerIds||[]);
  const node=(tag,text,className)=>{
    const element=document.createElement(tag);
    if(text!==undefined)element.textContent=text;
    if(className)element.className=className;
    return element;
  };
  const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').trim();
  const percent=value=>value===null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(value)+' %';
  function identity(player){
    const link=node('a',undefined,'entity-label');
    link.href='https://app.warera.io/user/'+encodeURIComponent(player.id);link.target='_blank';link.rel='noopener noreferrer';
    const avatar=node('span',undefined,'entity-avatar');avatar.setAttribute('aria-hidden','true');
    avatar.append(node('span',Array.from(player.name).slice(0,2).join('').toLocaleUpperCase('fr'),'avatar-initials'));
    try{
      const url=new URL(source.avatars?.players[player.id]);
      if(url.protocol==='https:'&&url.hostname==='media.warera.io'&&url.pathname.startsWith('/avatars/')){
        const image=node('img');image.className='entity-avatar-image';image.src=url.href;image.alt='';
        image.width=image.height=28;image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';avatar.append(image);
      }
    }catch{/* Les initiales restent visibles en l'absence d'avatar. */}
    const portrait=node('span',undefined,'profile-player-portrait');portrait.append(avatar);
    if(pillPlayers.has(player.id)){
      // Un simple repère à côté du portrait, sans quantité ni colonne dédiée.
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('class','profile-pill-badge');svg.setAttribute('viewBox','0 0 24 24');
      svg.setAttribute('role','img');svg.setAttribute('aria-label','Achat de pilules pendant la semaine ou usine de pilules au relevé');
      const title=document.createElementNS(svg.namespaceURI,'title');title.textContent=svg.getAttribute('aria-label');
      const path=document.createElementNS(svg.namespaceURI,'path');
      path.setAttribute('d','M4.22,11.29L11.29,4.22C13.64,1.88 17.43,1.88 19.78,4.22C22.12,6.56 22.12,10.36 19.78,12.71L12.71,19.78C10.36,22.12 6.56,22.12 4.22,19.78C1.88,17.43 1.88,13.64 4.22,11.29M5.64,12.71C4.59,13.75 4.24,15.24 4.6,16.57L10.59,10.59L14.83,14.83L18.36,11.29C19.93,9.73 19.93,7.2 18.36,5.64C16.8,4.07 14.27,4.07 12.71,5.64L5.64,12.71Z');
      svg.append(title,path);portrait.append(svg);
    }
    link.append(portrait,node('span',player.name,'entity-name'));return link;
  }
  function populate(panel){
    const all=[...(source.profilePlayers[panel.dataset.profile]||[])].sort((a,b)=>(b.level??-1)-(a.level??-1)||a.name.localeCompare(b.name,'fr'));
    let entries=all,shown=0;
    const label=node('label',undefined,'breakdown-search');label.append(node('span','Rechercher un joueur'));
    const search=node('input');search.type='search';search.placeholder='Pseudo, niveau, part combat ou économie…';
    search.setAttribute('aria-label','Rechercher un joueur dans ce profil');label.append(search);
    const feedback=node('p','', 'breakdown-search-status');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
    const scroll=node('div',undefined,'profile-player-scroll');scroll.tabIndex=0;
    scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Liste des joueurs de ce profil');
    const table=node('table',undefined,'profile-player-table'),head=node('thead'),header=node('tr');
    for(const title of ['Joueur','Niveau','Combat','Économie']){const cell=node('th',title);cell.scope='col';header.append(cell);}
    head.append(header);const body=node('tbody');table.append(head,body);scroll.append(table);
    const empty=node('p','Aucun joueur ne correspond à cette recherche.','breakdown-description');empty.hidden=true;
    const more=node('button',undefined,'breakdown-more');more.type='button';
    function appendNext(){
      const end=Math.min(shown+50,entries.length);
      for(;shown<end;shown++){
        const player=entries[shown],row=node('tr'),name=node('td');name.append(identity(player));
        row.append(name,node('td',player.level??'—'),node('td',percent(player.combatPercent)),node('td',percent(player.economyPercent)));
        body.append(row);
      }
      more.hidden=shown===entries.length;more.textContent='Afficher la suite ('+shown+' / '+entries.length+')';
      feedback.textContent=entries.length+' joueur'+(entries.length>1?'s':'');empty.hidden=entries.length>0;
    }
    const indexes=new Map(all.map(player=>[player,normalize([player.id,player.name,player.level,percent(player.combatPercent),percent(player.economyPercent)].join(' | '))]));
    search.addEventListener('input',()=>{
      const terms=normalize(search.value).split(/\s+/).filter(Boolean);
      entries=all.filter(player=>terms.every(term=>indexes.get(player).includes(term)));
      shown=0;body.replaceChildren();scroll.scrollTop=0;appendNext();
    });
    more.addEventListener('click',appendNext);appendNext();
    panel.append(label,node('p','Les colonnes Combat et Économie indiquent la part des points investis.','breakdown-description'),feedback,scroll,empty,more);
    panel.dataset.loaded='true';
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('.profile-summary .battle-row-toggle');if(!button)return;
    const row=document.getElementById(button.getAttribute('aria-controls')),panel=row.querySelector('.profile-players-panel');
    const open=button.getAttribute('aria-expanded')!=='true';
    if(open&&!panel.dataset.loaded)populate(panel);
    row.hidden=!open;button.setAttribute('aria-expanded',String(open));
  });
})();

// Une seule infobulle pour tout l'histogramme. Position fixe pour éviter le
// rognage par le cadre défilant ; accès au survol, au clavier et au toucher.
(() => {
  const bars=document.querySelectorAll('.profile-chart-bar');
  if(!bars.length)return;
  const node=(tag,text,className)=>{
    const element=document.createElement(tag);
    if(text!==undefined)element.textContent=text;
    if(className)element.className=className;
    return element;
  };
  const tooltip=node('div',undefined,'profile-chart-tooltip');
  tooltip.id='profile-chart-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;
  document.body.append(tooltip);let active;
  function hide(){tooltip.hidden=true;active?.removeAttribute('aria-describedby');active=undefined;}
  function position(x,y){
    const box=tooltip.getBoundingClientRect(),gap=14,margin=12;
    const left=x+gap+box.width>innerWidth-margin?x-box.width-gap:x+gap;
    const top=y+gap+box.height>innerHeight-margin?y-box.height-gap:y+gap;
    tooltip.style.left=Math.max(margin,Math.min(left,innerWidth-box.width-margin))+'px';
    tooltip.style.top=Math.max(margin,Math.min(top,innerHeight-box.height-margin))+'px';
  }
  function show(bar,x,y){
    if(active!==bar||tooltip.hidden){
      active?.removeAttribute('aria-describedby');active=bar;
      tooltip.replaceChildren(node('strong','Niveaux '+bar.dataset.levels));
      const list=node('dl');
      const rows=[['Combat','combat'],...(bar.dataset.pills!==''?[['dont achats / usine de pilules','pills']]:[]),
        ['Hybride','hybrid'],...(bar.dataset.hybridPills!==''?[['dont achats / usine de pilules','hybridPills']]:[]),['Économie','economy'],['Données indisponibles','unavailable']];
      for(const [label,key] of rows){
        const row=node('div',undefined,'profile-tip-row'+(key==='pills'||key==='hybridPills'?' profile-tip-subrow':''));
        const term=node('dt'),swatch=node('span',undefined,'profile-swatch'+(key==='pills'?' profile-swatch-pill':key==='hybridPills'?' profile-swatch-hybrid-pill':key==='hybrid'?' profile-swatch-hybrid':''));
        if(key!=='pills'&&key!=='hybridPills')swatch.style.background='var(--profile-'+key+')';
        term.append(swatch,document.createTextNode(label));row.append(term,node('dd',bar.dataset[key]));list.append(row);
      }
      const total=node('div',undefined,'profile-tip-row profile-tip-total');
      total.append(node('dt','Total'),node('dd',bar.dataset.total));list.append(total);tooltip.append(list);
      tooltip.hidden=false;bar.setAttribute('aria-describedby',tooltip.id);
    }
    position(x,y);
  }
  for(const bar of bars){
    bar.addEventListener('pointerenter',event=>show(bar,event.clientX,event.clientY));
    bar.addEventListener('pointermove',event=>show(bar,event.clientX,event.clientY));
    bar.addEventListener('pointerleave',hide);
    bar.addEventListener('focus',()=>{const box=bar.getBoundingClientRect();show(bar,box.left+box.width/2,box.top+30);});
    bar.addEventListener('blur',hide);
    bar.addEventListener('click',event=>{if(event.pointerType==='touch')show(bar,event.clientX,event.clientY);});
  }
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('.profile-chart-bar'))hide();});
  window.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);
})();

// Garder une taille stable et des initiales lisibles si le média distant disparaît.
(() => {
  const hideBroken=image=>{
    if(image instanceof HTMLImageElement&&image.classList.contains('entity-avatar-image'))image.hidden=true;
  };
  document.addEventListener('error',event=>hideBroken(event.target),true);
  for(const image of document.querySelectorAll('.entity-avatar-image')){
    if(image.complete&&!image.naturalWidth)hideBroken(image);
  }
})();
