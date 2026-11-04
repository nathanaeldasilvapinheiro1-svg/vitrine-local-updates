const VL_ADMIN_CONFIG={"url":"https://wnocdubgunyugdcjfpbj.supabase.co","publishableKey":"sb_publishable_6WqyATGJQWSMoD4eFOJ0bw_FnHLE3vU"};
/* Vitrine Local: painel administrativo real, servido em HTTPS.
   A chave publishable é pública. Nenhuma senha/role privilegiada é exposta. */
(()=>{
'use strict';
const URL_BASE=VL_ADMIN_CONFIG.url, KEY=VL_ADMIN_CONFIG.publishableKey;
const STORAGE='vl-admin-session-v1';
const $=id=>document.getElementById(id);
const escapeHTML=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={pending:'Em análise',correction_requested:'Correção solicitada',approved:'Aprovado',rejected:'Rejeitado',blocked:'Bloqueado'};
const documents={identification:'Identidade',driver_license:'Habilitação',vehicle_document:'Documento do veículo'};
let mode='login', session=null, drivers=[], profiles=[], selectedId=null, docs=[];
function flash(message,error=false){
  const el=$('message');el.textContent=message;el.hidden=false;el.classList.toggle('error',!!error);
  el.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function clearFlash(){$('message').hidden=true}
function show(name){
  ['auth','waiting','dashboard'].forEach(id=>$(id).hidden=id!==name);
}
async function readResponse(response){
  let data;try{data=await response.json()}catch(_e){data=null}
  if(!response.ok){
    const msg=data?.msg||data?.message||data?.error_description||data?.error||('Erro HTTP '+response.status);
    throw Error(typeof msg==='string'?msg:'Falha ao consultar o Supabase');
  }
  return data;
}
async function authRequest(endpoint,body){
  return readResponse(await fetch(URL_BASE+'/auth/v1/'+endpoint,{
    method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  }));
}
function setSession(data){
  session={access_token:data.access_token,refresh_token:data.refresh_token,
    expires_at:Date.now()+((Number(data.expires_in)||3500)*1000),
    email:data.user?.email||session?.email||''};
  localStorage.setItem(STORAGE,JSON.stringify(session));
}
function dropSession(){session=null;localStorage.removeItem(STORAGE)}
async function getToken(force=false){
  if(!session)throw Error('Entre na sua conta.');
  if(force||!session.access_token||Date.now()>session.expires_at-60000){
    if(!session.refresh_token){dropSession();throw Error('Sessão expirada. Entre novamente.')}
    const data=await authRequest('token?grant_type=refresh_token',{refresh_token:session.refresh_token});
    setSession(data);
  }
  return session.access_token;
}
async function api(path,opts={},retry=true){
  const token=await getToken();
  const response=await fetch(URL_BASE+path,{
    method:opts.method||'GET',
    headers:{apikey:KEY,Authorization:'Bearer '+token,
      ...(opts.body?{'Content-Type':'application/json'}:{}),
      ...(opts.headers||{})},
    body:opts.body?JSON.stringify(opts.body):undefined
  });
  if(response.status===401&&retry){await getToken(true);return api(path,opts,false)}
  return readResponse(response);
}
function initForm(){
  $('auth-title').textContent=mode==='signup'?'Criar conta de acesso':'Entrar como administrador';
  $('auth-description').textContent=mode==='signup'
    ?'Crie sua conta e confirme o e-mail. A autorização de administrador é concedida separadamente, após identificação.'
    :'Acesse com o e-mail e senha cadastrados no Supabase Auth.';
  $('auth-submit').textContent=mode==='signup'?'Criar conta e verificar e-mail':'Entrar';
  $('auth-toggle').textContent=mode==='signup'?'Já tenho uma conta':'Criar minha conta de acesso';
  $('password').autocomplete=mode==='signup'?'new-password':'current-password';
}
async function authenticate(event){
  event.preventDefault();clearFlash();
  const email=$('email').value.trim().toLowerCase(),password=$('password').value;
  if(password.length<8){flash('A senha precisa ter pelo menos 8 caracteres.',true);return}
  const submit=$('auth-submit');submit.disabled=true;
  try{
    const data=await authRequest(mode==='signup'?'signup':'token?grant_type=password',{email,password});
    $('password').value='';
    if(data.access_token){setSession(data);await checkRole()}
    else{flash('Cadastro recebido. Confirme o endereço de e-mail pela mensagem do Supabase e depois volte para entrar. Nenhuma autorização administrativa é concedida automaticamente.');mode='login';initForm()}
  }catch(e){flash('Não foi possível autenticar: '+e.message,true)}
  finally{submit.disabled=false}
}
async function checkRole(){
  clearFlash();
  try{
    const allowed=await api('/rest/v1/rpc/am_i_driver_admin',{method:'POST',body:{}});
    if(allowed===true){
      show('dashboard');$('admin-email').textContent=session?.email||'Administrador';
      await loadDrivers();
    }else{
      show('waiting');$('waiting-email').textContent=session?.email||'Conta autenticada';
    }
  }catch(e){
    if(/sessão|token|JWT|401|invalid/i.test(e.message)){dropSession();show('auth')}
    flash('Não foi possível conferir a permissão de administrador: '+e.message,true);
  }
}
async function loadDrivers(){
  const btn=$('refresh-list');btn.disabled=true;
  try{
    const result=await Promise.all([
      api('/rest/v1/driver_applications?select=user_id,status,submitted_at,reviewed_at,review_reason&order=submitted_at.desc&limit=200'),
      api('/rest/v1/driver_profiles?select=id,full_name,phone,vehicle_type,city,state_code&limit=200')
    ]);
    drivers=Array.isArray(result[0])?result[0]:[];
    profiles=Array.isArray(result[1])?result[1]:[];
    renderList();
    clearFlash();
  }catch(e){flash('Falha ao carregar cadastros: '+e.message,true)}
  finally{btn.disabled=false}
}
function renderList(){
  const totals=['pending','correction_requested','approved','rejected'];
  $('summary').innerHTML=totals.map(s=>'<div class="stat"><strong>'+drivers.filter(d=>d.status===s).length+'</strong><small>'+names[s]+'</small></div>').join('');
  const status=$('filter').value;
  const list=drivers.filter(x=>status==='all'||x.status===status);
  const byId=new Map(profiles.map(p=>[p.id,p]));
  $('driver-list').innerHTML=list.length?list.map(d=>{
    const p=byId.get(d.user_id)||{};
    const date=d.submitted_at?new Date(d.submitted_at).toLocaleString('pt-BR'):'';
    return '<button class="driver" type="button" data-open="'+escapeHTML(d.user_id)+'">'+
       '<strong>'+escapeHTML(p.full_name||'Perfil indisponível')+'</strong>'+
       '<small>'+escapeHTML(p.vehicle_type||'')+' · '+escapeHTML(p.city||'Rio Brilhante')+' · '+escapeHTML(date)+'</small>'+
       '<span class="pill '+escapeHTML(d.status)+'">'+escapeHTML(names[d.status]||d.status)+'</span></button>';
  }).join(''):'<p>Nenhum cadastro encontrado com este filtro.</p>';
}
async function openDriver(id){
  const d=drivers.find(x=>x.user_id===id);if(!d)return;
  selectedId=id;
  const p=profiles.find(x=>x.id===id)||{};
  $('detail').hidden=false;
  $('detail-title').textContent='Cadastro de '+(p.full_name||'Entregador');
  const fields=[
    ['Situação',names[d.status]||d.status],['Nome',p.full_name||'Não informado'],
    ['Telefone',p.phone||'Não informado'],['Veículo',p.vehicle_type||'Não informado'],
    ['Cidade',p.city||'Não informado'],['Enviado em',d.submitted_at?new Date(d.submitted_at).toLocaleString('pt-BR'):''],
    ['Última justificativa',d.review_reason||'Nenhuma']
  ];
  $('driver-fields').innerHTML='<div class="detail-grid">'+fields.map(f=>'<div class="field"><small>'+escapeHTML(f[0])+'</small><strong>'+escapeHTML(f[1])+'</strong></div>').join('')+'</div>';
  $('review-form').hidden=d.status!=='pending';
  $('reason').value='';$('identity-check').checked=false;$('document-check').checked=false;
  $('decision').value='correction_requested';changeDecision();
  $('document-list').textContent='Consultando documentos privados…';
  try{
    docs=await api('/rest/v1/driver_documents?select=id,document_type,object_path,uploaded_at&user_id=eq.'+encodeURIComponent(id)+'&order=uploaded_at.desc');
    $('document-list').innerHTML=docs.length?docs.map(row=>
      '<div class="file-item"><span>'+escapeHTML(documents[row.document_type]||row.document_type)+' · '+escapeHTML(new Date(row.uploaded_at).toLocaleDateString('pt-BR'))+'</span><button class="secondary" type="button" data-view="'+escapeHTML(row.id)+'">Conferir arquivo</button></div>'
      ).join(''):'<p>Nenhum documento foi enviado. A aprovação não pode ser concluída sem os arquivos exigidos.</p>';
  }catch(e){$('document-list').textContent='Não foi possível acessar documentos: '+e.message}
  $('detail').scrollIntoView({behavior:'smooth',block:'start'});
}
function changeDecision(){
  const approving=$('decision').value==='approved';
  $('reason').required=!approving;
  $('identity-check').parentElement.hidden=!approving;
  $('document-check').parentElement.hidden=!approving;
  $('review-submit').textContent=approving?'Confirmar aprovação no Supabase':'Registrar decisão no Supabase';
}
async function submitReview(event){
  event.preventDefault();
  if(!selectedId)return;
  const decision=$('decision').value, reason=$('reason').value.trim();
  if(decision!=='approved'&&reason.length<10){flash('Explique a decisão em pelo menos 10 caracteres.',true);return}
  if(decision==='approved'&&(!$('identity-check').checked||!$('document-check').checked)){
    flash('É necessário conferir identidade e documentos.',true);return;
  }
  if(!confirm('Registrar esta decisão real no Supabase? Ela afetará a situação do entregador.'))return;
  const btn=$('review-submit');btn.disabled=true;
  try{
    await api('/rest/v1/rpc/review_driver_application',{method:'POST',body:{
      p_driver_id:selectedId,p_decision:decision,p_reason:reason||null,
      p_identity_checked:$('identity-check').checked,
      p_documents_checked:$('document-check').checked
    }});
    $('detail').hidden=true;await loadDrivers();
    flash('Decisão registrada no banco de dados: '+(names[decision]||decision)+'.');
  }catch(e){flash('Não foi possível registrar a decisão: '+e.message,true)}
  finally{btn.disabled=false}
}
async function viewDocument(id){
  const doc=docs.find(x=>x.id===id);if(!doc)return;
  const tab=window.open('', '_blank');
  try{
    const token=await getToken();
    const path=doc.object_path.split('/').map(encodeURIComponent).join('/');
    const r=await fetch(URL_BASE+'/storage/v1/object/authenticated/vl-driver-documents/'+path,{
      headers:{apikey:KEY,Authorization:'Bearer '+token}
    });
    if(!r.ok)throw Error('Arquivo não disponível ou acesso negado ('+r.status+')');
    const blob=await r.blob();
    const blobUrl=URL.createObjectURL(blob);
    if(tab){tab.location.href=blobUrl}
    else{
      const link=document.createElement('a');link.href=blobUrl;link.download='documento-'+doc.document_type;
      document.body.appendChild(link);link.click();link.remove();
    }
    setTimeout(()=>URL.revokeObjectURL(blobUrl),120000);
  }catch(e){if(tab)tab.close();flash('Falha ao consultar documento: '+e.message,true)}
}
async function signOut(){
  try{if(session)await api('/auth/v1/logout',{method:'POST',body:{}})}catch(_e){}
  dropSession();drivers=[];profiles=[];selectedId=null;
  show('auth');$('detail').hidden=true;clearFlash();
}
$('auth-form').addEventListener('submit',authenticate);
$('auth-toggle').addEventListener('click',()=>{mode=mode==='login'?'signup':'login';initForm();clearFlash()});
$('forgot').addEventListener('click',async()=>{
  const email=$('email').value.trim();
  if(!email){flash('Informe o e-mail cadastrado para recuperar a senha.',true);return}
  try{await authRequest('recover',{email});flash('Se a conta existir, o Supabase enviará instruções de recuperação ao e-mail.')}catch(e){flash('Erro na recuperação: '+e.message,true)}
});
$('waiting-retry').addEventListener('click',checkRole);
$('waiting-exit').addEventListener('click',signOut);
$('logout').addEventListener('click',signOut);
$('refresh-list').addEventListener('click',loadDrivers);
$('filter').addEventListener('change',renderList);
$('driver-list').addEventListener('click',e=>{const el=e.target.closest('[data-open]');if(el)openDriver(el.dataset.open)});
$('document-list').addEventListener('click',e=>{const el=e.target.closest('[data-view]');if(el)viewDocument(el.dataset.view)});
$('decision').addEventListener('change',changeDecision);
$('review-form').addEventListener('submit',submitReview);
$('review-cancel').addEventListener('click',()=>{$('detail').hidden=true;selectedId=null});
$('close-detail').addEventListener('click',()=>{$('detail').hidden=true;selectedId=null});
try{const raw=localStorage.getItem(STORAGE);if(raw)session=JSON.parse(raw)}catch(_e){dropSession()}
initForm();
if(session?.refresh_token)checkRole();else show('auth');
})();
