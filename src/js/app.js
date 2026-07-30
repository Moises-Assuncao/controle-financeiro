/* =========================================================
   FLUXO — Controle Financeiro Pessoal
   Home -> Login (Google via Firebase ou modo local) -> App
   ========================================================= */

   const STORAGE_KEY = 'fluxo_db_v1';
   const DEFAULT_CATEGORIES = ['Moradia','Alimentação','Transporte','Saúde','Educação','Lazer','Assinaturas','Cartão de Crédito','Outros'];
   const TIPOS_CONTA = ['Cartão de Crédito','Boleto','Financiamento','Empréstimo','Serviço/Assinatura','Utilidade (água/luz/internet)','Outro'];
   
   let DB = null;
   let currentTab = 'dashboard';
   let fbApp=null, fbAuth=null, fbDb=null, fbUser=null;
   let firebaseReady = false;
   
   /* ---------- utils ---------- */
   function uid(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36);}
   function fmtBRL(n){ n = Number(n)||0; return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
   function fmtDate(iso){ if(!iso) return '—'; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; }
   function monthKeyToLabel(key){
     const [y,m]=key.split('-'); const names=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
     return `${names[parseInt(m,10)-1]} de ${y}`;
   }
   function currentMonthKey(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
   function nextMonthKey(key){ let [y,m]=key.split('-').map(Number); m++; if(m>12){m=1;y++;} return y+'-'+String(m).padStart(2,'0'); }
   function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.style.display='block'; clearTimeout(window.__toastT); window.__toastT=setTimeout(()=>t.style.display='none',2800); }
   async function sha256(text){ const enc=new TextEncoder().encode(text); const buf=await crypto.subtle.digest('SHA-256',enc); return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
   
   /* ---------- persistence ---------- */
   function blankMonth(){ return {income:[], expenses:[], bills:[], closed:false}; }
   function blankDB(){ return { passwordHash:null, categories:[...DEFAULT_CATEGORIES], currentMonth:currentMonthKey(), months:{}, firebase:true }; }
   function loadLocalDB(){
     const raw = localStorage.getItem(STORAGE_KEY);
     if(raw){ try{ return JSON.parse(raw); }catch(e){} }
     return null;
   }
   function saveDB(){
     localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
     syncToCloud();
   }
   function ensureMonth(key){ if(!DB.months[key]) DB.months[key]=blankMonth(); }
   
   /* ---------- boot ---------- */
   window.addEventListener('DOMContentLoaded', ()=>{
     const cfg = window.FIREBASE_CONFIG;
     const configured = !!(cfg && cfg.apiKey);
     if(configured){ initFirebase(cfg); }
     showHome();
     document.getElementById('gBtnLabel').textContent = configured ? 'Entrar com Google' : 'Google ainda não configurado';
     if(!configured){
       document.getElementById('googleBtn').disabled = true;
       document.getElementById('googleBtn').style.opacity = .5;
       document.getElementById('googleHint').style.display='block';
     }
   });
   
   /* ---------- views: home / login / app ---------- */
   function showHome(){
     document.getElementById('homeScreen').style.display='block';
     document.getElementById('loginScreen').style.display='none';
     document.getElementById('app').style.display='none';
   }
   function showLogin(){
     document.getElementById('homeScreen').style.display='none';
     document.getElementById('loginScreen').style.display='flex';
     document.getElementById('app').style.display='none';
     document.getElementById('loginError').textContent='';
     // decide local block state
     const local = loadLocalDB();
     document.getElementById('localSetupBlock').style.display = local ? 'none' : 'block';
     document.getElementById('localLoginBlock').style.display = local ? 'none' : 'none';
     document.getElementById('localToggleWrap').style.display = 'block';
     document.getElementById('localArea').style.display = 'none';
   }
   function toggleLocalArea(){
     const el = document.getElementById('localArea');
     const local = loadLocalDB();
     el.style.display = el.style.display==='none' ? 'block' : 'none';
     document.getElementById('localSetupBlock').style.display = local ? 'none' : 'block';
     document.getElementById('localLoginBlock').style.display = local ? 'block' : 'none';
   }
   
   /* ---------- Google auth (Firebase) ---------- */
   function initFirebase(config){
     try{
       fbApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
       fbAuth = firebase.auth();
       fbDb = firebase.firestore();
       firebaseReady = true;
       fbAuth.onAuthStateChanged(u=>{
         fbUser = u;
         if(u && currentTab && document.getElementById('app').style.display==='block'){
           renderSidebar();
         }
       });
     }catch(e){ console.warn('Firebase init falhou', e); }
   }
   function signInGoogle(){
     if(!firebaseReady){ toast('Configure o Firebase primeiro (arquivo firebase-config.js).'); return; }
     const provider = new firebase.auth.GoogleAuthProvider();
     fbAuth.signInWithPopup(provider).then(async (result)=>{
       fbUser = result.user;
       await pullOrCreateCloudDB();
       enterApp();
       toast('Conectado como '+fbUser.email);
     }).catch(e=>{ document.getElementById('loginError').textContent = 'Falha ao conectar: '+e.message; });
   }
   async function pullOrCreateCloudDB(){
     const docRef = fbDb.collection('fluxo_users').doc(fbUser.uid);
     const doc = await docRef.get();
     if(doc.exists){
       DB = doc.data();
     } else {
       DB = blankDB();
       await docRef.set(DB);
     }
     ensureMonth(DB.currentMonth);
     localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
   }
   function syncToCloud(){
     if(!fbDb || !fbUser) return;
     fbDb.collection('fluxo_users').doc(fbUser.uid).set(DB).catch(e=>console.warn(e));
   }
   function signOutGoogle(){
     if(fbAuth) fbAuth.signOut();
     fbUser = null;
   }
   
   /* ---------- local (offline) auth ---------- */
   async function doSetupPassword(){
     const p1=document.getElementById('setupPass').value;
     const p2=document.getElementById('setupPass2').value;
     const err=document.getElementById('loginError'); err.textContent='';
     if(p1.length<4){ err.textContent='A senha precisa ter ao menos 4 caracteres.'; return; }
     if(p1!==p2){ err.textContent='As senhas não coincidem.'; return; }
     const hash = await sha256(p1);
     DB = { passwordHash:hash, categories:[...DEFAULT_CATEGORIES], currentMonth:currentMonthKey(), months:{}, firebase:false };
     ensureMonth(DB.currentMonth);
     localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
     enterApp();
   }
   async function doLogin(){
     const p = document.getElementById('loginPass').value;
     const err=document.getElementById('loginError');
     const local = loadLocalDB();
     const hash = await sha256(p);
     if(local && hash === local.passwordHash){ DB = local; err.textContent=''; enterApp(); }
     else{ err.textContent='Senha incorreta.'; }
   }
   
   function lockApp(){
     if(fbUser) signOutGoogle();
     DB = null;
     document.getElementById('app').style.display='none';
     showLogin();
   }
   
   function enterApp(){
     document.getElementById('loginScreen').style.display='none';
     document.getElementById('homeScreen').style.display='none';
     document.getElementById('app').style.display='block';
     ensureMonth(DB.currentMonth);
     renderSidebar();
     goTab('dashboard');
   }
   
   /* ---------- navigation ---------- */
   const TABS = [
     {id:'dashboard', label:'Dashboard', sub:'visão geral'},
     {id:'despesas', label:'Despesas', sub:'gastos do mês'},
     {id:'renda', label:'Renda', sub:'opcional'},
     {id:'contas', label:'Contas a Pagar', sub:'boletos e faturas'},
     {id:'credito', label:'Análise de Crédito', sub:'cartões'},
     {id:'historico', label:'Histórico', sub:'meses fechados'},
     {id:'config', label:'Configurações', sub:'categorias · conta'},
   ];
   
   function renderSidebar(){
     document.getElementById('monthPill').textContent = '● '+monthKeyToLabel(DB.currentMonth);
     const acct = document.getElementById('acctPill');
     if(fbUser){ acct.innerHTML = `<img src="${fbUser.photoURL||''}" onerror="this.style.display='none'"> ${fbUser.email}`; }
     else { acct.textContent = '👤 Modo local (neste aparelho)'; }
     const nav = document.getElementById('navPipeline');
     nav.innerHTML = TABS.map(t=>`
       <div class="nav-node ${t.id===currentTab?'active':''}" onclick="goTab('${t.id}')">
         <span class="dotwrap"><span class="nd"></span></span>
         <span>${t.label}<span class="lbl-sub">${t.sub}</span></span>
       </div>`).join('');
   }
   function toggleSidebar(){ document.getElementById('sidebar').classList.toggle('open'); }
   
   function goTab(id){
     currentTab = id;
     document.getElementById('sidebar').classList.remove('open');
     renderSidebar();
     const meta = TABS.find(t=>t.id===id);
     document.getElementById('pageTitle').textContent = meta.label;
     document.getElementById('crumb').textContent = 'Fluxo / '+meta.sub;
     const actions = document.getElementById('topbarActions');
     actions.innerHTML='';
     if(id==='dashboard' || id==='despesas' || id==='contas'){
       actions.innerHTML = `<button class="btn btn-ghost" onclick="openPrintPreview()">📄 Ver A4</button><button class="btn btn-primary" onclick="openPrintPreview(true)">🖨 Imprimir / PDF</button>`;
     }
     renderTab(id);
   }
   function renderTab(id){
     const c = document.getElementById('content');
     if(id==='dashboard') c.innerHTML = viewDashboard();
     if(id==='despesas') c.innerHTML = viewDespesas();
     if(id==='renda') c.innerHTML = viewRenda();
     if(id==='contas') c.innerHTML = viewContas();
     if(id==='credito') c.innerHTML = viewCredito();
     if(id==='historico') c.innerHTML = viewHistorico();
     if(id==='config') c.innerHTML = viewConfig();
     if(id==='dashboard') setTimeout(drawDashboardCharts,0);
   }
   
   /* ---------- derived data ---------- */
   function monthData(key){ ensureMonth(key); return DB.months[key]; }
   function totalIncome(m){ return m.income.reduce((s,i)=>s+Number(i.valor||0),0); }
   function totalExpenses(m){ return m.expenses.reduce((s,e)=>s+Number(e.valor||0),0); }
   function totalBills(m){ return m.bills.reduce((s,b)=>s+Number(b.valor||0),0); }
   function totalOut(m){ return totalExpenses(m)+totalBills(m); }
   function categoryBreakdown(m){
     const map={};
     m.expenses.forEach(e=>{ map[e.categoria]=(map[e.categoria]||0)+Number(e.valor||0); });
     m.bills.forEach(b=>{ const k='Conta: '+b.tipoConta; map[k]=(map[k]||0)+Number(b.valor||0); });
     return map;
   }
   
   /* ---------- DASHBOARD ---------- */
   function viewDashboard(){
     const m = monthData(DB.currentMonth);
     const inc = totalIncome(m), out = totalOut(m), saldo = inc-out;
     const pend = m.bills.filter(b=>b.situacao!=='Pago');
     const pendVal = pend.reduce((s,b)=>s+Number(b.valor||0),0);
     return `
     <div class="grid grid-4 section-gap">
       <div class="card stat-card"><div class="k">Renda do mês</div><div class="v pos">${fmtBRL(inc)}</div><div class="d">${m.income.length} lançamento(s)</div></div>
       <div class="card stat-card"><div class="k">Despesas totais</div><div class="v neg">${fmtBRL(out)}</div><div class="d">${m.expenses.length} despesas + ${m.bills.length} contas</div></div>
       <div class="card stat-card"><div class="k">Saldo do mês</div><div class="v ${saldo>=0?'pos':'neg'}">${fmtBRL(saldo)}</div><div class="d">${saldo>=0?'resultado positivo':'resultado negativo'}</div></div>
       <div class="card stat-card"><div class="k">Contas pendentes</div><div class="v" style="color:var(--amber)">${fmtBRL(pendVal)}</div><div class="d">${pend.length} conta(s) em aberto</div></div>
     </div>
     <div class="grid grid-2">
       <div class="card">
         <h3>Despesas por categoria <span class="tag">${monthKeyToLabel(DB.currentMonth)}</span></h3>
         <canvas id="chartCat" height="220"></canvas>
       </div>
       <div class="card">
         <h3>Próximos vencimentos</h3>
         ${pend.slice().sort((a,b)=>a.dataVencimento.localeCompare(b.dataVencimento)).slice(0,6).map(b=>`
           <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line-soft);font-size:13px;">
             <div><div>${b.fornecedor}</div><div class="small-muted mono">${fmtDate(b.dataVencimento)}</div></div>
             <div class="mono" style="color:var(--amber)">${fmtBRL(b.valor)}</div>
           </div>`).join('') || '<p class="small-muted">Nenhuma conta pendente 🎉</p>'}
       </div>
     </div>
     <div class="card" style="margin-top:16px;">
       <h3>Últimos 6 meses <span class="tag">renda vs despesa</span></h3>
       <canvas id="chartTrend" height="90"></canvas>
     </div>`;
   }
   function drawDashboardCharts(){
     const m = monthData(DB.currentMonth);
     const breakdown = categoryBreakdown(m);
     const labels = Object.keys(breakdown);
     const data = Object.values(breakdown);
     const palette = ['#00e5a0','#4da3ff','#ffb020','#ff5c6a','#a78bfa','#f472b6','#2dd4bf','#facc15','#fb7185','#38bdf8'];
     const catCanvas = document.getElementById('chartCat');
     if(catCanvas){
       if(!labels.length){
         catCanvas.parentElement.insertAdjacentHTML('beforeend','<p class="small-muted" style="text-align:center;margin-top:20px;">Sem despesas lançadas ainda.</p>');
       } else {
         new Chart(catCanvas, {
           type:'doughnut',
           data:{ labels, datasets:[{data, backgroundColor:palette, borderColor:'#12161e', borderWidth:2}] },
           options:{ plugins:{legend:{position:'bottom', labels:{color:'#8b93a3', font:{size:11}}}} }
         });
       }
     }
     const keys=[]; let k=DB.currentMonth;
     for(let i=0;i<6;i++){ keys.unshift(k); const [y,mo]=k.split('-').map(Number); let py=y, pm=mo-1; if(pm<1){pm=12;py--;} k=py+'-'+String(pm).padStart(2,'0'); }
     const incomes = keys.map(kk=>DB.months[kk]?totalIncome(DB.months[kk]):0);
     const expenses = keys.map(kk=>DB.months[kk]?totalOut(DB.months[kk]):0);
     const trendCanvas = document.getElementById('chartTrend');
     if(trendCanvas){
       new Chart(trendCanvas, {
         type:'bar',
         data:{ labels:keys.map(monthKeyToLabel), datasets:[
           {label:'Renda', data:incomes, backgroundColor:'#00e5a0'},
           {label:'Despesas', data:expenses, backgroundColor:'#ff5c6a'}
         ]},
         options:{ scales:{ x:{ticks:{color:'#8b93a3'},grid:{color:'#1b202a'}}, y:{ticks:{color:'#8b93a3'},grid:{color:'#1b202a'}} }, plugins:{legend:{labels:{color:'#8b93a3'}}} }
       });
     }
   }
   
   /* ---------- DESPESAS ---------- */
   function viewDespesas(){
     const m = monthData(DB.currentMonth);
     const rows = m.expenses.slice().sort((a,b)=>b.data.localeCompare(a.data));
     return `
     <div class="card">
       <h3>Despesas de ${monthKeyToLabel(DB.currentMonth)} <span class="tag">${rows.length} registro(s)</span>
         <button class="btn btn-primary" style="margin-left:auto;" onclick="openExpenseModal()">+ Nova despesa</button>
       </h3>
       <div class="tablewrap"><table>
         <thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Valor</th><th></th></tr></thead>
         <tbody>
           ${rows.length? rows.map(e=>`
             <tr>
               <td>${e.descricao}</td>
               <td><span class="cat-chip">${e.categoria}</span></td>
               <td class="mono">${fmtDate(e.data)}</td>
               <td class="mono">${fmtBRL(e.valor)}</td>
               <td><div class="row-actions">
                 <button class="icon-btn" onclick="openExpenseModal('${e.id}')">✎</button>
                 <button class="icon-btn" onclick="deleteExpense('${e.id}')">🗑</button>
               </div></td>
             </tr>`).join('') : `<tr class="empty-row"><td colspan="5">Nenhuma despesa lançada este mês.</td></tr>`}
         </tbody>
       </table></div>
     </div>`;
   }
   function openExpenseModal(id){
     const m = monthData(DB.currentMonth);
     const item = id ? m.expenses.find(e=>e.id===id) : null;
     const catsOpt = DB.categories.map(c=>`<option ${item&&item.categoria===c?'selected':''}>${c}</option>`).join('');
     showModal(`
       <div class="modal-head"><h3>${item?'Editar despesa':'Nova despesa'}</h3><button class="close-x" onclick="closeModal()">✕</button></div>
       <div class="field"><label>Descrição</label><input id="fDesc" value="${item?item.descricao:''}" placeholder="Ex: Supermercado"></div>
       <div class="two-col">
         <div class="field"><label>Categoria</label><select id="fCat">${catsOpt}</select></div>
         <div class="field"><label>Data</label><input type="date" id="fData" value="${item?item.data:new Date().toISOString().slice(0,10)}"></div>
       </div>
       <div class="field"><label>Valor (R$)</label><input type="number" step="0.01" id="fValor" value="${item?item.valor:''}" placeholder="0,00"></div>
       <div class="modal-foot">
         <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
         <button class="btn btn-primary" onclick="saveExpense('${item?item.id:''}')">Salvar</button>
       </div>`);
   }
   function saveExpense(id){
     const m = monthData(DB.currentMonth);
     const desc=document.getElementById('fDesc').value.trim();
     const cat=document.getElementById('fCat').value;
     const data=document.getElementById('fData').value;
     const valor=parseFloat(document.getElementById('fValor').value)||0;
     if(!desc||!data){ toast('Preencha descrição e data.'); return; }
     if(id){ const e=m.expenses.find(x=>x.id===id); Object.assign(e,{descricao:desc,categoria:cat,data,valor}); }
     else{ m.expenses.push({id:uid(),descricao:desc,categoria:cat,data,valor}); }
     saveDB(); closeModal(); renderTab('despesas'); toast('Despesa salva.');
   }
   function deleteExpense(id){
     const m = monthData(DB.currentMonth);
     m.expenses = m.expenses.filter(e=>e.id!==id);
     saveDB(); renderTab('despesas'); toast('Despesa removida.');
   }
   
   /* ---------- RENDA ---------- */
   function viewRenda(){
     const m = monthData(DB.currentMonth);
     const rows = m.income.slice().sort((a,b)=>b.data.localeCompare(a.data));
     return `
     <div class="card">
       <h3>Renda de ${monthKeyToLabel(DB.currentMonth)} <span class="tag">opcional</span>
         <button class="btn btn-primary" style="margin-left:auto;" onclick="openIncomeModal()">+ Nova renda</button>
       </h3>
       <div class="tablewrap"><table>
         <thead><tr><th>Descrição</th><th>Data</th><th>Valor</th><th></th></tr></thead>
         <tbody>
           ${rows.length? rows.map(i=>`
             <tr><td>${i.descricao}</td><td class="mono">${fmtDate(i.data)}</td><td class="mono" style="color:var(--accent)">${fmtBRL(i.valor)}</td>
             <td><div class="row-actions">
               <button class="icon-btn" onclick="openIncomeModal('${i.id}')">✎</button>
               <button class="icon-btn" onclick="deleteIncome('${i.id}')">🗑</button>
             </div></td></tr>`).join('') : `<tr class="empty-row"><td colspan="4">Nenhuma renda lançada este mês.</td></tr>`}
         </tbody>
       </table></div>
     </div>`;
   }
   function openIncomeModal(id){
     const m = monthData(DB.currentMonth);
     const item = id ? m.income.find(e=>e.id===id) : null;
     showModal(`
       <div class="modal-head"><h3>${item?'Editar renda':'Nova renda'}</h3><button class="close-x" onclick="closeModal()">✕</button></div>
       <div class="field"><label>Descrição</label><input id="iDesc" value="${item?item.descricao:''}" placeholder="Ex: Salário, freelance..."></div>
       <div class="two-col">
         <div class="field"><label>Data</label><input type="date" id="iData" value="${item?item.data:new Date().toISOString().slice(0,10)}"></div>
         <div class="field"><label>Valor (R$)</label><input type="number" step="0.01" id="iValor" value="${item?item.valor:''}"></div>
       </div>
       <div class="modal-foot">
         <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
         <button class="btn btn-primary" onclick="saveIncome('${item?item.id:''}')">Salvar</button>
       </div>`);
   }
   function saveIncome(id){
     const m = monthData(DB.currentMonth);
     const desc=document.getElementById('iDesc').value.trim();
     const data=document.getElementById('iData').value;
     const valor=parseFloat(document.getElementById('iValor').value)||0;
     if(!desc||!data){ toast('Preencha descrição e data.'); return; }
     if(id){ const it=m.income.find(x=>x.id===id); Object.assign(it,{descricao:desc,data,valor}); }
     else{ m.income.push({id:uid(),descricao:desc,data,valor}); }
     saveDB(); closeModal(); renderTab('renda'); toast('Renda salva.');
   }
   function deleteIncome(id){
     const m = monthData(DB.currentMonth);
     m.income = m.income.filter(e=>e.id!==id);
     saveDB(); renderTab('renda'); toast('Renda removida.');
   }
   
   /* ---------- CONTAS A PAGAR ---------- */
   function situBadge(s){
     const cls = s==='Pago'?'pago':(s==='Atrasado'?'atrasado':'pendente');
     return `<span class="badge ${cls}">${s}</span>`;
   }
   function viewContas(){
     const m = monthData(DB.currentMonth);
     const rows = m.bills.slice().sort((a,b)=>a.dataVencimento.localeCompare(b.dataVencimento));
     return `
     <div class="card">
       <h3>Contas a pagar — ${monthKeyToLabel(DB.currentMonth)} <span class="tag">${rows.length}</span>
         <button class="btn btn-primary" style="margin-left:auto;" onclick="openBillModal()">+ Nova conta</button>
       </h3>
       <div class="tablewrap"><table>
         <thead><tr><th>Tipo</th><th>Fornecedor</th><th>Vencimento</th><th>Taxa</th><th>Valor</th><th>Situação</th><th>Obs.</th><th></th></tr></thead>
         <tbody>
           ${rows.length? rows.map(b=>`
             <tr>
               <td><span class="cat-chip">${b.tipoConta}</span></td>
               <td>${b.fornecedor}</td>
               <td class="mono">${fmtDate(b.dataVencimento)}</td>
               <td class="mono">${b.taxa?b.taxa+'%':'—'}</td>
               <td class="mono">${fmtBRL(b.valor)}</td>
               <td>${situBadge(b.situacao)}</td>
               <td class="small-muted" style="max-width:160px;white-space:normal;">${b.observacoes||'—'}</td>
               <td><div class="row-actions">
                 <button class="icon-btn" onclick="openBillModal('${b.id}')">✎</button>
                 <button class="icon-btn" onclick="deleteBill('${b.id}')">🗑</button>
               </div></td>
             </tr>`).join('') : `<tr class="empty-row"><td colspan="8">Nenhuma conta cadastrada este mês.</td></tr>`}
         </tbody>
       </table></div>
     </div>`;
   }
   function openBillModal(id){
     const m = monthData(DB.currentMonth);
     const item = id ? m.bills.find(b=>b.id===id) : null;
     const tipoOpt = TIPOS_CONTA.map(t=>`<option ${item&&item.tipoConta===t?'selected':''}>${t}</option>`).join('');
     const situOpt = ['Pendente','Pago','Atrasado'].map(s=>`<option ${item&&item.situacao===s?'selected':''}>${s}</option>`).join('');
     showModal(`
       <div class="modal-head"><h3>${item?'Editar conta':'Nova conta a pagar'}</h3><button class="close-x" onclick="closeModal()">✕</button></div>
       <div class="two-col">
         <div class="field"><label>Tipo de conta</label><select id="bTipo">${tipoOpt}</select></div>
         <div class="field"><label>Fornecedor</label><input id="bForn" value="${item?item.fornecedor:''}" placeholder="Ex: Nubank, Enel..."></div>
       </div>
       <div class="two-col">
         <div class="field"><label>Data de vencimento</label><input type="date" id="bVenc" value="${item?item.dataVencimento:new Date().toISOString().slice(0,10)}"></div>
         <div class="field"><label>Taxa % (se houve)</label><input type="number" step="0.01" id="bTaxa" value="${item&&item.taxa?item.taxa:''}" placeholder="0"></div>
       </div>
       <div class="two-col">
         <div class="field"><label>Valor da conta (R$)</label><input type="number" step="0.01" id="bValor" value="${item?item.valor:''}"></div>
         <div class="field"><label>Situação</label><select id="bSitu">${situOpt}</select></div>
       </div>
       <div class="field"><label>Observações</label><textarea id="bObs" rows="2" placeholder="Notas adicionais...">${item?item.observacoes||'':''}</textarea></div>
       <div class="modal-foot">
         <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
         <button class="btn btn-primary" onclick="saveBill('${item?item.id:''}')">Salvar</button>
       </div>`);
   }
   function saveBill(id){
     const m = monthData(DB.currentMonth);
     const tipoConta=document.getElementById('bTipo').value;
     const fornecedor=document.getElementById('bForn').value.trim();
     const dataVencimento=document.getElementById('bVenc').value;
     const taxa=parseFloat(document.getElementById('bTaxa').value)||0;
     const valor=parseFloat(document.getElementById('bValor').value)||0;
     const situacao=document.getElementById('bSitu').value;
     const observacoes=document.getElementById('bObs').value.trim();
     if(!fornecedor||!dataVencimento){ toast('Preencha fornecedor e vencimento.'); return; }
     if(id){ const b=m.bills.find(x=>x.id===id); Object.assign(b,{tipoConta,fornecedor,dataVencimento,taxa,valor,situacao,observacoes}); }
     else{ m.bills.push({id:uid(),tipoConta,fornecedor,dataVencimento,taxa,valor,situacao,observacoes}); }
     saveDB(); closeModal(); renderTab('contas'); toast('Conta salva.');
   }
   function deleteBill(id){
     const m = monthData(DB.currentMonth);
     m.bills = m.bills.filter(b=>b.id!==id);
     saveDB(); renderTab('contas'); toast('Conta removida.');
   }
   
   /* ---------- ANÁLISE DE CRÉDITO ---------- */
   function viewCredito(){
     const m = monthData(DB.currentMonth);
     const cartoes = m.bills.filter(b=>b.tipoConta==='Cartão de Crédito');
     const byForn = {};
     cartoes.forEach(b=>{ byForn[b.fornecedor]=byForn[b.fornecedor]||{devido:0,pago:0,count:0}; byForn[b.fornecedor].count++; if(b.situacao==='Pago') byForn[b.fornecedor].pago+=Number(b.valor); else byForn[b.fornecedor].devido+=Number(b.valor); });
     const fornecedores = Object.keys(byForn);
     const totalDevido = fornecedores.reduce((s,f)=>s+byForn[f].devido,0);
     const maxDevido = Math.max(1,...fornecedores.map(f=>byForn[f].devido));
     const ranking = fornecedores.slice().sort((a,b)=>byForn[b].devido-byForn[a].devido);
     return `
     <div class="grid grid-4 section-gap">
       <div class="card stat-card"><div class="k">Fornecedores de crédito</div><div class="v">${fornecedores.length}</div><div class="d">cartões distintos este mês</div></div>
       <div class="card stat-card"><div class="k">Total devido</div><div class="v neg">${fmtBRL(totalDevido)}</div><div class="d">em faturas pendentes</div></div>
       <div class="card stat-card"><div class="k">Faturas lançadas</div><div class="v">${cartoes.length}</div><div class="d">no total do mês</div></div>
       <div class="card stat-card"><div class="k">Maior credor</div><div class="v" style="font-size:17px;">${ranking[0]||'—'}</div><div class="d">${ranking[0]?fmtBRL(byForn[ranking[0]].devido):'sem dados'}</div></div>
     </div>
     <div class="card">
       <h3>Quem eu devo mais <span class="tag">ranking por fornecedor</span></h3>
       ${ranking.length? ranking.map(f=>`
         <div style="margin-bottom:14px;">
           <div style="display:flex;justify-content:space-between;font-size:13.5px;">
             <span>${f} <span class="small-muted">· ${byForn[f].count} fatura(s)</span></span>
             <span class="mono">${fmtBRL(byForn[f].devido)}</span>
           </div>
           <div class="credit-bar-track"><div class="credit-bar-fill" style="width:${(byForn[f].devido/maxDevido*100).toFixed(0)}%"></div></div>
         </div>`).join('') : '<div class="empty-state"><div class="glyph">💳</div><p>Nenhuma conta do tipo "Cartão de Crédito" lançada este mês. Cadastre em Contas a Pagar.</p></div>'}
     </div>`;
   }
   
   /* ---------- HISTÓRICO ---------- */
   function viewHistorico(){
     const keys = Object.keys(DB.months).filter(k=>DB.months[k].closed).sort();
     const rows = keys.map(k=>{
       const m=DB.months[k]; const inc=totalIncome(m), out=totalOut(m), saldo=inc-out;
       return {key:k, inc, out, saldo};
     });
     let best=null, worst=null;
     const thisYear = new Date().getFullYear().toString();
     const yearRows = rows.filter(r=>r.key.startsWith(thisYear));
     if(yearRows.length){ best=yearRows.reduce((a,b)=>b.saldo>a.saldo?b:a); worst=yearRows.reduce((a,b)=>b.saldo<a.saldo?b:a); }
     return `
     ${(best&&worst)?`
     <div class="grid grid-2 section-gap">
       <div class="card"><h3>🏆 Melhor mês de ${thisYear}</h3><div class="v" style="font-family:var(--font-display);font-size:20px;color:var(--accent)">${monthKeyToLabel(best.key)}</div><div class="small-muted mono">saldo ${fmtBRL(best.saldo)}</div></div>
       <div class="card"><h3>⚠️ Pior mês de ${thisYear}</h3><div class="v" style="font-family:var(--font-display);font-size:20px;color:var(--red)">${monthKeyToLabel(worst.key)}</div><div class="small-muted mono">saldo ${fmtBRL(worst.saldo)}</div></div>
     </div>`:''}
     <div class="card section-gap">
       <h3>Mês atual <span class="tag">${monthKeyToLabel(DB.currentMonth)}</span>
         <button class="btn btn-primary" style="margin-left:auto;" onclick="closeMonth()">Fechar mês e iniciar novo →</button>
       </h3>
       <p class="small-muted">Ao fechar o mês, o período atual é arquivado no histórico abaixo e um novo mês é iniciado em branco. Essa ação não apaga nada — os lançamentos ficam guardados para consulta.</p>
     </div>
     <div class="card">
       <h3>Histórico de meses fechados <span class="tag">${rows.length}</span></h3>
       <div class="tablewrap"><table>
         <thead><tr><th>Mês</th><th>Renda</th><th>Despesas</th><th>Saldo</th><th>Resultado</th></tr></thead>
         <tbody>
           ${rows.length? rows.slice().reverse().map(r=>`
             <tr>
               <td>${monthKeyToLabel(r.key)}</td>
               <td class="mono" style="color:var(--accent)">${fmtBRL(r.inc)}</td>
               <td class="mono" style="color:var(--red)">${fmtBRL(r.out)}</td>
               <td class="mono">${fmtBRL(r.saldo)}</td>
               <td><span class="badge ${r.saldo>=0?'bom':'ruim'}">${r.saldo>=0?'Bom':'Ruim'}</span></td>
             </tr>`).join('') : `<tr class="empty-row"><td colspan="5">Nenhum mês fechado ainda.</td></tr>`}
         </tbody>
       </table></div>
     </div>`;
   }
   function closeMonth(){
     if(!confirm('Fechar '+monthKeyToLabel(DB.currentMonth)+' e iniciar um novo mês?')) return;
     DB.months[DB.currentMonth].closed = true;
     const nk = nextMonthKey(DB.currentMonth);
     ensureMonth(nk);
     DB.currentMonth = nk;
     saveDB();
     renderSidebar();
     goTab('historico');
     toast('Mês fechado. Novo mês iniciado: '+monthKeyToLabel(nk));
   }
   
   /* ---------- CONFIGURAÇÕES ---------- */
   function viewConfig(){
     return `
     <div class="grid grid-2">
       <div class="card">
         <h3>Categorias de despesa</h3>
         <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
           ${DB.categories.map(c=>`<span class="cat-chip">${c} <button onclick="removeCategory('${c}')" style="background:none;border:none;color:var(--text-faint);margin-left:4px;cursor:pointer;">✕</button></span>`).join('')}
         </div>
         <div style="display:flex;gap:8px;">
           <input id="newCat" placeholder="Nova categoria" style="flex:1;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:9px 12px;color:var(--text);">
           <button class="btn btn-ghost" onclick="addCategory()">Adicionar</button>
         </div>
       </div>
       <div class="card">
         <h3>Conta e acesso</h3>
         ${fbUser ? `
           <p class="small-muted section-gap">Conectado via Google como <strong style="color:var(--text)">${fbUser.email}</strong>. Seus dados estão sincronizados na nuvem (Firestore) e disponíveis em qualquer aparelho com esta conta.</p>
           <button class="btn btn-ghost btn-block" onclick="lockApp()">Sair da conta</button>
         ` : `
           <p class="small-muted section-gap">Você está em modo local — os dados ficam salvos apenas neste navegador. Para sincronizar entre celular e computador, saia e entre com uma conta Google na tela de login.</p>
           <div class="field"><label>Nova senha local</label><input type="password" id="newPass"></div>
           <button class="btn btn-ghost btn-block" onclick="changePassword()">Atualizar senha</button>
         `}
       </div>
     </div>
     <div class="card" style="margin-top:16px;">
       <h3>Sincronização Firebase <span class="tag">${firebaseReady?'ativo':'não configurado'}</span></h3>
       <p class="small-muted" style="max-width:640px;">
         ${firebaseReady
           ? 'Este site está conectado a um projeto Firebase. Ao entrar com Google, seus lançamentos são salvos automaticamente no Firestore, associados à sua conta.'
           : 'Para habilitar o login com Google, edite o arquivo <span class="mono">firebase-config.js</span> na raiz do projeto com as chaves do seu projeto Firebase (veja o README.md) e publique novamente no Vercel.'}
       </p>
     </div>`;
   }
   function addCategory(){
     const v = document.getElementById('newCat').value.trim();
     if(!v) return;
     if(!DB.categories.includes(v)) DB.categories.push(v);
     saveDB(); renderTab('config'); toast('Categoria adicionada.');
   }
   function removeCategory(c){
     DB.categories = DB.categories.filter(x=>x!==c);
     saveDB(); renderTab('config');
   }
   async function changePassword(){
     const v = document.getElementById('newPass').value;
     if(v.length<4){ toast('Senha muito curta.'); return; }
     DB.passwordHash = await sha256(v);
     saveDB(); toast('Senha atualizada.');
   }
   
   /* ---------- modal helpers ---------- */
   function showModal(html){
     document.getElementById('modalBox').innerHTML = html;
     document.getElementById('modalBackdrop').classList.add('open');
   }
   function closeModal(){ document.getElementById('modalBackdrop').classList.remove('open'); }
   document.getElementById('modalBackdrop').addEventListener('click', e=>{ if(e.target.id==='modalBackdrop') closeModal(); });
   
   /* ---------- print / A4 preview ---------- */
   function openPrintPreview(printNow){
     const m = monthData(DB.currentMonth);
     const byCat = {};
     m.expenses.forEach(e=>{ byCat[e.categoria]=byCat[e.categoria]||[]; byCat[e.categoria].push(e); });
     const billsRows = m.bills.map(b=>`<tr><td>${b.tipoConta}</td><td>${b.fornecedor}</td><td>${fmtDate(b.dataVencimento)}</td><td>${b.situacao}</td><td style="text-align:right">${fmtBRL(b.valor)}</td></tr>`).join('');
     const catBlocks = Object.keys(byCat).map(cat=>{
       const items = byCat[cat];
       const sub = items.reduce((s,i)=>s+Number(i.valor),0);
       return `<div class="cat-block"><h4>${cat} — ${fmtBRL(sub)}</h4>
         <table><thead><tr><th>Descrição</th><th>Data</th><th style="text-align:right">Valor</th></tr></thead>
         <tbody>${items.map(i=>`<tr><td>${i.descricao}</td><td>${fmtDate(i.data)}</td><td style="text-align:right">${fmtBRL(i.valor)}</td></tr>`).join('')}</tbody></table></div>`;
     }).join('');
     const totalDespesas = totalOut(m);
     const totalRenda = totalIncome(m);
     document.getElementById('printArea').innerHTML = `
       <div class="print-sheet" id="sheet">
         <div class="ps-head">
           <div><h1>Relatório Financeiro</h1><div>${monthKeyToLabel(DB.currentMonth)}</div></div>
           <small>Gerado em ${new Date().toLocaleDateString('pt-BR')}</small>
         </div>
         <p style="font-size:12.5px;color:#555;">Renda do mês: <strong>${fmtBRL(totalRenda)}</strong> &nbsp;·&nbsp; Total de despesas: <strong>${fmtBRL(totalDespesas)}</strong></p>
         <h4 style="text-transform:uppercase;font-size:12.5px;letter-spacing:.5px;margin:18px 0 8px;">Despesas por categoria</h4>
         ${catBlocks || '<p style="color:#777;font-size:12.5px;">Nenhuma despesa lançada.</p>'}
         <h4 style="text-transform:uppercase;font-size:12.5px;letter-spacing:.5px;margin:18px 0 8px;">Contas a pagar</h4>
         <table><thead><tr><th>Tipo</th><th>Fornecedor</th><th>Vencimento</th><th>Situação</th><th style="text-align:right">Valor</th></tr></thead>
         <tbody>${billsRows || '<tr><td colspan="5" style="color:#777;">Nenhuma conta cadastrada.</td></tr>'}</tbody></table>
         <div class="ps-total"><span>Total geral do mês</span><span>${fmtBRL(totalDespesas)}</span></div>
       </div>`;
     document.getElementById('printBackdrop').classList.add('open');
     if(printNow) setTimeout(()=>window.print(), 200);
   }
   function closePrint(){ document.getElementById('printBackdrop').classList.remove('open'); }
   